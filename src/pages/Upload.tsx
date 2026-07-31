import React, { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload as UploadIcon,
  FileBox,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useProject } from "../context/ProjectContext";

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

type FileState = {
  id: string;
  file: File;
  status: "idle" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
  serverPath?: string;
};

export function Upload() {
  const navigate = useNavigate();
  const { setPlyFile, setCurrentJobId, setJobStatus, setPipelineStats } = useProject();

  const [dragActive, setDragActive] = useState(false);
  const [fileState, setFileState] = useState<FileState | null>(null);
  const [globalError, setGlobalError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFileState(null);
    setGlobalError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const validateAndSet = (selected: File[]) => {
    setGlobalError("");
    const f = selected[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".ply")) {
      setGlobalError("Only .ply files are supported.");
      return;
    }
    setFileState({ id: crypto.randomUUID(), file: f, status: "idle", progress: 0 });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0)
      validateAndSet(Array.from(e.dataTransfer.files));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0)
      validateAndSet(Array.from(e.target.files));
  };

  const uploadFile = useCallback(async () => {
    if (!fileState || fileState.status !== "idle") return;
    const { file } = fileState;

    setFileState((p) => p && { ...p, status: "uploading", progress: 10 });

    // Fake progress ticks
    const interval = setInterval(() => {
      setFileState((p) =>
        p && p.status === "uploading"
          ? { ...p, progress: Math.min(p.progress + 8, 88) }
          : p
      );
    }, 300);

    try {
      const form = new FormData();
      form.append("ply", file);
      const res = await fetch("/api/upload-ply", { method: "POST", body: form });
      clearInterval(interval);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      setFileState((p) => p && { ...p, status: "success", progress: 100, serverPath: data.path });

      // Save to global context
      setPlyFile({ serverPath: data.path, name: data.name, size: data.size });
      // Reset any stale job
      setCurrentJobId(null);
      setJobStatus("idle");
      setPipelineStats(null);
    } catch (err) {
      clearInterval(interval);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setFileState((p) => p && { ...p, status: "error", error: msg });
    }
  }, [fileState, setPlyFile, setCurrentJobId, setJobStatus, setPipelineStats]);

  const goToCommand = () => navigate("/");

  const statusColor: Record<string, string> = {
    idle: "border-hairline",
    uploading: "border-primary/60",
    success: "border-green-500/60",
    error: "border-red-500/60",
  };

  return (
    <div className="flex flex-col flex-1 p-6 lg:p-14 h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <FileBox size={22} className="text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-ink">Upload Scene</h1>
          </div>
          <p className="text-mute text-base leading-relaxed">
            Upload a 3D Gaussian Splat{" "}
            <code className="font-mono bg-canvas-soft px-1.5 py-0.5 rounded text-primary text-sm">
              .ply
            </code>{" "}
            file. The pipeline will use it as the base scene to remove objects from.
          </p>
        </div>

        {/* Error banner */}
        {globalError && (
          <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-6 text-sm">
            <AlertCircle size={16} />
            {globalError}
          </div>
        )}

        {/* Drop zone – hidden when a file is selected */}
        {!fileState && (
          <div
            className={cn(
              "relative w-full rounded-2xl border-2 border-dashed p-16 flex flex-col items-center justify-center transition-all cursor-pointer select-none",
              dragActive
                ? "border-primary bg-primary/5 shadow-[0_0_32px_rgba(34,211,238,0.12)]"
                : "border-hairline hover:border-primary/40 bg-canvas-soft/40"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".ply"
              className="hidden"
              onChange={handleChange}
            />
            <div className="w-20 h-20 rounded-2xl bg-canvas border border-primary/20 flex items-center justify-center mb-6 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
              <UploadIcon size={36} className="text-primary" />
            </div>
            <h3 className="text-xl font-bold text-ink mb-2 text-center">
              Drag &amp; drop your <span className="text-primary">.ply</span> file here
            </h3>
            <p className="text-mute text-sm mb-6 text-center">
              Or click to browse. Supports binary &amp; ASCII PLY — any size.
            </p>
            <span className="bg-canvas border border-hairline text-ink font-medium px-5 py-2.5 rounded-lg text-sm hover:bg-canvas-soft transition-colors">
              Browse Files
            </span>
          </div>
        )}

        {/* File card */}
        {fileState && (
          <div
            className={cn(
              "w-full rounded-2xl border bg-canvas-soft p-6 transition-all",
              statusColor[fileState.status]
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-canvas border border-primary/20 flex items-center justify-center shrink-0">
                  <FileBox size={24} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-ink truncate text-sm">
                    {fileState.file.name}
                  </div>
                  <div className="font-mono text-xs text-mute mt-0.5">
                    {fmtBytes(fileState.file.size)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {fileState.status === "success" && (
                  <CheckCircle2 size={22} className="text-green-400" />
                )}
                {fileState.status === "error" && (
                  <AlertCircle size={22} className="text-red-400" />
                )}
                {(fileState.status === "idle" || fileState.status === "error") && (
                  <button
                    onClick={reset}
                    className="p-1.5 text-mute hover:text-red-400 rounded-lg hover:bg-canvas transition-colors"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {fileState.status === "uploading" && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-mute font-mono mb-1.5">
                  <span>Uploading…</span>
                  <span>{fileState.progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                    style={{ width: `${fileState.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error detail */}
            {fileState.error && (
              <div className="mt-3 text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle size={13} />
                {fileState.error}
              </div>
            )}

            {/* Success detail */}
            {fileState.status === "success" && (
              <div className="mt-3 text-xs text-green-400 flex items-center gap-1.5">
                <CheckCircle2 size={13} />
                Uploaded — ready to run the pipeline.
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {fileState && (
          <div className="mt-6 flex flex-col gap-3">
            {fileState.status === "idle" && (
              <button
                onClick={uploadFile}
                className="w-full bg-primary text-on-primary font-bold text-base rounded-xl py-3.5 flex items-center justify-center gap-2.5 hover:bg-primary-soft transition-colors active:scale-95 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
              >
                <UploadIcon size={18} />
                Upload PLY File
              </button>
            )}

            {fileState.status === "error" && (
              <button
                onClick={uploadFile}
                className="w-full bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-base rounded-xl py-3.5 flex items-center justify-center gap-2.5 hover:bg-red-500/20 transition-colors active:scale-95"
              >
                Retry Upload
              </button>
            )}

            {fileState.status === "success" && (
              <button
                onClick={goToCommand}
                className="w-full bg-primary text-on-primary font-bold text-base rounded-xl py-3.5 flex items-center justify-center gap-2.5 hover:bg-primary-soft transition-colors active:scale-95 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
              >
                <Sparkles size={18} />
                Continue to Run Pipeline
                <ArrowRight size={18} />
              </button>
            )}

            {fileState.status !== "success" && (
              <button
                onClick={reset}
                className="w-full bg-transparent border border-hairline text-mute font-medium text-sm rounded-xl py-2.5 hover:bg-canvas-soft transition-colors"
              >
                Choose a different file
              </button>
            )}
          </div>
        )}

        {/* Tips */}
        <div className="mt-10 rounded-xl bg-canvas-soft/50 border border-hairline p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={15} className="text-primary" />
            <span className="text-xs font-semibold text-ink uppercase tracking-wider">
              Tips
            </span>
          </div>
          <ul className="text-mute text-sm space-y-1.5 list-disc list-inside">
            <li>Use the exported PLY from NeRFStudio or Gaussian Splatting training</li>
            <li>
              After upload, go to <strong className="text-ink">Run Pipeline</strong> and type
              your removal command (e.g. <em className="text-primary">"remove the truck"</em>)
            </li>
            <li>Larger files take longer — the SSE terminal will stream live progress</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
