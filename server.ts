import express from "express";
import path from "path";
import multer from "multer";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { spawn, ChildProcess } from "child_process";

// ── Python binary: prefer nerfstudio conda env (has torch, groundingdino, SAM)
const NERFSTUDIO_PYTHON = "/home/krish-jugran/Enter/envs/nerfstudio/bin/python";
const PYTHON = fs.existsSync(NERFSTUDIO_PYTHON) ? NERFSTUDIO_PYTHON : "python3";
console.log(`[server] Using Python: ${PYTHON}`);

const app = express();
const PORT = 3000;

// ── Directory setup ────────────────────────────────────────────────────────
const uploadDir = path.join(process.cwd(), "uploads");
const outputDir = path.join(process.cwd(), "pipeline_outputs");
[uploadDir, outputDir].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── Job store ──────────────────────────────────────────────────────────────
interface PipelineStats {
  total: string;
  removed: string;
  kept: string;
  removedPct: string;
  keptPct: string;
  query: string;
  elapsed: string;
}

interface Job {
  status: "running" | "done" | "error";
  logs: string[];
  outputPath: string | null;
  stats: PipelineStats | null;
  exitCode: number | null;
  process: ChildProcess | null;
  sseClients: express.Response[];
}

const jobs = new Map<string, Job>();

function makeJobId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function parseStats(logs: string[]): PipelineStats | null {
  const find = (key: string) => {
    for (const line of logs) {
      if (line.includes(key)) {
        const match = line.match(/:\s*(.+)/);
        return match ? match[1].trim() : "";
      }
    }
    return "";
  };
  const total = find("Total Gaussians");
  if (!total) return null;
  return {
    total,
    removed: find("Removed"),
    kept: find("Kept"),
    removedPct: (find("Removed").match(/\(([^)]+)\)/) || [])[1] || "",
    keptPct: (find("Kept").match(/\(([^)]+)\)/) || [])[1] || "",
    query: find("Grounding query"),
    elapsed: find("Total time"),
  };
}

// ── Multer – PLY only ──────────────────────────────────────────────────────
const plyStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const uploadPly = multer({
  storage: plyStorage,
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith(".ply")) {
      cb(null, true);
    } else {
      cb(new Error("Only .ply files are allowed"));
    }
  },
  limits: { fileSize: 4 * 1024 * 1024 * 1024 }, // 4 GB
});

app.use(express.json());

// ── POST /api/upload-ply ──────────────────────────────────────────────────
app.post("/api/upload-ply", uploadPly.single("ply"), (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ error: "No .ply file provided or wrong type." });
  }
  res.json({
    success: true,
    path: req.file.path,
    name: req.file.originalname,
    size: req.file.size,
  });
});

// ── POST /api/run-pipeline ────────────────────────────────────────────────
app.post("/api/run-pipeline", (req, res) => {
  const {
    plyPath,
    prompt,
    imagesDir,
    colmapDir,
    llm,
    boxThreshold,
    textThreshold,
    ratio,
  } = req.body as Record<string, string>;

  if (!plyPath || !prompt) {
    return res.status(400).json({ error: "plyPath and prompt are required." });
  }

  const jobId = makeJobId();
  const outputPath = path.join(outputDir, `${jobId}_cleaned.ply`);

  const job: Job = {
    status: "running",
    logs: [],
    outputPath,
    stats: null,
    exitCode: null,
    process: null,
    sseClients: [],
  };
  jobs.set(jobId, job);

  const pythonArgs = [
    "text_removal_pipeline/pipeline.py",
    "--text",
    prompt,
    "--ply",
    plyPath,
    "--images",
    imagesDir || "data/tandt/truck/images",
    "--colmap_dir",
    colmapDir || "data/tandt/truck/sparse/0",
    "--output",
    outputPath,
    "--sam",
    "sam_vit_b_01ec64.pth",
    "--llm",
    llm || "agent",
    "--box_threshold",
    String(boxThreshold || "0.30"),
    "--text_threshold",
    String(textThreshold || "0.25"),
    "--ratio",
    String(ratio || "0.25"),
  ];

  const proc = spawn(PYTHON, pythonArgs, {
    cwd: process.cwd(),
    env: { ...process.env },
  });
  job.process = proc;

  const broadcast = (line: string) => {
    job.logs.push(line);
    const payload = `data: ${JSON.stringify({ line })}\n\n`;
    job.sseClients.forEach((client) => {
      try {
        client.write(payload);
      } catch (_) {}
    });
  };

  proc.stdout?.on("data", (chunk: Buffer) => {
    chunk.toString().split("\n").filter(Boolean).forEach(broadcast);
  });
  proc.stderr?.on("data", (chunk: Buffer) => {
    chunk.toString().split("\n").filter(Boolean).forEach(broadcast);
  });

  // Handle spawn errors (e.g. python3 not found) without crashing the server
  proc.on("error", (err: Error) => {
    job.status = "error";
    job.exitCode = -1;
    broadcast(`✗ Failed to start process: ${err.message}`);
    broadcast("__STATUS__:error");
    job.sseClients.forEach((c) => {
      try {
        c.end();
      } catch (_) {}
    });
    job.sseClients = [];
  });

  proc.on("close", (code: number | null) => {
    if (job.status === "error") return; // already handled by 'error' event
    job.exitCode = code;
    job.status = code === 0 ? "done" : "error";
    job.stats = parseStats(job.logs);
    const statusMsg = `__STATUS__:${job.status}`;
    broadcast(statusMsg);
    job.sseClients.forEach((c) => {
      try {
        c.end();
      } catch (_) {}
    });
    job.sseClients = [];
  });

  res.json({ jobId });
});

// ── GET /api/stream/:jobId (SSE) ──────────────────────────────────────────
app.get("/api/stream/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found." });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Replay all buffered logs first
  job.logs.forEach((line) => {
    res.write(`data: ${JSON.stringify({ line })}\n\n`);
  });

  if (job.status !== "running") {
    res.write(
      `data: ${JSON.stringify({ line: `__STATUS__:${job.status}` })}\n\n`,
    );
    res.end();
    return;
  }

  job.sseClients.push(res);
  req.on("close", () => {
    job.sseClients = job.sseClients.filter((c) => c !== res);
  });
});

// ── GET /api/status/:jobId ────────────────────────────────────────────────
app.get("/api/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json({ status: job.status, exitCode: job.exitCode, stats: job.stats });
});

// ── GET /api/download/:jobId ──────────────────────────────────────────────
app.get("/api/download/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || !job.outputPath) {
    return res.status(404).json({ error: "No output available." });
  }
  if (!fs.existsSync(job.outputPath)) {
    return res.status(404).json({ error: "Output file not found on disk." });
  }
  res.download(job.outputPath, "cleaned_scene.ply");
});

// ── Static uploads & outputs ──────────────────────────────────────────────
app.use("/uploads", express.static(uploadDir));
app.use("/outputs", express.static(outputDir));

// ── Health ────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// ── Dev/Prod server ───────────────────────────────────────────────────────
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) =>
      res.sendFile(path.join(distPath, "index.html")),
    );
  }
  app.listen(PORT, "0.0.0.0", () =>
    console.log(`Chisel AI server running on http://localhost:${PORT}`),
  );
}

startServer();
import express from "express";
import path from "path";
import multer from "multer";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept only video files
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed."));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for demo
  },
});

app.use(express.json());

// API route for uploading videos
app.post("/api/upload", upload.single("video"), (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No video file provided or invalid file type." });
    }

    // In a real app, we would process the video or store it in cloud storage (e.g., GCS, S3)
    // Here we just acknowledge the upload
    res.json({
      success: true,
      message: "Video uploaded successfully",
      file: {
        filename: req.file.filename,
        size: req.file.size,
        path: `/uploads/${req.file.filename}`,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload video" });
  }
});

// Serve uploaded files statically
app.use("/uploads", express.static(uploadDir));

// API routes FIRST
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
