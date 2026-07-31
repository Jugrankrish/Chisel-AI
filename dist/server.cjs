var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_multer = __toESM(require("multer"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_child_process = require("child_process");
var NERFSTUDIO_PYTHON = "/home/krish-jugran/Enter/envs/nerfstudio/bin/python";
var PYTHON = import_fs.default.existsSync(NERFSTUDIO_PYTHON) ? NERFSTUDIO_PYTHON : "python3";
console.log(`[server] Using Python: ${PYTHON}`);
var app = (0, import_express.default)();
var PORT = 3e3;
var uploadDir = import_path.default.join(process.cwd(), "uploads");
var outputDir = import_path.default.join(process.cwd(), "pipeline_outputs");
[uploadDir, outputDir].forEach((d) => {
  if (!import_fs.default.existsSync(d)) import_fs.default.mkdirSync(d, { recursive: true });
});
var jobs = /* @__PURE__ */ new Map();
function makeJobId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function parseStats(logs) {
  const find = (key) => {
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
    elapsed: find("Total time")
  };
}
var plyStorage = import_multer.default.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + import_path.default.extname(file.originalname));
  }
});
var uploadPly = (0, import_multer.default)({
  storage: plyStorage,
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith(".ply")) {
      cb(null, true);
    } else {
      cb(new Error("Only .ply files are allowed"));
    }
  },
  limits: { fileSize: 4 * 1024 * 1024 * 1024 }
  // 4 GB
});
app.use(import_express.default.json());
app.post("/api/upload-ply", uploadPly.single("ply"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No .ply file provided or wrong type." });
  }
  res.json({
    success: true,
    path: req.file.path,
    name: req.file.originalname,
    size: req.file.size
  });
});
app.post("/api/run-pipeline", (req, res) => {
  const {
    plyPath,
    prompt,
    imagesDir,
    colmapDir,
    llm,
    boxThreshold,
    textThreshold,
    ratio
  } = req.body;
  if (!plyPath || !prompt) {
    return res.status(400).json({ error: "plyPath and prompt are required." });
  }
  const jobId = makeJobId();
  const outputPath = import_path.default.join(outputDir, `${jobId}_cleaned.ply`);
  const job = {
    status: "running",
    logs: [],
    outputPath,
    stats: null,
    exitCode: null,
    process: null,
    sseClients: []
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
    String(ratio || "0.25")
  ];
  const proc = (0, import_child_process.spawn)(PYTHON, pythonArgs, {
    cwd: process.cwd(),
    env: { ...process.env }
  });
  job.process = proc;
  const broadcast = (line) => {
    job.logs.push(line);
    const payload = `data: ${JSON.stringify({ line })}

`;
    job.sseClients.forEach((client) => {
      try {
        client.write(payload);
      } catch (_) {
      }
    });
  };
  proc.stdout?.on("data", (chunk) => {
    chunk.toString().split("\n").filter(Boolean).forEach(broadcast);
  });
  proc.stderr?.on("data", (chunk) => {
    chunk.toString().split("\n").filter(Boolean).forEach(broadcast);
  });
  proc.on("error", (err) => {
    job.status = "error";
    job.exitCode = -1;
    broadcast(`\u2717 Failed to start process: ${err.message}`);
    broadcast("__STATUS__:error");
    job.sseClients.forEach((c) => {
      try {
        c.end();
      } catch (_) {
      }
    });
    job.sseClients = [];
  });
  proc.on("close", (code) => {
    if (job.status === "error") return;
    job.exitCode = code;
    job.status = code === 0 ? "done" : "error";
    job.stats = parseStats(job.logs);
    const statusMsg = `__STATUS__:${job.status}`;
    broadcast(statusMsg);
    job.sseClients.forEach((c) => {
      try {
        c.end();
      } catch (_) {
      }
    });
    job.sseClients = [];
  });
  res.json({ jobId });
});
app.get("/api/stream/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  job.logs.forEach((line) => {
    res.write(`data: ${JSON.stringify({ line })}

`);
  });
  if (job.status !== "running") {
    res.write(`data: ${JSON.stringify({ line: `__STATUS__:${job.status}` })}

`);
    res.end();
    return;
  }
  job.sseClients.push(res);
  req.on("close", () => {
    job.sseClients = job.sseClients.filter((c) => c !== res);
  });
});
app.get("/api/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json({ status: job.status, exitCode: job.exitCode, stats: job.stats });
});
app.get("/api/download/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || !job.outputPath) {
    return res.status(404).json({ error: "No output available." });
  }
  if (!import_fs.default.existsSync(job.outputPath)) {
    return res.status(404).json({ error: "Output file not found on disk." });
  }
  res.download(job.outputPath, "cleaned_scene.ply");
});
app.use("/uploads", import_express.default.static(uploadDir));
app.use("/outputs", import_express.default.static(outputDir));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get(
      "*",
      (_req, res) => res.sendFile(import_path.default.join(distPath, "index.html"))
    );
  }
  app.listen(
    PORT,
    "0.0.0.0",
    () => console.log(`Chisel AI server running on http://localhost:${PORT}`)
  );
}
startServer();
//# sourceMappingURL=server.cjs.map
