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
