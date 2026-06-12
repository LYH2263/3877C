import axios from "axios";

import type { ApiErrorCode, ApiErrorResponse } from "@/types/models";

export const TRACE_ID_HEADER = "x-trace-id";

export interface ParsedApiError {
  status: number | null;
  code: ApiErrorCode | string | number | null;
  message: string;
  traceId: string | null;
}

export function parseApiError(error: unknown): ParsedApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? null;
    const data = (error.response?.data ?? null) as ApiErrorResponse | null;
    const headerTraceId = (error.response?.headers?.[TRACE_ID_HEADER] as string | undefined) ?? null;
    const bodyTraceId = data?.traceId ?? null;

    return {
      status,
      code: data?.code ?? null,
      message: data?.message ?? error.message ?? "请求失败",
      traceId: bodyTraceId || headerTraceId
    };
  }

  if (error instanceof Error) {
    return {
      status: null,
      code: null,
      message: error.message,
      traceId: null
    };
  }

  return {
    status: null,
    code: null,
    message: "请求失败",
    traceId: null
  };
}
