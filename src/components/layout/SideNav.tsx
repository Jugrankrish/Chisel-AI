import { NavLink, useNavigate } from "react-router-dom";
import { 
  Network, 
  Plus, 
  FileText, 
  LifeBuoy 
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAnalytics } from "../../hooks/useAnalytics";
import { useProject } from "../../context/ProjectContext";

export function SideNav() {
  const { trackEvent } = useAnalytics();
  const navigate = useNavigate();
  const { projectName, resetProject } = useProject();

  const handleNewScrape = () => {
    trackEvent('new_scrape_clicked');
    resetProject();
    navigate('/upload');
  };

  const navItems = [
    { icon: Network, label: "Pipeline", to: "/pipeline" },
  ];

  const footerItems = [
    { icon: FileText, label: "Docs", to: "/docs" },
    { icon: LifeBuoy, label: "Support", to: "/support" },
  ];

  return (
    <aside className="bg-canvas border-r border-hairline h-full w-[280px] shrink-0 hidden md:flex flex-col p-4 relative z-40">
      {/* Header */}
      <div className="flex items-center gap-4 mb-12 p-2">
        <div className="w-10 h-10 rounded bg-canvas-soft border border-hairline flex items-center justify-center shrink-0 overflow-hidden">
          <img 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAjGL_TaC37Gs-jsZG1ZHfay_HG4QgiEQDWChNKdZvwJsK-wSSTMzxkD0Bg9KuqeWylvLHJuA8E9diCya7LG8BXg75lwcacCcY4rYXGzjS6wZiA2q8O4HVXgtImObvt6UBOrn8IpmblMd-aw7VTVD1qRCAX25ItgOhoQt9KNtxyoTVo5NIrYs771YDdDrjRK8H6dx8yFDmQxnLy07GFbLG33Pz9PITiTAUKCGH4wjmUetzFa2hQ5bQUbw" 
            alt="Project Avatar" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <div className="text-ink font-bold text-[14px] truncate">{projectName}</div>
          <div className="text-mute font-mono text-[12px] truncate">3D Reconstruction</div>
        </div>
      </div>

      {/* New Scrape Button (moved up for better UX similar to Visualize screen design) */}
      <button 
        onClick={handleNewScrape}
        className="w-full bg-primary text-on-primary font-bold text-[16px] py-2 rounded mb-6 hover:bg-primary-soft transition-colors cursor-pointer active:scale-95 flex justify-center items-center gap-2 border-none"
      >
        <Plus size={18} strokeWidth={3} /> New Scrape
      </button>

      {/* Primary Nav */}
      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) => cn(
              "flex items-center gap-4 p-3 transition-colors cursor-pointer active:scale-95 rounded-lg font-mono text-[12px]",
              isActive 
                ? "bg-canvas-soft text-primary" 
                : "text-mute hover:bg-canvas-soft hover:text-ink"
            )}
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-hairline">
        {footerItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className="flex items-center gap-4 p-3 text-mute hover:bg-canvas-soft hover:text-ink transition-colors cursor-pointer active:scale-95 rounded-lg font-mono text-[12px]"
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
