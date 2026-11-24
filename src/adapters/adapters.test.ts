import type { AddressInfo } from "node:net";
import express from "express";
import Fastify from "fastify";
import { Hono } from "hono";
import { cpuCheck } from "../checks/cpu.js";
import { memoryCheck } from "../checks/memory.js";
import { createHealthCheck, Status } from "../index.js";

jest.mock("../checks/memory.js", () => ({ memoryCheck: jest.fn() }));
jest.mock("../checks/cpu.js", () => ({ cpuCheck: jest.fn() }));

const result = (status: Status) => ({ status, value: "", componentName: "x", message: "", time: 0 });

const config = {
  checks: {
    memory_usage: true,
    cpu_usage: true,
    disk_space: false,
    outbound_internet: false,
  },
};

beforeEach(() => {
  (memoryCheck as jest.Mock).mockResolvedValue(result(Status.pass));
  (cpuCheck as jest.Mock).mockResolvedValue(result(Status.pass));
});

describe("Express adapter", () => {
  const app = express();
  app.get("/health", createHealthCheck(config) as express.RequestHandler);
  const server = app.listen(0, "127.0.0.1");
  const url = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}/health`;

  beforeAll(() => new Promise((resolve) => server.once("listening", resolve)));
  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it("returns 200 JSON when every check passes", async () => {
    const res = await fetch(url());

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect((await res.json()).status).toBe("pass");
  });

  it("returns 503 when a check fails", async () => {
    (cpuCheck as jest.Mock).mockResolvedValue(result(Status.fail));

    const res = await fetch(url());

    expect(res.status).toBe(503);
    expect((await res.json()).status).toBe("fail");
  });

  it("serves HTML to a browser", async () => {
    const res = await fetch(url(), { headers: { accept: "text/html" } });

    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("It's All Good");
  });
});

describe("Fastify adapter", () => {
  const app = Fastify();
  app.get("/health", createHealthCheck(config) as never);

  afterAll(() => app.close());

  it("returns 200 JSON when every check passes", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.json().status).toBe("pass");
  });

  it("returns 503 when a check fails", async () => {
    (memoryCheck as jest.Mock).mockResolvedValue(result(Status.fail));

    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(503);
    expect(res.json().status).toBe("fail");
  });

  it("serves HTML to a browser", async () => {
    const res = await app.inject({ method: "GET", url: "/health", headers: { accept: "text/html" } });

    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("It's All Good");
  });
});

describe("Hono adapter", () => {
  const app = new Hono();
  app.get("/health", createHealthCheck(config));

  it("returns 200 JSON when every check passes", async () => {
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect((await res.json()).status).toBe("pass");
  });

  it("returns 503 when a check fails", async () => {
    (cpuCheck as jest.Mock).mockResolvedValue(result(Status.fail));

    const res = await app.request("/health");

    expect(res.status).toBe(503);
    expect((await res.json()).status).toBe("fail");
  });

  it("serves HTML to a browser", async () => {
    const res = await app.request("/health", { headers: { accept: "text/html" } });

    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("It's All Good");
  });
});
