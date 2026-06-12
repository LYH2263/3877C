import type { Response } from "express";

import { getTraceId } from "./trace-context";

export function ok<T>(res: Response, data: T, message = "ok", status = 200) {
  const traceId = getTraceId();
  return res.status(status).json({
    code: 0,
    message,
    data,
    ...(traceId ? { traceId } : {})
  });
}

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE_ENTITY"
  | "SESSION_EXPIRED"
  | "SERVER_ERROR";

function resolveErrorCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "UNPROCESSABLE_ENTITY";
    default:
      return "SERVER_ERROR";
  }
}

export function fail(res: Response, status: number, message: string, details?: unknown, code?: ApiErrorCode) {
  const traceId = getTraceId();
  return res.status(status).json({
    code: code ?? resolveErrorCode(status),
    message,
    ...(details ? { details } : {}),
    ...(traceId ? { traceId } : {})
  });
}
