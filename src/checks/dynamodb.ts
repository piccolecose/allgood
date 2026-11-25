import { type Config, Status } from "../index.js";
import type { HealthCheck } from "./types.js";

const TIMEOUT_MS = 5000;

/**
 * Calls DescribeTable on the configured table and reads its status.
 *
 * The AWS SDK is an optional peer dependency, so it loads here and nowhere
 * else. Region, credentials and endpoint come from the SDK's default chain.
 * One attempt, no retries, so a down endpoint fails inside the abort window.
 */
export const dynamodbCheck = async (config: Config): Promise<HealthCheck> => {
  const start = Date.now();
  const result = (status: Status, value: string, message: string): HealthCheck => ({
    componentName: "dynamodb",
    status,
    message,
    value,
    time: Date.now() - start,
  });

  if (!config.dynamodb_table) {
    return result(Status.fail, "N/A", "No DynamoDB table configured");
  }

  let sdk: typeof import("@aws-sdk/client-dynamodb");
  try {
    sdk = await import("@aws-sdk/client-dynamodb");
  } catch {
    return result(Status.fail, "false", "Install @aws-sdk/client-dynamodb to use the DynamoDB check");
  }

  const client = new sdk.DynamoDBClient({ maxAttempts: 1 });
  const abortSignal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    const { Table } = await client.send(new sdk.DescribeTableCommand({ TableName: config.dynamodb_table }), {
      abortSignal,
    });
    const tableStatus = Table?.TableStatus ?? "UNKNOWN";
    if (tableStatus === "ACTIVE") return result(Status.pass, "true", "DynamoDB table is active");
    if (tableStatus === "UPDATING") return result(Status.warn, tableStatus, "DynamoDB table is updating");
    return result(Status.fail, tableStatus, `DynamoDB table is ${tableStatus}`);
  } catch {
    if (abortSignal.aborted) return result(Status.fail, "timeout", "DynamoDB connection timed out");
    return result(Status.fail, "false", "DynamoDB check failed");
  } finally {
    client.destroy();
  }
};
