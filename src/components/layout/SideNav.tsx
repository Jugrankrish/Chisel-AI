import { NavLink, useNavigate } from "react-router-dom";
import {
  Network,
  Plus,
  FileBox,
  BarChart3,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Box,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useProject } from "../../context/ProjectContext";

const STATUS_META = {
  idle: { color: "text-mute", bg: "bg-mute/10", label: "Idle", Icon: null },
  running: { color: "text-yellow-400", bg: "bg-yellow-400/10", label: "Running…", Icon: Loader2 },
  done: { color: "text-green-400", bg: "bg-green-400/10", label: "Complete", Icon: CheckCircle2 },
  error: { color: "text-red-400", bg: "bg-red-400/10", label: "Error", Icon: AlertCircle },
} as const;

export function SideNav() {
  const navigate = useNavigate();
  const { plyFile, jobStatus, resetProject } = useProject();

  const meta = STATUS_META[jobStatus];

  const handleNew = () => {
    resetProject();
    navigate("/upload");
  };

  const navItems = [
    { icon: FileBox, label: "Upload PLY", to: "/upload" },
    { icon: Play, label: "Run Pipeline", to: "/" },
    { icon: BarChart3, label: "Results", to: "/visualize" },
    { icon: Network, label: "Pipeline", to: "/pipeline" },
  ];

  return (
    <aside className="bg-canvas border-r border-hairline h-full w-[240px] shrink-0 hidden md:flex flex-col p-4 relative z-40">
      {/* Project info */}
      <div className="flex items-center gap-3 mb-8 p-2">
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
          <span className="text-primary font-black text-base">C</span>
        </div>
        <div className="min-w-0">
          <div className="text-ink font-bold text-[13px] truncate">Chisel AI</div>
          <div className="text-mute font-mono text-[11px] truncate">3D Scene Editor</div>
        </div>
      </div>

      {/* New Scene button */}
      <button
        onClick={handleNew}
        className="w-full bg-primary text-on-primary font-bold text-[14px] py-2.5 rounded-lg mb-6 hover:bg-primary-soft transition-colors cursor-pointer active:scale-95 flex justify-center items-center gap-2 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
      >
        <Plus size={16} strokeWidth={3} />
        New Scene
      </button>

      {/* PLY file indicator */}
      {plyFile && (
        <div className="mb-4 bg-canvas-soft border border-primary/20 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-2">
            <FileBox size={13} className="text-primary shrink-0" />
            <span className="text-[11px] font-mono text-primary truncate">{plyFile.name}</span>
          </div>
          <div className="text-[10px] font-mono text-mute mt-0.5 pl-[21px]">Loaded</div>
        </div>
      )}

      {/* Primary Nav */}
      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={label}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-mono transition-colors",
                isActive
                  ? "bg-canvas-soft text-primary border border-primary/20"
                  : "text-mute hover:bg-canvas-soft hover:text-ink border border-transparent"
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Job status badge */}
      <div className="mt-4 pt-4 border-t border-hairline">
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2.5 transition-all",
            meta.bg
          )}
        >
          {meta.Icon && (
            <meta.Icon
              size={13}
              className={cn(meta.color, jobStatus === "running" && "animate-spin")}
            />
          )}
          {!meta.Icon && <div className="w-3 h-3 rounded-full bg-mute/30" />}
          <div className="min-w-0">
            <div className={cn("text-[11px] font-mono font-semibold", meta.color)}>
              {meta.label}
            </div>
            <div className="text-[10px] text-mute font-mono">Pipeline status</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
