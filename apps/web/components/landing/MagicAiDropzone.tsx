"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  CloudArrowUpIcon,
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  CpuChipIcon,
  CommandLineIcon,
} from "@heroicons/react/24/outline";
import { InlineSpinner } from "@/components/ui/MicroUI";
import { cn } from "@/lib/utils";

type StepStatus = "pending" | "active" | "done" | "error";

interface ProgressStep {
  label: string;
  status: StepStatus;
}

interface TerminalLine {
  type: "thought" | "action" | "observation" | "system";
  content: string;
  tool?: string;
  timestamp: string;
}

type DropzoneState = "idle" | "uploading" | "planning" | "executing" | "completed" | "error";

export function MagicAiDropzone() {
  const [file, setFile] = useState<File | null>(null);
  const [instruction, setInstruction] = useState("");
  const [state, setState] = useState<DropzoneState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const addTerminalLine = useCallback((line: Omit<TerminalLine, "timestamp">) => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTerminalLines((prev) => [...prev, { ...line, timestamp }]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile);
      setErrorMessage("");
      setState("idle");
      setTerminalLines([]);
    } else {
      setErrorMessage("Please drop a valid PDF file.");
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setErrorMessage("");
      setState("idle");
      setTerminalLines([]);
    }
  }, []);

  const executeMagic = useCallback(async () => {
    if (!file || !instruction.trim()) return;

    // Check auth before doing anything — Magic AI requires a session
    const sessionRes = await fetch("/api/auth/session", { cache: "no-store" });
    if (!sessionRes.ok) {
      window.location.href = "/login?redirect=/#magic";
      return;
    }

    setState("uploading");
    setErrorMessage("");
    setTerminalLines([]);
    setProgressSteps([]);

    try {
      const createRes = await fetch("/api/bff/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: file.name }),
      });

      if (!createRes.ok) throw new Error("Failed to create document");

      const { document_id } = await createRes.json();

      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/bff/import/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload file");

      setState("planning");
      addTerminalLine({ type: "system", content: "Initializing Magic Pipeline v2.0..." });

      const magicRes = await fetch("/api/bff/toolkit/magic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id, instruction }),
      });

      if (!magicRes.ok) {
        const errData = await magicRes.json().catch(() => ({}));
        throw new Error(errData.error || "Magic execution failed");
      }

      const { job_id } = await magicRes.json();

      setState("executing");
      addTerminalLine({ type: "system", content: `Agent spawned. Job ID: ${job_id}` });

      const es = new EventSource(`/api/bff/pdf/magic/stream/${job_id}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const t = data.type;

          if (t === "thought") {
            addTerminalLine({ type: "thought", content: data.content });
            setProgressSteps((prev) => {
              const updated = [...prev];
              if (updated.length === 0) {
                updated.push({ label: data.content, status: "active" });
              } else {
                updated[updated.length - 1] = { ...updated[updated.length - 1], status: "done" };
                updated.push({ label: data.content, status: "active" });
              }
              return updated;
            });
          } else if (t === "action") {
            addTerminalLine({ type: "action", tool: data.tool, content: JSON.stringify(data.args) });
            setProgressSteps((prev) => {
              const updated: ProgressStep[] = prev.map((s) =>
                s.status === "active" ? { ...s, status: "done" as const } : s
              );
              updated.push({ label: `Running ${data.tool}...`, status: "active" });
              return updated;
            });
          } else if (t === "observation") {
            addTerminalLine({ type: "observation", content: data.content });
          } else if (t === "complete") {
            setResultUrl(data.url || "");
            setState("completed");
            addTerminalLine({ type: "system", content: "Execution success. Final result ready." });
            es.close();
          } else if (t === "error") {
            setErrorMessage(data.message || "An error occurred");
            setState("error");
            addTerminalLine({ type: "system", content: `Fatal: ${data.message}` });
            es.close();
          }
        } catch { /* ignore */ }
      };

      es.onerror = () => {
        setErrorMessage("Connection lost. Retrying engine sync...");
        es.close();
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal Error";
      setErrorMessage(message);
      setState("error");
      addTerminalLine({ type: "system", content: `Critical Error: ${message}` });
    }
  }, [file, instruction, addTerminalLine]);

  const reset = useCallback(() => {
    setFile(null);
    setInstruction("");
    setState("idle");
    setErrorMessage("");
    setResultUrl("");
    setProgressSteps([]);
    setTerminalLines([]);
    eventSourceRef.current?.close();
  }, []);

  return (
    <div className="mx-auto max-w-3xl perspective-1000">
      <div className={cn(
        "group relative rounded-2xl liquid-glass liquid-glass-noise transition-all duration-500",
        state === "executing" || state === "planning" ? "ring-1 ring-accent/20" : ""
      )}>
        {/* Aesthetic Background Detail */}
        <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity z-10">
          <CpuChipIcon className="h-6 w-6 text-accent" />
        </div>

        <div className="p-8 md:p-10 relative z-10">
          {/* Header */}
          <div className="mb-8 flex items-center gap-4">
             <div className={cn(
               "flex h-12 w-12 items-center justify-center rounded-xl border border-border-strong bg-surface/50 shadow-sm transition-transform duration-500",
               state !== "idle" && "scale-110 rotate-3 border-accent/30 shadow-accent/10"
             )}>
                <SparklesIcon className={cn("h-6 w-6", state === "idle" ? "text-text-tertiary" : "text-accent animate-pulse")} />
             </div>
             <div>
                <h2 className="font-sans text-2xl font-black tracking-tighter text-text-primary">Magic Agent</h2>
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">Agentic Orchestration Loop</p>
             </div>
          </div>

          {/* Idle State: Dropzone */}
          {state === "idle" && !file && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative flex h-64 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-300",
                isDragging
                  ? "border-accent bg-accent/5 scale-[0.99] shadow-inner"
                  : "border-border-strong hover:border-accent/50 hover:bg-surface"
              )}
            >
              <div className="mb-4 rounded-full bg-surface p-4 border border-border-subtle">
                <CloudArrowUpIcon className="h-8 w-8 text-text-tertiary" />
              </div>
              <p className="text-sm font-bold text-text-secondary">Initiate upload</p>
              <p className="mt-1 text-xs text-text-tertiary">Drop PDF binary here</p>
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileSelect} />
            </div>
          )}

          {/* File Selected & Ready */}
          {file && state === "idle" && (
            <div className="animate-reveal space-y-6">
              <div className="flex items-center gap-4 rounded-xl border border-border-subtle bg-surface/50 p-4">
                <div className="relative">
                  <DocumentTextIcon className="h-10 w-10 text-accent" />
                  <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-sans font-bold text-text-primary">{file.name}</p>
                  <p className="font-mono text-[10px] text-text-tertiary">{(file.size / 1024 / 1024).toFixed(2)} MB • READY</p>
                </div>
                <button onClick={reset} className="text-xs font-bold text-text-tertiary hover:text-red-400">Cancel</button>
              </div>

              <div className="relative">
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Tell the agent what to engineer... (e.g. 'Optimize this for mobile and redact emails')"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border-strong bg-background/50 p-5 font-sans text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-all shadow-inner"
                />
                <div className="absolute bottom-4 right-4 font-mono text-[10px] text-text-tertiary opacity-40">INPUT: PROMPT</div>
              </div>

              <button
                onClick={executeMagic}
                disabled={!instruction.trim()}
                className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-accent px-8 py-4 font-sans text-sm font-black uppercase tracking-widest text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                <CommandLineIcon className="h-5 w-5" />
                Spawn Agent
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </button>
            </div>
          )}

          {/* Active Processing: Terminal & Scanner */}
          {(state === "uploading" || state === "planning" || state === "executing") && (
            <div className="animate-fadeIn space-y-6">
               {/* Scanner Visualization */}
               <div className="flex flex-col items-center justify-center py-10 relative">
                  <div className="relative h-24 w-20 rounded border border-border-strong bg-surface flex items-center justify-center overflow-hidden">
                     <DocumentTextIcon className="h-12 w-12 text-text-tertiary" />
                     {/* Laser line animation */}
                     <div className="absolute left-0 right-0 h-[2px] bg-accent/60 shadow-[0_0_10px_var(--accent)] animate-[scan_2s_linear_infinite]" />
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <InlineSpinner className="h-4 w-4 text-accent" />
                    <span className="font-mono text-[11px] uppercase tracking-widest text-accent animate-pulse">
                       {state === "uploading" ? "Synchronizing Bytes" : "Agent reasoning..."}
                    </span>
                  </div>
                  <style jsx>{`
                    @keyframes scan {
                      0% { top: 0%; opacity: 0; }
                      10% { opacity: 1; }
                      90% { opacity: 1; }
                      100% { top: 100%; opacity: 0; }
                    }
                  `}</style>
               </div>

               {/* Terminal */}
               <div className="relative overflow-hidden rounded-xl liquid-glass-strong shadow-2xl">
                  <div className="flex h-8 items-center justify-between border-b border-border-subtle bg-surface/40 px-3">
                     <div className="flex gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-red-500/50" />
                        <div className="h-2 w-2 rounded-full bg-amber-500/50" />
                        <div className="h-2 w-2 rounded-full bg-emerald-500/50" />
                     </div>
                     <span className="font-mono text-[10px] text-text-tertiary">kernel-agent-v2.log</span>
                  </div>
                  <div
                    ref={terminalRef}
                    className="h-64 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-border-strong"
                  >
                    {terminalLines.map((line, i) => (
                      <div key={i} className="mb-1 flex items-start gap-2">
                         <span className="text-text-tertiary opacity-30 select-none">{line.timestamp}</span>
                         <div className={cn(
                           "flex-1 break-words",
                           line.type === "thought" && "text-cyan-400 italic",
                           line.type === "action" && "text-yellow-400 font-bold",
                           line.type === "observation" && "text-emerald-400",
                           line.type === "system" && "text-purple-400 uppercase font-black"
                         )}>
                            {line.type === "action" ? (
                              <span>&gt; EXEC TOOL: <span className="underline">{line.tool}</span> <span className="opacity-60">{line.content}</span></span>
                            ) : line.type === "thought" ? (
                              <span>[PLAN] {line.content}</span>
                            ) : line.type === "observation" ? (
                              <span>[OBS] {line.content}</span>
                            ) : (
                              <span>{line.content}</span>
                            )}
                         </div>
                      </div>
                    ))}
                    {state === "executing" && (
                      <div className="flex items-center gap-1 text-accent">
                         <span className="animate-pulse">_</span>
                      </div>
                    )}
                  </div>
               </div>
            </div>
          )}

          {/* Success Result */}
          {state === "completed" && (
            <div className="animate-slideUp text-center space-y-8">
               <div className="relative mx-auto h-24 w-24">
                  <div className="absolute inset-0 scale-125 bg-emerald-500/20 blur-2xl rounded-full" />
                  <div className="relative flex h-full w-full items-center justify-center rounded-2xl border-2 border-emerald-500 bg-surface shadow-lg shadow-emerald-500/10">
                     <CheckCircleIcon className="h-12 w-12 text-emerald-500" />
                  </div>
               </div>

               <div>
                  <h3 className="font-sans text-3xl font-black tracking-tight text-text-primary">Magic Synthesized</h3>
                  <p className="mt-2 font-sans text-sm font-medium text-text-secondary">The agent has successfully reconstructed your document.</p>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <a
                    href={resultUrl}
                    download
                    className="flex items-center justify-center gap-3 rounded-xl bg-accent px-6 py-4 font-sans text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-accent/20 transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    Download PDF
                  </a>
                  <button
                    onClick={reset}
                    className="rounded-xl border border-border-strong bg-surface px-6 py-4 font-sans text-sm font-black uppercase tracking-widest text-text-primary transition-all hover:bg-hover active:scale-[0.98]"
                  >
                    New Session
                  </button>
               </div>

               {/* Collapsible reasoning history */}
               <details className="text-left">
                  <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.2em] text-text-tertiary hover:text-accent transition-colors">
                     Trace Kernel History ({terminalLines.length} events)
                  </summary>
                  <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-border-subtle bg-black p-4 font-mono text-[10px] opacity-70">
                     {terminalLines.map((l, i) => (
                       <div key={i} className="mb-0.5 whitespace-pre-wrap">{`[${l.timestamp}] ${l.content}`}</div>
                     ))}
                  </div>
               </details>
            </div>
          )}

          {/* Error State */}
          {state === "error" && (
            <div className="animate-slideUp text-center space-y-6">
               <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                  <XCircleIcon className="h-10 w-10 text-red-500" />
               </div>
               <div>
                  <h3 className="font-sans text-xl font-black text-text-primary">Agent Exception</h3>
                  <p className="mt-2 font-mono text-xs text-red-400">{errorMessage}</p>
               </div>
               <button
                 onClick={reset}
                 className="inline-flex items-center justify-center rounded-xl border border-border-strong bg-surface px-8 py-3 font-sans text-xs font-black uppercase tracking-widest text-text-primary transition-all hover:bg-hover active:scale-[0.98]"
               >
                 Re-initialize Agent
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
