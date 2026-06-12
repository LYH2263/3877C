import { PrismaClient } from "@prisma/client";

import { env } from "./env";
import { getTraceId } from "../utils/trace-context";

interface QueryLogRecord {
  type: "query";
  timestamp: string;
  model?: string;
  action: string;
  durationMs: number;
  traceId?: string;
  slow: boolean;
}

function createPrismaClient() {
  const client = new PrismaClient({
    log: env.LOG_QUERIES ? ["query", "error", "warn"] : ["error", "warn"]
  });

  const extended = client.$extends({
    name: "queryLogger",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const before = process.hrtime.bigint();
          const traceId = getTraceId();

          try {
            const result = await query(args);
            const after = process.hrtime.bigint();
            const durationMs = Number(after - before) / 1e6;

            const isSlow = durationMs >= env.SLOW_QUERY_THRESHOLD_MS;

            if (isSlow || env.LOG_QUERIES) {
              const record: QueryLogRecord = {
                type: "query",
                timestamp: new Date().toISOString(),
                model,
                action: operation,
                durationMs: Math.round(durationMs * 100) / 100,
                traceId,
                slow: isSlow
              };

              if (isSlow) {
                console.warn(JSON.stringify(record));
              } else {
                console.log(JSON.stringify(record));
              }
            }

            return result;
          } catch (error) {
            const after = process.hrtime.bigint();
            const durationMs = Number(after - before) / 1e6;

            const record: QueryLogRecord & { error?: string } = {
              type: "query",
              timestamp: new Date().toISOString(),
              model,
              action: operation,
              durationMs: Math.round(durationMs * 100) / 100,
              traceId,
              slow: durationMs >= env.SLOW_QUERY_THRESHOLD_MS,
              error: error instanceof Error ? error.message : String(error)
            };

            console.error(JSON.stringify(record));
            throw error;
          }
        }
      }
    }
  });

  return extended as unknown as PrismaClient;
}

export const prisma = createPrismaClient();
