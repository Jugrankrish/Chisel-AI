import { NavLink } from "react-router-dom";
import { Settings, HelpCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export function TopNav() {
  return (
    <nav className="bg-canvas border-b border-hairline flex justify-between items-center w-full px-6 h-16 shrink-0 z-50 relative">
      {/* Brand + nav links */}
      <div className="flex items-center gap-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <span className="text-primary text-[13px] font-black">C</span>
          </div>
          <span className="text-[20px] font-bold text-primary tracking-tight">Chisel AI</span>
        </div>

        <div className="hidden md:flex gap-0 items-stretch h-16">
          {[
            { to: "/upload", label: "Upload PLY" },
            { to: "/", label: "Run Pipeline", end: true },
            { to: "/visualize", label: "Results" },
            { to: "/pipeline", label: "Pipeline" },
          ].map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "px-4 flex items-center text-[15px] transition-colors border-b-2 -mb-[2px]",
                  isActive
                    ? "text-primary font-semibold border-primary"
                    : "text-mute border-transparent hover:text-ink hover:border-hairline"
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Right icons */}
      <div className="flex items-center gap-3">
        <button className="text-mute hover:text-primary transition-colors p-2 rounded-lg hover:bg-canvas-soft">
          <Settings size={18} />
        </button>
        <button className="text-mute hover:text-primary transition-colors p-2 rounded-lg hover:bg-canvas-soft">
          <HelpCircle size={18} />
        </button>
        <div className="w-8 h-8 rounded-full overflow-hidden border border-hairline ml-1 shrink-0 bg-canvas-soft flex items-center justify-center">
          <span className="text-primary font-bold text-sm">K</span>
        </div>
      </div>
    </nav>
  );
}
