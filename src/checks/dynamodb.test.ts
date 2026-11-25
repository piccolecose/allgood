import { Status } from "../index.js";
import { dynamodbCheck } from "./dynamodb.js";

const send = jest.fn();
const destroy = jest.fn();
const DynamoDBClient = jest.fn();
const config = { dynamodb_table: "orders", checks: { dynamodb: true } };

const mockSdk = () =>
  jest.doMock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: DynamoDBClient.mockImplementation(() => ({ send, destroy })),
    DescribeTableCommand: jest.fn((input) => input),
  }));

describe("dynamodb", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockSdk();
  });

  it.each([
    ["ACTIVE", Status.pass, "true", "DynamoDB table is active"],
    ["UPDATING", Status.warn, "UPDATING", "DynamoDB table is updating"],
    ["DELETING", Status.fail, "DELETING", "DynamoDB table is DELETING"],
  ])("maps table status %s", async (TableStatus, status, value, message) => {
    send.mockResolvedValue({ Table: { TableStatus } });

    const result = await dynamodbCheck(config);

    expect(result).toEqual({ componentName: "dynamodb", status, value, message, time: expect.any(Number) });
    expect(send).toHaveBeenCalledWith({ TableName: "orders" }, { abortSignal: expect.any(AbortSignal) });
    expect(DynamoDBClient).toHaveBeenCalledWith({ maxAttempts: 1 });
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("fails without constructing the SDK client when no table is configured", async () => {
    const result = await dynamodbCheck({ checks: { dynamodb: true } });

    expect(result).toMatchObject({ status: Status.fail, value: "N/A", message: "No DynamoDB table configured" });
    expect(DynamoDBClient).not.toHaveBeenCalled();
  });

  it("fails with an install hint when the SDK is missing", async () => {
    jest.doMock("@aws-sdk/client-dynamodb", () => {
      throw new Error("Cannot find module");
    });

    const result = await dynamodbCheck(config);

    expect(result).toMatchObject({
      status: Status.fail,
      value: "false",
      message: "Install @aws-sdk/client-dynamodb to use the DynamoDB check",
    });
  });

  it("fails with value timeout when the abort signal fires", async () => {
    send.mockImplementation(async (_command, { abortSignal }) => {
      jest.spyOn(abortSignal, "aborted", "get").mockReturnValue(true);
      throw new Error("aborted");
    });

    const result = await dynamodbCheck(config);

    expect(result).toMatchObject({ status: Status.fail, value: "timeout", message: "DynamoDB connection timed out" });
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("fails with value false on any other error", async () => {
    send.mockRejectedValue(new Error("ResourceNotFoundException"));

    const result = await dynamodbCheck(config);

    expect(result).toMatchObject({ status: Status.fail, value: "false", message: "DynamoDB check failed" });
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
