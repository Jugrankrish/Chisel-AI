import { Outlet } from "react-router-dom";
import { TopNav } from "./TopNav";
import { SideNav } from "./SideNav";
import { useAnalytics } from "../../hooks/useAnalytics";

export function AppLayout() {
  // Initialize analytics on app load
  useAnalytics();

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-canvas text-ink">
      <TopNav />
      <div className="flex flex-1 overflow-hidden relative">
        <SideNav />
        <main className="flex-1 flex bg-canvas overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
