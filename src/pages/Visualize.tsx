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
