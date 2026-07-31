<<<<<<< HEAD
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
=======
import { NavLink } from "react-router-dom";
import { Settings, HelpCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export function TopNav() {
  return (
    <nav className="bg-canvas border-b border-hairline flex justify-between items-center w-full px-6 h-16 shrink-0 z-50 relative">
      <div className="flex items-center gap-12">
        <div className="text-[24px] font-bold text-primary tracking-tight">Chisel AI</div>
        
        <div className="hidden md:flex gap-6 items-center h-full">
          <NavLink 
            to="/upload" 
            className={({ isActive }) => cn(
              "transition-colors cursor-pointer text-[16px] flex h-full items-center",
              isActive ? "text-primary font-bold border-b-2 border-primary -mb-[2px]" : "text-mute hover:text-primary active:opacity-80"
            )}
          >
            Upload
          </NavLink>
          <NavLink 
            to="/" 
            className={({ isActive }) => cn(
              "transition-colors cursor-pointer text-[16px] flex h-full items-center",
              isActive ? "text-primary font-bold border-b-2 border-primary -mb-[2px]" : "text-mute hover:text-primary active:opacity-80"
            )}
          >
            Command
          </NavLink>
          <NavLink 
            to="/visualize" 
            className={({ isActive }) => cn(
              "transition-colors cursor-pointer text-[16px] flex h-full items-center",
              isActive ? "text-primary font-bold border-b-2 border-primary -mb-[2px]" : "text-mute hover:text-primary active:opacity-80"
            )}
          >
            Visualize
          </NavLink>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button className="text-mute hover:text-primary transition-colors cursor-pointer p-2 active:opacity-80">
          <Settings size={20} />
        </button>
        <button className="text-mute hover:text-primary transition-colors cursor-pointer p-2 active:opacity-80">
          <HelpCircle size={20} />
        </button>
        
        <div className="w-8 h-8 rounded-full overflow-hidden border border-hairline ml-2 shrink-0">
          <img 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBqW_VGcQnKX9NgipaXmiXD4TdMUC6nOFaIPZWjlBiSgPq4cNOtZMtwRuy-Vqn2XEDcz-EWMm-VV8EMV2DCYZyZXXTKb2BWiMVCPrY94nyxdQS_mqSTougyICCIsWBRCnu1y8J3NrOpqP2nxm33r2RIMw-Elh2x44uRJr5HxJdn3I-JDxSHURFFhRoU30eg7XqUh8mfUtTJKhd7xvjECTXF7eMlj6G5atG6H-k3jfg5ttrvHgkjooCTRA" 
            alt="User profile" 
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </nav>
  );
}
>>>>>>> b227557ce5afba356c3c02ab1e2c0ea08314c80c
