import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export const TRACE_ID_HEADER = "x-trace-id";

interface TraceStore {
  traceId: string;
}

const traceStorage = new AsyncLocalStorage<TraceStore>();

export function generateTraceId(): string {
  return randomUUID();
}

export function getTraceId(): string | undefined {
  return traceStorage.getStore()?.traceId;
}

export function runWithTraceId<R>(traceId: string, fn: () => R): R {
  return traceStorage.run({ traceId }, fn);
}

export function getTraceStore(): TraceStore | undefined {
  return traceStorage.getStore();
}
