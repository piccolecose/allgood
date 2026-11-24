import { isExpress, isExpressResponse, isFastify, isFastifyReply, isHono, isWebRequest } from "./detect.js";

const fn = () => undefined;

const cases: [string, (value: unknown) => boolean, unknown, unknown][] = [
  ["isExpress", isExpress, { app: {}, headers: {} }, { app: {} }],
  ["isExpressResponse", isExpressResponse, { setHeader: fn, send: fn }, { setHeader: fn }],
  ["isFastify", isFastify, { server: {}, raw: {}, id: "1" }, { server: {}, raw: {} }],
  ["isFastifyReply", isFastifyReply, { code: fn, send: fn }, { code: fn }],
  ["isHono", isHono, { header: fn, res: {} }, { header: fn }],
  ["isWebRequest", isWebRequest, new Request("http://localhost/"), { url: "http://localhost/" }],
];

describe.each(cases)("%s", (_name, detect, match, nearMiss) => {
  it("accepts a matching shape", () => {
    expect(detect(match)).toBe(true);
  });

  it.each([null, undefined, "text", 42, {}])("rejects %p", (value) => {
    expect(detect(value)).toBe(false);
  });

  it("rejects a near-miss object", () => {
    expect(detect(nearMiss)).toBe(false);
  });
});
