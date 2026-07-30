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
