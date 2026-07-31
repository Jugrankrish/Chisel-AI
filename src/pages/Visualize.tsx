<<<<<<< HEAD
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  Download,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  FileBox,
  Clock,
  Trash2,
  ShieldCheck,
  Search,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useProject } from "../context/ProjectContext";

function StatCard({
  label,
  value,
  sub,
  color = "text-ink",
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-canvas-soft border border-hairline rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-mute uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-canvas flex items-center justify-center">
          <Icon size={16} className={color} />
        </div>
      </div>
      <div className={cn("text-3xl font-bold", color)}>{value}</div>
      {sub && <div className="text-xs text-mute font-mono">{sub}</div>}
    </div>
  );
}

export function Visualize() {
  const navigate = useNavigate();
  const { currentJobId, jobStatus, pipelineStats, plyFile } = useProject();

  // ── No job yet ────────────────────────────────────────────────────────────
  if (!currentJobId || jobStatus === "idle") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-12 gap-6">
        <div className="w-16 h-16 rounded-2xl bg-canvas-soft border border-hairline flex items-center justify-center">
          <BarChart3 size={28} className="text-mute" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-ink mb-2">No Results Yet</h2>
          <p className="text-mute text-sm max-w-xs leading-relaxed">
            Upload a <code className="font-mono text-primary">.ply</code> file and run the
            pipeline to see your results here.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/upload")}
            className="flex items-center gap-2 bg-primary text-on-primary font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-primary-soft transition-all active:scale-95 shadow-[0_0_16px_rgba(34,211,238,0.2)]"
          >
            <FileBox size={15} />
            Upload PLY
          </button>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 bg-canvas-soft border border-hairline text-mute font-medium px-5 py-2.5 rounded-xl text-sm hover:text-ink transition-all"
          >
            Run Pipeline
          </button>
        </div>
      </div>
    );
  }

  // ── Job running ───────────────────────────────────────────────────────────
  if (jobStatus === "running") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-12 gap-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-primary/20 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-t-primary border-primary/10 animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-ink mb-1">Pipeline Running…</h2>
          <p className="text-mute text-sm">
            Switch to <strong className="text-ink">Run Pipeline</strong> to watch live logs.
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-primary font-mono hover:underline"
        >
          <ArrowLeft size={14} />
          Back to console
        </button>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (jobStatus === "error") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-12 gap-5">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-ink mb-2">Pipeline Failed</h2>
          <p className="text-mute text-sm max-w-xs leading-relaxed">
            The pipeline exited with an error. Check the terminal in{" "}
            <strong className="text-ink">Run Pipeline</strong> for details.
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 bg-canvas-soft border border-hairline text-mute font-medium px-5 py-2.5 rounded-xl text-sm hover:text-ink transition-all"
        >
          <ArrowLeft size={14} />
          Back to console
        </button>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  const stats = pipelineStats;

  return (
    <div className="flex flex-col flex-1 p-6 lg:p-12 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <CheckCircle2 size={20} className="text-green-400" />
            </div>
            <h1 className="text-3xl font-bold text-ink">Pipeline Complete</h1>
          </div>
          <p className="text-mute text-sm ml-[52px]">
            Object removed and pruned .ply saved successfully.
          </p>
        </div>

        {/* Scene info banner */}
        {plyFile && (
          <div className="flex items-center gap-3 bg-canvas-soft border border-hairline rounded-xl px-4 py-3 mb-8">
            <FileBox size={16} className="text-primary shrink-0" />
            <span className="text-sm text-mute font-mono truncate">{plyFile.name}</span>
            {stats?.query && (
              <>
                <span className="text-hairline mx-1">→</span>
                <div className="flex items-center gap-1.5">
                  <Search size={13} className="text-primary shrink-0" />
                  <span className="text-sm text-primary font-mono">"{stats.query}"</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Stats grid */}
        {stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Total Gaussians"
              value={stats.total || "—"}
              icon={Sparkles}
              color="text-ink"
            />
            <StatCard
              label="Removed"
              value={stats.removed?.split("(")[0]?.trim() || "—"}
              sub={stats.removedPct ? `${stats.removedPct} of scene` : undefined}
              icon={Trash2}
              color="text-red-400"
            />
            <StatCard
              label="Kept"
              value={stats.kept?.split("(")[0]?.trim() || "—"}
              sub={stats.keptPct ? `${stats.keptPct} retained` : undefined}
              icon={ShieldCheck}
              color="text-green-400"
            />
            <StatCard
              label="Total Time"
              value={stats.elapsed || "—"}
              icon={Clock}
              color="text-primary"
            />
          </div>
        ) : (
          /* Fallback: pipeline done but stats weren't parsed (e.g. mock mode) */
          <div className="bg-canvas-soft border border-green-500/20 rounded-2xl p-6 mb-8 flex items-center gap-4">
            <CheckCircle2 size={24} className="text-green-400 shrink-0" />
            <div>
              <div className="text-ink font-semibold mb-0.5">Processing complete</div>
              <div className="text-mute text-sm">
                Detailed stats were not available in this run's output.
              </div>
            </div>
          </div>
        )}

        {/* Visual progress bar (removed %) */}
        {stats?.removedPct && (
          <div className="bg-canvas-soft border border-hairline rounded-2xl p-5 mb-8">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-mono text-mute uppercase tracking-wider">
                Removal Ratio
              </span>
              <span className="text-xs font-mono text-primary">{stats.removedPct} removed</span>
            </div>
            <div className="w-full h-2 bg-canvas rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)] transition-all duration-700"
                style={{
                  width: stats.removedPct?.replace("%", "")
                    ? `${Math.min(100, parseFloat(stats.removedPct))}%`
                    : "0%",
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-mono text-mute">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => window.location.href = `/api/download/${currentJobId}`}
            className="flex items-center gap-2 bg-primary text-on-primary font-bold px-6 py-3 rounded-xl text-sm hover:bg-primary-soft transition-all active:scale-95 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
          >
            <Download size={16} />
            Download Cleaned PLY
          </button>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 bg-canvas-soft border border-hairline text-mute font-medium px-6 py-3 rounded-xl text-sm hover:text-ink transition-all"
          >
            <ArrowLeft size={15} />
            Run Another Command
          </button>
        </div>

        {/* Job ID trace */}
        <div className="mt-8 pt-5 border-t border-hairline">
          <p className="font-mono text-[11px] text-mute">
            Job ID: <span className="text-ink">{currentJobId}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
=======
import { 
  Hand, 
  MousePointer2, 
  Rotate3d, 
  Grid3X3, 
  Box, 
  SkipBack, 
  Play, 
  Pause,
  SkipForward, 
  Gauge,
  Eye,
  EyeOff,
  ChevronDown,
  Download
} from "lucide-react";
import { useAnalytics } from "../hooks/useAnalytics";
import { useState, useRef, useEffect } from "react";
import { cn } from "../lib/utils";
import { useProject } from "../context/ProjectContext";

export function Visualize() {
  const { trackEvent } = useAnalytics();
  const { uploadedFiles } = useProject();
  const [layers, setLayers] = useState([
    { id: 1, name: "Vehicles", active: true, color: "#22D3EE", count: "1.2M" },
    { id: 2, name: "Buildings", active: false, color: "#859397", count: "8.4M" },
    { id: 3, name: "Pedestrians", active: false, color: "#ffb13b", count: "450k" },
  ]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "00:00:00";
    const h = Math.floor(timeInSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((timeInSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current && duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      videoRef.current.currentTime = percentage * duration;
    } else if (uploadedFiles.length === 0) {
      // Mock seek logic for the placeholder
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setProgress(Math.max(0, Math.min(100, (x / rect.width) * 100)));
    }
  };

  const toggleLayer = (id: number) => {
    setLayers(layers.map(l => l.id === id ? { ...l, active: !l.active } : l));
    trackEvent('layer_toggled', { layerId: id });
  };

  const handleExport = () => {
    trackEvent('export_clicked');
  };

  return (
    <div className="flex flex-1 flex-col lg:flex-row h-full">
      {/* Canvas Area (3D Viewport) */}
      <div className="flex-1 bg-canvas relative overflow-hidden flex flex-col">
        {/* Viewport Background */}
        <div className="absolute inset-0 z-0">
          {uploadedFiles.length > 0 ? (
            <video 
              ref={videoRef}
              src={uploadedFiles[0].path} 
              autoPlay 
              loop 
              muted 
              className="w-full h-full object-cover opacity-80 mix-blend-screen"
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                  setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100 || 0);
                }
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setDuration(videoRef.current.duration);
                }
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          ) : (
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAOJt1nrYtxIef5BcAeMYPx1MaXSpMW3GQ9bLh31FgEHvR0F1aRqPDrZYlTPYKCW1eqmsmDQBQ5pD6vcLpzSSF4Q5t5FOHnXA41UP3skEEoN_Igl5EHxSuK7LcKRf_32_6nrVpoVcvj4i2ZdOOM8OGq-lFG_Val4oJe63jI_SUKonXCT4-JtfAvFkLLUjAzrbCwyqmaW6asfQyhIgxC0ljM_3rIUrhocEnY5H-NvFp_B6JwOQQpibgRrw" 
              alt="3D Viewport Canvas" 
              className="w-full h-full object-cover opacity-60 mix-blend-screen"
            />
          )}
        </div>

        {/* Viewport Overlay Toolbar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex bg-canvas-soft border border-hairline rounded p-1 gap-1 shadow-lg">
          <button className="w-8 h-8 flex items-center justify-center text-primary rounded hover:bg-canvas transition-colors" title="Select">
            <MousePointer2 size={18} />
          </button>
          <button className="w-8 h-8 flex items-center justify-center text-mute rounded hover:bg-canvas transition-colors" title="Pan">
            <Hand size={18} />
          </button>
          <button className="w-8 h-8 flex items-center justify-center text-mute rounded hover:bg-canvas transition-colors" title="Orbit">
            <Rotate3d size={18} />
          </button>
          <div className="w-[1px] bg-hairline mx-1"></div>
          <button className="w-8 h-8 flex items-center justify-center text-mute rounded hover:bg-canvas transition-colors" title="Wireframe">
            <Grid3X3 size={18} />
          </button>
          <button className="w-8 h-8 flex items-center justify-center text-mute rounded hover:bg-canvas transition-colors" title="Bounding Boxes">
            <Box size={18} />
          </button>
        </div>

        {/* Bottom Transport/Timeline Controls */}
        <div className="absolute bottom-4 left-4 right-4 z-10 bg-canvas-soft border border-hairline rounded p-2 flex items-center gap-4 shadow-lg">
          <div className="flex gap-2">
            <button className="text-mute hover:text-primary transition-colors p-1">
              <SkipBack size={20} />
            </button>
            <button onClick={togglePlay} className="text-primary hover:text-primary-soft transition-colors p-1">
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button className="text-mute hover:text-primary transition-colors p-1">
              <SkipForward size={20} />
            </button>
          </div>
          <div className="flex-1 flex items-center gap-4">
            <span className="font-mono text-[12px] text-mute">{formatTime(currentTime)}</span>
            <div 
              className="flex-1 h-4 flex items-center relative cursor-pointer group"
              onClick={handleSeek}
            >
              {/* Background Track */}
              <div className="absolute left-0 right-0 h-1 bg-canvas rounded-full pointer-events-none"></div>
              {/* Progress Track */}
              <div 
                className="absolute left-0 h-1 bg-primary rounded-full group-hover:bg-primary-soft transition-colors shadow-[0_0_8px_rgba(34,211,238,0.5)] pointer-events-none"
                style={{ width: `${progress}%` }}
              ></div>
              {/* Thumb */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-primary shadow pointer-events-none transition-all group-hover:scale-125"
                style={{ left: `calc(${progress}% - 6px)` }}
              ></div>
            </div>
            <span className="font-mono text-[12px] text-mute">{formatTime(duration)}</span>
          </div>
          <div className="font-mono text-[12px] text-primary flex items-center gap-1 border border-hairline px-2 py-1 rounded bg-canvas">
            <Gauge size={16} />
            1.0x
          </div>
        </div>
      </div>

      {/* Right Side Inspectors (Fixed Layout) */}
      <aside className="w-full lg:w-[320px] bg-canvas border-l border-hairline flex flex-col shrink-0 z-20 h-full overflow-y-auto">
        {/* Layer Manager Panel */}
        <div className="p-4 border-b border-hairline">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-[20px] text-ink m-0">Semantic Layers</h3>
            <button className="text-primary hover:text-primary-soft font-mono text-[12px]">Isolate All</button>
          </div>
          <div className="flex flex-col gap-1">
            {layers.map((layer) => (
              <div 
                key={layer.id}
                className={cn(
                  "flex items-center justify-between p-2 rounded border group cursor-pointer transition-colors",
                  layer.active 
                    ? "bg-canvas border-hairline-soft" 
                    : "border-transparent hover:bg-canvas"
                )}
                onClick={() => toggleLayer(layer.id)}
              >
                <div className="flex items-center gap-2">
                  <span 
                    className="w-3 h-3 rounded-full" 
                    style={{ 
                      backgroundColor: layer.color,
                      boxShadow: layer.active ? `0 0 8px ${layer.color}80` : 'none',
                      opacity: layer.active ? 1 : 0.6
                    }}
                  ></span>
                  <span className={cn("text-[14px]", layer.active ? "text-ink" : "text-mute")}>
                    {layer.name}
                  </span>
                </div>
                <div className={cn("flex items-center gap-2 transition-opacity", layer.active ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                  <span className="font-mono text-[10px] text-mute bg-canvas px-1 rounded">{layer.count} pts</span>
                  <button className={layer.active ? "text-primary" : "text-mute hover:text-ink"}>
                    {layer.active ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Advanced Metrics Panel */}
        <div className="p-4 border-b border-hairline">
          <h3 className="font-medium text-[20px] text-ink mb-4 m-0">Pruning Analytics</h3>
          <div className="bg-canvas border border-hairline rounded p-2 mb-4 h-32 relative flex items-end">
            {/* Mock Histogram */}
            <div className="w-full flex items-end justify-between gap-[2px] h-full opacity-80 pb-6">
              {[20, 40, 85, 60, 30, 15, 10, 5].map((h, i) => (
                <div key={i} className={cn("w-full", h > 50 ? "bg-primary" : "bg-canvas-soft")} style={{ height: `${h}%` }}></div>
              ))}
            </div>
            <div className="absolute bottom-1 left-2 font-mono text-[10px] text-mute">Density Distribution</div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-canvas p-2 rounded border border-hairline">
              <div className="font-mono text-[10px] text-mute mb-1">Efficiency Rate</div>
              <div className="text-[20px] font-medium text-ink">84.2%</div>
            </div>
            <div className="bg-canvas p-2 rounded border border-hairline">
              <div className="font-mono text-[10px] text-mute mb-1">Noise Reduction</div>
              <div className="text-[20px] font-medium text-primary">-2.1M <span className="text-[10px]">pts</span></div>
            </div>
          </div>
        </div>

        {/* Export Controls Panel */}
        <div className="p-4 flex-1 flex flex-col justify-end bg-gradient-to-t from-canvas-soft to-transparent min-h-[200px]">
          <h3 className="font-medium text-[20px] text-ink mb-4 m-0">Export Scene</h3>
          
          <div className="flex gap-2 mb-4">
            {['.SPLAT', '.PLY', '.OBJ'].map(ext => (
              <button 
                key={ext}
                className={cn(
                  "flex-1 py-1 rounded font-mono text-[12px] transition-colors border",
                  ext === '.SPLAT' 
                    ? "bg-canvas border-hairline text-ink hover:bg-canvas-soft" 
                    : "bg-transparent border-hairline text-mute hover:border-hairline-soft hover:text-ink"
                )}
              >
                {ext}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between bg-canvas border border-hairline p-2 rounded mb-4 cursor-pointer group hover:border-primary transition-colors">
            <span className="text-[14px] text-mute group-hover:text-primary">High Quality (LOD 0)</span>
            <ChevronDown size={16} className="text-mute" />
          </div>

          <button 
            onClick={handleExport}
            className="w-full bg-primary text-on-primary font-bold text-[16px] rounded py-3 px-4 flex items-center justify-center gap-2 hover:bg-primary-soft transition-colors cursor-pointer active:scale-95 border-none"
          >
            <Download size={18} /> Export Pruned Assets
          </button>
        </div>
      </aside>
    </div>
  );
}
>>>>>>> b227557ce5afba356c3c02ab1e2c0ea08314c80c
