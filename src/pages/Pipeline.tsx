import { motion } from "motion/react";
import { Database, Image as ImageIcon, Sparkles, BrainCircuit, Box, Type, LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

export interface FlowNode {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  glow: string;
}

const flowNodes: FlowNode[] = [
  {
    id: "input",
    title: "Data Source",
    description: "Raw .ply or COLMAP + Nerfstudio generation",
    icon: Database,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/30",
    glow: "shadow-[0_0_15px_rgba(96,165,250,0.15)]",
  },
  {
    id: "prompt",
    title: "Text Input",
    description: "Natural language query to drive the segmentation",
    icon: Type,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    glow: "shadow-[0_0_15px_rgba(34,211,238,0.15)]",
  },
  {
    id: "sam",
    title: "SAM 2D Masking",
    description: "Segment Anything processes 2D views from text prompt",
    icon: ImageIcon,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    border: "border-purple-400/30",
    glow: "shadow-[0_0_15px_rgba(192,132,252,0.15)]",
  },
  {
    id: "gs",
    title: "Clean GS Code",
    description: "Maps 2D masks into 3D Gaussian Splatting space",
    icon: BrainCircuit,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    glow: "shadow-[0_0_15px_rgba(34,211,238,0.15)]",
  },
  {
    id: "output",
    title: "Clean 3D Scene",
    description: "Final pruned scene with isolated semantic regions",
    icon: Box,
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/30",
    glow: "shadow-[0_0_15px_rgba(74,222,128,0.15)]",
  },
];

export function Pipeline() {
  return (
    <div className="flex flex-col flex-1 p-6 lg:p-12 h-full overflow-y-auto relative">
      <div className="max-w-5xl mx-auto w-full flex flex-col">
        <div className="mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-display-lg font-bold text-ink mb-4 flex items-center gap-4"
          >
            <Sparkles className="text-primary" size={40} />
            Scene Optimization Pipeline
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-body-lg text-mute max-w-2xl"
          >
            Our architecture leverages foundation models to semantically clean 3D spaces. 
            Raw point clouds are refined into pristine Gaussian Splats using text-driven masking.
          </motion.p>
        </div>

        {/* Desktop Pipeline Visualization (Hidden on Mobile) */}
        <div className="relative w-full max-w-[1000px] h-[600px] hidden lg:block mx-auto">
          {/* SVG Connecting Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="grad-blue-purple" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#C084FC" />
              </linearGradient>
              <linearGradient id="grad-blue-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#22D3EE" />
              </linearGradient>
              <linearGradient id="grad-cyan-purple" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22D3EE" />
                <stop offset="100%" stopColor="#C084FC" />
              </linearGradient>
              <linearGradient id="grad-purple-cyan" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#C084FC" />
                <stop offset="100%" stopColor="#22D3EE" />
              </linearGradient>
              <linearGradient id="grad-cyan-green" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22D3EE" />
                <stop offset="100%" stopColor="#4ADE80" />
              </linearGradient>
              <linearGradient id="grad-blue-cyan-vert" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#22D3EE" />
              </linearGradient>

              {/* Arrow Markers */}
              <marker id="arrow-sam" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#C084FC" />
              </marker>
              <marker id="arrow-gs" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#22D3EE" />
              </marker>
              <marker id="arrow-out" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#4ADE80" />
              </marker>
            </defs>

            {/* Base Paths with Markers */}
            {/* Data Source -> SAM */}
            <path d="M 280 120 L 354 120" stroke="url(#grad-blue-purple)" strokeWidth="4" fill="none" opacity="0.3" markerEnd="url(#arrow-sam)" />
            {/* Data Source -> Clean GS */}
            <path d="M 280 120 C 330 120, 330 460, 354 460" stroke="url(#grad-blue-cyan)" strokeWidth="4" fill="none" opacity="0.3" markerEnd="url(#arrow-gs)" />
            {/* Text Input -> SAM */}
            <path d="M 280 460 C 330 460, 330 120, 354 120" stroke="url(#grad-cyan-purple)" strokeWidth="4" fill="none" opacity="0.3" markerEnd="url(#arrow-sam)" />
            {/* SAM -> Clean GS */}
            <path d="M 500 200 L 500 374" stroke="url(#grad-purple-cyan)" strokeWidth="4" fill="none" opacity="0.3" markerEnd="url(#arrow-gs)" />
            {/* Clean GS -> Clean 3D Scene */}
            <path d="M 640 460 C 690 460, 690 290, 714 290" stroke="url(#grad-cyan-green)" strokeWidth="4" fill="none" opacity="0.3" markerEnd="url(#arrow-out)" />
            {/* Data Source -> Text Input */}
            <path d="M 140 200 L 140 374" stroke="url(#grad-blue-cyan-vert)" strokeWidth="4" fill="none" opacity="0.3" markerEnd="url(#arrow-gs)" />

            {/* Animated Data Flow Overlays */}
            <AnimatedFlowPath d="M 280 120 L 354 120" stroke="url(#grad-blue-purple)" />
            <AnimatedFlowPath d="M 280 120 C 330 120, 330 460, 354 460" stroke="url(#grad-blue-cyan)" />
            <AnimatedFlowPath d="M 280 460 C 330 460, 330 120, 354 120" stroke="url(#grad-cyan-purple)" />
            <AnimatedFlowPath d="M 500 200 L 500 374" stroke="url(#grad-purple-cyan)" />
            <AnimatedFlowPath d="M 640 460 C 690 460, 690 290, 714 290" stroke="url(#grad-cyan-green)" />
            <AnimatedFlowPath d="M 140 200 L 140 374" stroke="url(#grad-blue-cyan-vert)" />
          </svg>

          {/* Node Cards */}
          <div className="absolute top-[40px] left-[0px] w-[280px]">
            <NodeCard node={flowNodes[0]} delay={0.2} />
          </div>
          <div className="absolute top-[380px] left-[0px] w-[280px]">
            <NodeCard node={flowNodes[1]} delay={0.3} />
          </div>
          
          <div className="absolute top-[40px] left-[360px] w-[280px]">
            <NodeCard node={flowNodes[2]} delay={0.4} />
          </div>
          <div className="absolute top-[380px] left-[360px] w-[280px]">
            <NodeCard node={flowNodes[3]} delay={0.5} />
          </div>

          <div className="absolute top-[210px] left-[720px] w-[280px]">
            <NodeCard node={flowNodes[4]} delay={0.6} />
          </div>
        </div>

        {/* Mobile Pipeline Visualization (Stacked) */}
        <div className="lg:hidden flex flex-col gap-6 w-full max-w-sm mx-auto pb-12 z-10">
          <NodeCard node={flowNodes[0]} delay={0.2} />
          <div className="h-8 flex justify-center border-l-2 border-dashed border-hairline ml-8"></div>
          <NodeCard node={flowNodes[1]} delay={0.3} />
          <div className="h-8 flex justify-center border-l-2 border-dashed border-hairline ml-8"></div>
          <NodeCard node={flowNodes[2]} delay={0.4} />
          <div className="h-8 flex justify-center border-l-2 border-dashed border-hairline ml-8"></div>
          <NodeCard node={flowNodes[3]} delay={0.5} />
          <div className="h-8 flex justify-center border-l-2 border-dashed border-hairline ml-8"></div>
          <NodeCard node={flowNodes[4]} delay={0.6} />
        </div>
      </div>
    </div>
  );
}

function AnimatedFlowPath({ d, stroke }: { d: string, stroke: string }) {
  return (
    <motion.path
      d={d}
      stroke={stroke}
      strokeWidth="3"
      fill="none"
      strokeDasharray="8 8"
      animate={{ strokeDashoffset: [0, -16] }}
      transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
    />
  );
}

function NodeCard({ node, delay }: { node: FlowNode, delay: number }) {
  const Icon = node.icon;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={cn(
        "bg-canvas-soft border rounded-xl p-6 relative overflow-hidden group h-[160px] flex flex-col justify-center",
        node.border,
        node.glow
      )}
    >
      <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300", node.bg)} />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", node.bg)}>
            <Icon size={20} className={node.color} />
          </div>
          <h3 className="font-title-md text-[16px] text-ink font-semibold">{node.title}</h3>
        </div>
        <p className="font-body-sm text-mute leading-relaxed text-[13px]">
          {node.description}
        </p>
      </div>
    </motion.div>
  );
}

