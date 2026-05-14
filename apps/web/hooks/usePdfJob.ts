import { useState, useEffect, useCallback, useRef } from "react";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type JobState = {
  jobId: string;
  status: JobStatus;
  progress: number;
  message: string;
  outputs: Array<{ url: string; filename: string; size_bytes?: number }>;
  error?: string;
};

const POLL_INTERVAL = 1500;

export function usePdfJob(jobId: string | null) {
  const [job, setJob] = useState<JobState | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!jobId || isDismissed) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/bff/pdf-jobs/${encodeURIComponent(jobId)}`);
        if (!res.ok) {
          setJob((prev) => prev ? { ...prev, status: "failed", error: `Poll failed: ${res.status}` } : null);
          clearPolling();
          return;
        }
        const data = await res.json();
        setJob({
          jobId,
          status: data.status || "running",
          progress: data.progress ?? 0,
          message: data.message || "",
          outputs: data.outputs || [],
          error: data.error,
        });
        if (data.status === "succeeded" || data.status === "failed") {
          clearPolling();
        }
      } catch {
        // will retry on next interval
      }
    };

    void poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    return clearPolling;
  }, [jobId, isDismissed, clearPolling]);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    clearPolling();
  }, [clearPolling]);

  const terminal = job?.status === "succeeded" || job?.status === "failed";

  return { job, isDismissed, dismiss, terminal };
}
