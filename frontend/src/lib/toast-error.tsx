import { toast } from "sonner";

import { parseApiError, type ParsedApiError } from "./api-error";

function CopyableTraceId({ traceId }: { traceId: string }) {
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(traceId);
      toast.success("Trace ID 已复制到剪贴板", { duration: 1500 });
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = traceId;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success("Trace ID 已复制到剪贴板", { duration: 1500 });
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 hover:bg-slate-200 transition-colors select-all"
      title="点击复制 Trace ID"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </svg>
      {traceId.slice(0, 8)}…{traceId.slice(-6)}
    </button>
  );
}

export function toastApiError(error: unknown, defaultMessage = "操作失败") {
  const parsed = parseApiError(error);
  const message = parsed.message || defaultMessage;

  if (parsed.traceId) {
    toast.error(message, {
      description: <CopyableTraceId traceId={parsed.traceId} />,
      richColors: true,
      duration: 6000
    });
  } else {
    toast.error(message, {
      richColors: true,
      duration: 4000
    });
  }

  return parsed;
}

export type { ParsedApiError };
