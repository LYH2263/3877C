import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { fail } from "../utils/response";
import { getTraceId } from "../utils/trace-context";

interface ErrorLogRecord {
  type: "error";
  timestamp: string;
  method: string;
  path: string;
  status: number;
  traceId?: string;
  error: {
    message: string;
    stack?: string;
    name: string;
  };
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const traceId = getTraceId();

  if (error instanceof ZodError) {
    fail(res, 400, "请求参数不合法", error.flatten());
    return;
  }

  if (error instanceof Error) {
    const record: ErrorLogRecord = {
      type: "error",
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl || req.url,
      status: 500,
      traceId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    };

    console.error(JSON.stringify(record));

    fail(res, 500, error.message);
    return;
  }

  console.error(
    JSON.stringify({
      type: "error",
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl || req.url,
      status: 500,
      traceId,
      error: {
        message: "Unknown error",
        raw: String(error)
      }
    })
  );

  fail(res, 500, "服务器异常");
}
