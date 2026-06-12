import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env";
import { generateTraceId, getTraceId, runWithTraceId, TRACE_ID_HEADER } from "../utils/trace-context";

const SLOW_REQUEST_THRESHOLD_MS = Number(env.SLOW_REQUEST_THRESHOLD_MS ?? 1000);

interface AccessLogRecord {
  type: "access";
  timestamp: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  traceId: string;
  userId?: number;
  slow?: boolean;
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const headerTraceId = req.headers[TRACE_ID_HEADER] as string | undefined;
  const traceId = headerTraceId?.trim() || generateTraceId();

  const startTime = process.hrtime.bigint();

  res.setHeader(TRACE_ID_HEADER, traceId);

  runWithTraceId(traceId, () => {
    res.on("finish", () => {
      const durationNs = process.hrtime.bigint() - startTime;
      const durationMs = Number(durationNs) / 1e6;

      const record: AccessLogRecord = {
        type: "access",
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        traceId,
        userId: req.auth?.userId
      };

      if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
        record.slow = true;
        console.warn(JSON.stringify(record));
      } else {
        console.log(JSON.stringify(record));
      }
    });

    next();
  });
}
