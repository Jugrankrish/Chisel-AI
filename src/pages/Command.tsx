<<<<<<< HEAD
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Download,
  FileBox,
  Sparkles,
  Terminal as TerminalIcon,
  Settings2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Upload,
  RefreshCw,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useProject } from "../context/ProjectContext";

// ── helpers ────────────────────────────────────────────────────────────────
function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

const STATUS_COLORS = {
  idle: "text-mute",
  running: "text-yellow-400",
  done: "text-green-400",
  error: "text-red-400",
} as const;

const STATUS_LABELS = {
  idle: "Idle – awaiting command",
  running: "Running…",
  done: "Complete",
  error: "Error",
} as const;

// ── component ─────────────────────────────────────────────────────────────
export function Command() {
  const navigate = useNavigate();
  const {
    plyFile,
    currentJobId,
    setCurrentJobId,
    jobStatus,
    setJobStatus,
    setPipelineStats,
  } = useProject();

  // Prompt & advanced settings
  const [prompt, setPrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imagesDir, setImagesDir] = useState("data/tandt/truck/images");
  const [colmapDir, setColmapDir] = useState("data/tandt/truck/sparse/0");
  const [llm, setLlm] = useState("agent");
  const [boxThreshold, setBoxThreshold] = useState("0.30");
  const [textThreshold, setTextThreshold] = useState("0.25");
  const [ratio, setRatio] = useState("0.25");

  // Terminal logs
  const [logs, setLogs] = useState<{ text: string; type: "sys" | "out" | "err" | "info" }[]>([
    { text: "Chisel AI Pipeline Console — ready.", type: "sys" },
    { text: "Upload a .ply file, type your command, then press Run.", type: "info" },
  ]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Error
  const [runError, setRunError] = useState("");

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const appendLog = useCallback(
    (text: string, type: "sys" | "out" | "err" | "info" = "out") =>
      setLogs((p) => [...p, { text, type }]),
    []
  );

  // ── Run pipeline ─────────────────────────────────────────────────────────
  const runPipeline = async () => {
    if (!plyFile) {
      setRunError("No .ply file loaded. Please upload one first.");
      return;
    }
    if (!prompt.trim()) {
      setRunError("Please enter a removal command.");
      return;
    }
    setRunError("");
    setJobStatus("running");
    setCurrentJobId(null);
    setPipelineStats(null);
    setLogs([
      { text: `▶ Running: "${prompt}"`, type: "sys" },
      { text: `  PLY: ${plyFile.name}`, type: "info" },
      { text: `  LLM backend: ${llm}`, type: "info" },
      { text: "", type: "info" },
    ]);

    try {
      const res = await fetch("/api/run-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plyPath: plyFile.serverPath,
          prompt: prompt.trim(),
          imagesDir,
          colmapDir,
          llm,
          boxThreshold,
          textThreshold,
          ratio,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Pipeline start failed");
      }

      const { jobId } = await res.json();
      setCurrentJobId(jobId);
      startSSE(jobId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setJobStatus("error");
      appendLog(`✗ ${msg}`, "err");
      setRunError(msg);
    }
  };

  // ── SSE streaming ─────────────────────────────────────────────────────────
  const startSSE = useCallback(
    (jobId: string) => {
      const es = new EventSource(`/api/stream/${jobId}`);

      es.onmessage = (e) => {
        const { line } = JSON.parse(e.data) as { line: string };

        if (line.startsWith("__STATUS__:")) {
          const status = line.split(":")[1] as "done" | "error";
          setJobStatus(status);
          appendLog(
            status === "done"
              ? "✓ Pipeline finished successfully."
              : "✗ Pipeline exited with an error.",
            status === "done" ? "sys" : "err"
          );
          es.close();

          // Fetch stats
          fetch(`/api/status/${jobId}`)
            .then((r) => r.json())
            .then((data) => {
              if (data.stats) setPipelineStats(data.stats);
            })
            .catch(() => {});
          return;
        }

        // Colour stderr lines red-ish
        const type: "out" | "err" =
          line.startsWith("WARNING") || line.startsWith("ERROR") || line.startsWith("Traceback")
            ? "err"
            : "out";
        appendLog(line, type);
      };

      es.onerror = () => {
        setJobStatus("error");
        appendLog("⚡ SSE connection lost.", "err");
        es.close();
      };
    },
    [appendLog, setJobStatus, setPipelineStats]
  );

  // ── Download ──────────────────────────────────────────────────────────────
  const download = () => {
    if (!currentJobId) return;
    window.location.href = `/api/download/${currentJobId}`;
  };

  const isRunning = jobStatus === "running";
  const isDone = jobStatus === "done";
  const isError = jobStatus === "error";

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* ── LEFT: Terminal + input ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full min-w-0 border-r border-hairline">
        {/* Toolbar */}
        <div className="h-11 bg-canvas-soft border-b border-hairline flex items-center px-4 gap-3 shrink-0">
          <TerminalIcon size={15} className="text-primary" />
          <span className="font-mono text-xs text-mute">chisel-ai / pipeline-console</span>
          <div className="ml-auto flex items-center gap-2">
            <span
              className={cn(
                "font-mono text-[11px] flex items-center gap-1.5",
                STATUS_COLORS[jobStatus]
              )}
            >
              {isRunning && <Loader2 size={11} className="animate-spin" />}
              {isDone && <CheckCircle2 size={11} />}
              {isError && <AlertCircle size={11} />}
              {STATUS_LABELS[jobStatus]}
            </span>
          </div>
        </div>

        {/* Terminal output */}
        <div
          className="flex-1 bg-[#0a0a0a] overflow-auto p-4 font-mono text-[13px] leading-6 cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          {logs.map((log, i) => (
            <div
              key={i}
              className={cn(
                "whitespace-pre-wrap break-all",
                log.type === "sys" && "text-primary",
                log.type === "info" && "text-mute",
                log.type === "out" && "text-[#d4d4d4]",
                log.type === "err" && "text-red-400"
              )}
            >
              {log.text}
            </div>
          ))}
          {isRunning && (
            <div className="flex items-center gap-2 mt-2 text-yellow-400 text-[11px]">
              <Loader2 size={11} className="animate-spin" />
              <span>Processing…</span>
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Bottom input panel */}
        <div className="border-t border-hairline bg-canvas shrink-0">
          {/* Error banner */}
          {runError && (
            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border-b border-red-500/20 px-4 py-2.5 text-xs font-mono">
              <AlertCircle size={13} />
              {runError}
            </div>
          )}

          {/* PLY badge */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-hairline">
            {plyFile ? (
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5">
                <FileBox size={14} className="text-primary shrink-0" />
                <span className="text-xs font-mono text-primary truncate max-w-[240px]">
                  {plyFile.name}
                </span>
                <span className="text-[11px] text-mute font-mono">
                  ({fmtBytes(plyFile.size)})
                </span>
              </div>
            ) : (
              <button
                onClick={() => navigate("/upload")}
                className="flex items-center gap-2 bg-canvas-soft border border-dashed border-hairline rounded-lg px-3 py-1.5 text-xs text-mute hover:border-primary/40 hover:text-primary transition-colors"
              >
                <Upload size={13} />
                No .ply loaded — click to upload
              </button>
            )}
            {plyFile && (
              <button
                onClick={() => navigate("/upload")}
                className="text-[11px] font-mono text-mute hover:text-primary transition-colors ml-1"
              >
                Change
              </button>
            )}
          </div>

          {/* Prompt */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-start gap-3">
              <Sparkles size={16} className="text-primary mt-2.5 shrink-0" />
              <textarea
                ref={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!isRunning) runPipeline();
                  }
                }}
                placeholder='Type a command, e.g. "remove the truck" or "erase the lamp post"…'
                rows={2}
                disabled={isRunning}
                className="flex-1 bg-transparent outline-none text-ink font-mono text-[13px] resize-none placeholder:text-mute/50 disabled:opacity-60"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Advanced toggle */}
          <div className="px-4 pb-2">
            <button
              onClick={() => setShowAdvanced((p) => !p)}
              className="flex items-center gap-1.5 text-[11px] text-mute hover:text-ink transition-colors font-mono"
            >
              <Settings2 size={12} />
              Advanced
              {showAdvanced ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>

            {showAdvanced && (
              <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                {[
                  { label: "Images Dir", value: imagesDir, set: setImagesDir },
                  { label: "COLMAP Dir", value: colmapDir, set: setColmapDir },
                ].map(({ label, value, set }) => (
                  <label key={label} className="flex flex-col gap-1">
                    <span className="font-mono text-mute text-[11px]">{label}</span>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      className="bg-canvas-soft border border-hairline rounded px-2 py-1.5 font-mono text-[11px] text-ink outline-none focus:border-primary/50"
                      disabled={isRunning}
                    />
                  </label>
                ))}
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-mute text-[11px]">LLM Backend</span>
                  <select
                    value={llm}
                    onChange={(e) => setLlm(e.target.value)}
                    disabled={isRunning}
                    className="bg-canvas-soft border border-hairline rounded px-2 py-1.5 font-mono text-[11px] text-ink outline-none focus:border-primary/50"
                  >
                    {["agent", "gemini", "openai", "ollama", "none"].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-mute text-[11px]">Visual Hull Ratio</span>
                  <input
                    type="number"
                    min="0.05"
                    max="0.99"
                    step="0.05"
                    value={ratio}
                    onChange={(e) => setRatio(e.target.value)}
                    disabled={isRunning}
                    className="bg-canvas-soft border border-hairline rounded px-2 py-1.5 font-mono text-[11px] text-ink outline-none focus:border-primary/50"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-mute text-[11px]">Box Threshold</span>
                  <input
                    type="number"
                    min="0.05"
                    max="0.99"
                    step="0.05"
                    value={boxThreshold}
                    onChange={(e) => setBoxThreshold(e.target.value)}
                    disabled={isRunning}
                    className="bg-canvas-soft border border-hairline rounded px-2 py-1.5 font-mono text-[11px] text-ink outline-none focus:border-primary/50"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-mute text-[11px]">Text Threshold</span>
                  <input
                    type="number"
                    min="0.05"
                    max="0.99"
                    step="0.05"
                    value={textThreshold}
                    onChange={(e) => setTextThreshold(e.target.value)}
                    disabled={isRunning}
                    className="bg-canvas-soft border border-hairline rounded px-2 py-1.5 font-mono text-[11px] text-ink outline-none focus:border-primary/50"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Action row */}
          <div className="flex items-center gap-3 px-4 py-3 border-t border-hairline">
            <button
              onClick={runPipeline}
              disabled={isRunning || !plyFile || !prompt.trim()}
              className={cn(
                "flex items-center gap-2 font-bold px-6 py-2.5 rounded-xl text-sm transition-all active:scale-95",
                isRunning
                  ? "bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 cursor-not-allowed"
                  : "bg-primary text-on-primary hover:bg-primary-soft shadow-[0_0_16px_rgba(34,211,238,0.25)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              )}
            >
              {isRunning ? (
                <><Loader2 size={15} className="animate-spin" /> Running…</>
              ) : (
                <><Play size={15} fill="currentColor" /> Run Pipeline</>
              )}
            </button>

            {isDone && currentJobId && (
              <button
                onClick={download}
                className="flex items-center gap-2 font-bold px-6 py-2.5 rounded-xl text-sm bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-all active:scale-95"
              >
                <Download size={15} />
                Download Cleaned PLY
              </button>
            )}

            {(isDone || isError) && (
              <button
                onClick={() => {
                  setJobStatus("idle");
                  setCurrentJobId(null);
                  setPipelineStats(null);
                  setPrompt("");
                  setLogs([
                    { text: "Chisel AI Pipeline Console — ready.", type: "sys" },
                    { text: "Upload a .ply file, type your command, then press Run.", type: "info" },
                  ]);
                }}
                className="flex items-center gap-2 text-sm text-mute hover:text-ink font-mono transition-colors px-3 py-2.5"
              >
                <RefreshCw size={14} />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Info sidebar ───────────────────────────────────────────── */}
      <div className="w-[280px] shrink-0 hidden lg:flex flex-col border-l border-hairline bg-canvas h-full overflow-hidden">
        {/* Pipeline steps */}
        <div className="border-b border-hairline">
          <div className="h-10 bg-canvas-soft border-b border-hairline flex items-center px-4">
            <span className="font-mono text-[11px] text-ink font-bold uppercase tracking-wider">
              Pipeline Steps
            </span>
          </div>
          <div className="p-3 flex flex-col gap-1">
            {[
              { n: 1, label: "Refine text → grounding query", active: isRunning || isDone || isError },
              { n: 2, label: "Generate cameras.json (COLMAP)", active: isRunning || isDone || isError },
              { n: 3, label: "GroundingDINO + SAM segmentation", active: isRunning || isDone || isError },
              { n: 4, label: "Remove Gaussians (3D projection)", active: isDone || isError },
            ].map(({ n, label, active }) => (
              <div key={n} className="flex items-start gap-2.5 py-1.5 px-2">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 transition-all",
                    active
                      ? "bg-primary/20 text-primary border border-primary/40"
                      : "bg-canvas-soft text-mute border border-hairline"
                  )}
                >
                  {n}
                </div>
                <span className={cn("text-[12px] leading-5", active ? "text-ink" : "text-mute")}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex-1 overflow-auto">
          <div className="h-10 bg-canvas-soft border-b border-hairline flex items-center px-4">
            <span className="font-mono text-[11px] text-ink font-bold uppercase tracking-wider">
              Quick Presets
            </span>
          </div>
          <div className="p-2 flex flex-col gap-1.5">
            {[
              "remove the truck",
              "remove the car",
              "erase the lamp post",
              "delete the bench",
              "remove all pedestrians",
              "remove the sign",
              "erase the trash can",
            ].map((preset) => (
              <button
                key={preset}
                disabled={isRunning}
                onClick={() => setPrompt(preset)}
                className="text-left px-3 py-2 rounded-lg text-[12px] font-mono text-mute hover:bg-canvas-soft hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-transparent hover:border-primary/20"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Status footer */}
        <div className="border-t border-hairline p-3 bg-canvas-soft">
          <div className="flex items-center gap-2">
            {isRunning && <Loader2 size={12} className="animate-spin text-yellow-400" />}
            {isDone && <CheckCircle2 size={12} className="text-green-400" />}
            {isError && <AlertCircle size={12} className="text-red-400" />}
            {jobStatus === "idle" && <div className="w-3 h-3 rounded-full bg-mute/30" />}
            <span className={cn("font-mono text-[11px]", STATUS_COLORS[jobStatus])}>
              {STATUS_LABELS[jobStatus]}
            </span>
          </div>
          {currentJobId && (
            <div className="mt-1.5 font-mono text-[10px] text-mute">
              Job: {currentJobId}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
=======
import React, { useState, useRef, useEffect } from "react";
import { AlignLeft, Settings, Play, Bookmark, Terminal as TerminalIcon, Sparkles, GripVertical } from "lucide-react";
import { useAnalytics } from "../hooks/useAnalytics";
import { cn } from "../lib/utils";

export function Command() {
  const { trackEvent } = useAnalytics();

  // Main Terminal State
  const [terminalHistory, setTerminalHistory] = useState<string[]>([
    "Chisel AI Natural Language Processor v4.2.1",
    "Connected to Kernel.",
    "Describe what you want to do in natural language (e.g., 'remove all cars' or 'isolate the buildings').",
    ""
  ]);
  const [currentInput, setCurrentInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const mainTerminalEndRef = useRef<HTMLDivElement>(null);

  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isDragging, setIsDragging] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = document.body.clientWidth - e.clientX;
      if (newWidth > 250 && newWidth < 800) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    mainTerminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalHistory]);

  const handleMainTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const cmd = currentInput.trim();
      
      if (cmd.toLowerCase() === 'clear') {
        setTerminalHistory([]);
        trackEvent('terminal_cleared');
      } else if (cmd !== '') {
        const newHistory = [...terminalHistory, `> ${cmd}`];
        setTerminalHistory(newHistory);
        trackEvent('command_executed', { command: cmd });
        
        // Mock natural language command execution
        setTimeout(() => {
          if (cmd.toLowerCase() === 'help') {
            setTerminalHistory(prev => [...prev, "Available commands: clear, help, status. Or just type what you want to do!"]);
          } else if (cmd.toLowerCase() === 'status') {
            setTerminalHistory(prev => [...prev, "Kernel: Ready", "Active processes: 0", "Memory: 14% used"]);
          } else {
            setTerminalHistory(prev => [
              ...prev, 
              `Interpreting intent...`, 
              `Generated Directive: RUN scene_optimizer WITH target="${cmd.split(' ').slice(-1)[0] || 'all'}"`,
              "Executing...", 
              "Done."
            ]);
          }
        }, 400);
      } else {
        setTerminalHistory(prev => [...prev, `> `]);
      }
      setCurrentInput('');
    }
  };

  const handleExecute = () => {
    const cmd = "run directive scene_prune.chsl";
    setTerminalHistory(prev => [...prev, `> ${cmd}`, "Executing directive...", "Optimization complete. Mesh generated."]);
    trackEvent('directive_executed', { directive: 'scene_prune.chsl' });
    setLogs(prev => [...prev, { type: 'info', text: '[INFO] Executing directive scene_prune.chsl...' }]);
  };

  // Output Log Terminal State
  const [logs, setLogs] = useState([
    { type: 'sys', text: 'Initialize Chisel_Engine v4.2.1... OK' },
    { type: 'sys', text: 'Loading model weights... OK' },
    { type: 'info', text: '[INFO] Awaiting execution directive...' },
  ]);
  const [logInput, setLogInput] = useState('');
  const logTerminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logTerminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleLogTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const cmd = logInput.trim();
      if (cmd.toLowerCase() === 'clear') {
        setLogs([]);
      } else if (cmd !== '') {
        setLogs([...logs, { type: 'cmd', text: `> ${cmd}` }]);
        setTimeout(() => setLogs(prev => [...prev, { type: 'sys', text: `Unknown command: ${cmd}` }]), 200);
      }
      setLogInput('');
    }
  };

  return (
    <div className="flex flex-1 flex-col lg:flex-row h-full">
      {/* Central Command Console */}
      <div className="flex-1 flex flex-col border-r border-hairline min-w-0 h-full relative">
        {/* Toolbar */}
        <div className="h-12 bg-canvas flex items-center px-4 border-b border-hairline gap-2 shrink-0">
          <span className="font-mono text-[12px] text-mute mr-auto">/directives/console</span>
          <button className="text-primary hover:bg-canvas-soft p-1 rounded transition-colors" title="Format Code">
            <AlignLeft size={18} />
          </button>
          <div className="w-px h-4 bg-hairline mx-1"></div>
          <button className="text-mute hover:text-ink hover:bg-canvas-soft p-1 rounded transition-colors" title="Settings">
            <Settings size={18} />
          </button>
        </div>

        {/* Terminal Area */}
        <div 
          className="flex-1 bg-canvas overflow-auto p-4 relative group font-mono text-[14px] leading-[24px] cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          {terminalHistory.map((line, i) => (
            <div key={i} className={cn("whitespace-pre-wrap", line.startsWith('>') ? "text-primary" : "text-ink")}>
              {line}
            </div>
          ))}
          <div className="flex items-center mt-2">
            <Sparkles size={16} className="text-primary mr-2 shrink-0" />
            <input 
              ref={inputRef}
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleMainTerminalKeyDown}
              className="bg-transparent outline-none flex-1 text-ink font-mono"
              placeholder="Ask Chisel AI to manipulate the scene..."
              autoFocus
              spellCheck={false}
            />
          </div>
          <div ref={mainTerminalEndRef} />
        </div>

        {/* Action Bar - Kernel Always Visible */}
        <div className="h-24 bg-canvas border-t border-hairline flex items-center justify-between px-6 shrink-0 z-10 relative shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-4 bg-canvas-soft border border-hairline py-3 px-6 rounded-lg shadow-sm">
            <span className="w-4 h-4 rounded-full bg-primary animate-pulse shadow-[0_0_12px_rgba(34,211,238,0.6)] shrink-0"></span>
            <div className="flex flex-col">
              <span className="font-mono text-[16px] text-ink font-bold uppercase tracking-wider">Kernel: Ready</span>
              <span className="font-mono text-[12px] text-primary opacity-80">Awaiting natural language input</span>
            </div>
          </div>
          <button 
            onClick={handleExecute}
            className="bg-primary hover:bg-primary-soft text-on-primary font-bold px-8 py-4 rounded-lg transition-colors active:scale-95 flex items-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.2)] text-[16px]"
          >
            <Play size={20} fill="currentColor" /> Process Command
          </button>
        </div>
      </div>

      {/* Draggable Resizer Handle */}
      <div 
        className="hidden lg:flex w-2 bg-canvas border-x border-hairline cursor-col-resize items-center justify-center hover:bg-canvas-soft transition-colors z-20 shrink-0"
        onMouseDown={startResizing}
      >
        <GripVertical size={14} className="text-hairline" />
      </div>

      {/* Right Sidebar: Library & Logs */}
      <div 
        className="w-full lg:w-auto flex flex-col bg-canvas shrink-0 h-full"
        style={{ width: window.innerWidth >= 1024 ? sidebarWidth : '100%' }}
      >
        {/* Presets Library */}
        <div className="flex-1 flex flex-col border-b border-hairline overflow-hidden">
          <div className="h-10 border-b border-hairline flex items-center px-4 shrink-0 bg-canvas-soft">
            <span className="font-mono text-[12px] text-ink font-bold uppercase tracking-wider">Directive Library</span>
          </div>
          <div className="flex-1 overflow-auto p-2 flex flex-col gap-2">
            {[
              { name: "Remove Dynamic Objects", tags: ["vehicles", "pedestrians"], icon: Bookmark, cmd: "Remove all vehicles and pedestrians from the scan" },
              { name: "Filter Vegetation", tags: ["trees", "shrubs"], icon: Bookmark, cmd: "Filter out all trees and shrubs" },
              { name: "Isolate Structural Geo", tags: ["buildings", "ground"], icon: Bookmark, cmd: "Isolate only the buildings and the ground plane" },
            ].map((preset, i) => (
              <div 
                key={i} 
                className="bg-canvas-soft border border-hairline rounded p-2 hover:border-primary transition-colors cursor-pointer group"
                onClick={() => {
                   setTerminalHistory(prev => [...prev, `> ${preset.cmd}`, "Executing...", "Done."]);
                   trackEvent('preset_executed', { preset: preset.name });
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-medium text-[14px] text-ink group-hover:text-primary transition-colors">{preset.name}</span>
                  <preset.icon size={16} className="text-mute" />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {preset.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-canvas border border-hairline rounded font-mono text-[10px] text-mute">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Log Terminal */}
        <div className="h-1/2 flex flex-col bg-canvas">
          <div className="h-10 border-b border-hairline flex items-center px-4 shrink-0 justify-between bg-canvas-soft">
            <span className="font-mono text-[12px] text-ink font-bold uppercase tracking-wider flex items-center gap-2">
              <TerminalIcon size={16} className="text-primary" /> Output Log
            </span>
            <button onClick={() => setLogs([])} className="text-mute hover:text-ink text-[12px] uppercase font-mono">Clear</button>
          </div>
          <div className="flex-1 overflow-auto p-2 font-mono text-[11px] leading-[18px] flex flex-col text-mute cursor-text" onClick={() => document.getElementById('log-input')?.focus()}>
            {logs.map((log, i) => (
              <div key={i} className={cn("mb-1", log.type === 'cmd' ? 'text-primary' : log.type === 'info' ? 'text-primary' : 'text-mute')}>
                {log.text}
              </div>
            ))}
            <div className="flex mt-1">
              <span className="text-mute mr-2">&gt;</span>
              <input
                id="log-input"
                value={logInput}
                onChange={(e) => setLogInput(e.target.value)}
                onKeyDown={handleLogTerminalKeyDown}
                className="bg-transparent outline-none flex-1 text-mute"
                spellCheck={false}
              />
            </div>
            <div ref={logTerminalEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
>>>>>>> b227557ce5afba356c3c02ab1e2c0ea08314c80c
