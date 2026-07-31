/**
 * src/lib/plyParser.ts
 * Binary PLY parser optimised for 3D Gaussian Splat files.
 * Handles binary_little_endian format, extracts positions + colours.
 *
 * For 3DGS PLY the colour is derived from the DC spherical-harmonic
 * coefficients (f_dc_0/1/2).  For plain PLY files the red/green/blue
 * uint8 properties are used if present, otherwise a default cyan is applied.
 */

export interface PLYParseResult {
  positions: Float32Array;   // interleaved x,y,z for each point
  colors: Float32Array;      // interleaved r,g,b in [0,1] for each point
  count: number;             // actual number of points stored
  totalVertices: number;     // vertex count in the file (before subsampling)
  isSplatFormat: boolean;    // true when f_dc_* properties are present
}

export interface ParseProgress {
  phase: "downloading" | "parsing";
  loaded: number;
  total: number;
}

// ── Type → byte size map ─────────────────────────────────────────────────
const SIZES: Record<string, number> = {
  float: 4, float32: 4,
  double: 8, float64: 8,
  int: 4, int32: 4, uint: 4, uint32: 4,
  short: 2, int16: 2, ushort: 2, uint16: 2,
  char: 1, int8: 1, uchar: 1, uint8: 1,
};

// ── Find the byte offset just after "end_header\n" ───────────────────────
function findHeaderEnd(bytes: Uint8Array): number {
  const marker = new TextEncoder().encode("end_header");
  outer: for (let i = 0; i < bytes.length - marker.length; i++) {
    for (let j = 0; j < marker.length; j++) {
      if (bytes[i + j] !== marker[j]) continue outer;
    }
    let end = i + marker.length;
    if (bytes[end] === 13) end++; // \r
    if (bytes[end] === 10) end++; // \n
    return end;
  }
  throw new Error("Could not find 'end_header' in PLY file.");
}

// ── Main parsing function ────────────────────────────────────────────────
export function parsePLYBuffer(
  buffer: ArrayBuffer,
  maxPoints = 1_500_000
): PLYParseResult {
  const bytes = new Uint8Array(buffer);
  const headerEnd = findHeaderEnd(bytes);

  const headerText = new TextDecoder().decode(bytes.slice(0, headerEnd));
  const lines = headerText.split("\n").map((l) => l.trim()).filter(Boolean);

  // ── Parse header ──────────────────────────────────────────────────────
  let vertexCount = 0;
  let isBinaryLE = false;
  const props: { name: string; type: string; size: number }[] = [];
  let inVertex = false;

  for (const line of lines) {
    if (line.startsWith("format binary_little_endian")) isBinaryLE = true;
    if (line.startsWith("format ascii"))
      throw new Error("ASCII PLY is not supported. Re-export as binary.");
    if (line.startsWith("element vertex")) {
      vertexCount = parseInt(line.split(/\s+/)[2]);
      inVertex = true;
    } else if (line.startsWith("element ") && !line.startsWith("element vertex")) {
      inVertex = false;
    }
    if (inVertex && line.startsWith("property") && !line.includes("list")) {
      const parts = line.split(/\s+/);
      props.push({ name: parts[2], type: parts[1], size: SIZES[parts[1]] ?? 4 });
    }
  }

  if (!isBinaryLE) throw new Error("Only binary_little_endian PLY is supported.");
  if (!vertexCount) throw new Error("No vertices found in PLY header.");

  // ── Compute stride & offsets ──────────────────────────────────────────
  let stride = 0;
  const off: Record<string, number> = {};
  for (const p of props) { off[p.name] = stride; stride += p.size; }

  const isSplatFormat = "f_dc_0" in off;
  const hasRGB = "red" in off;

  // All 3DGS properties are float32, so stride is divisible by 4.
  // Use direct Float32Array indexing (much faster than DataView for floats).
  const allFloat32 = stride % 4 === 0;
  const strideF = stride / 4;

  const step = vertexCount > maxPoints ? Math.ceil(vertexCount / maxPoints) : 1;
  const outCount = Math.ceil(vertexCount / step);

  const positions = new Float32Array(outCount * 3);
  const colors = new Float32Array(outCount * 3);

  const SH_C0 = 0.28209479177387814;

  if (allFloat32 && isSplatFormat) {
    // Fast path: stride as Float32Array (no DataView overhead)
    const f32 = new Float32Array(buffer, headerEnd, vertexCount * strideF);
    const xI = off["x"] >> 2, yI = off["y"] >> 2, zI = off["z"] >> 2;
    const dcR = off["f_dc_0"] >> 2, dcG = off["f_dc_1"] >> 2, dcB = off["f_dc_2"] >> 2;
    let out = 0;
    for (let i = 0; i < vertexCount && out < outCount; i += step) {
      const b = i * strideF;
      positions[out * 3]     = f32[b + xI];
      positions[out * 3 + 1] = f32[b + yI];
      positions[out * 3 + 2] = f32[b + zI];
      colors[out * 3]     = Math.max(0, Math.min(1, 0.5 + SH_C0 * f32[b + dcR]));
      colors[out * 3 + 1] = Math.max(0, Math.min(1, 0.5 + SH_C0 * f32[b + dcG]));
      colors[out * 3 + 2] = Math.max(0, Math.min(1, 0.5 + SH_C0 * f32[b + dcB]));
      out++;
    }
    return { positions, colors, count: out, totalVertices: vertexCount, isSplatFormat };
  }

  // General path: DataView
  const dv = new DataView(buffer, headerEnd);
  let out = 0;
  for (let i = 0; i < vertexCount && out < outCount; i += step) {
    const base = i * stride;
    positions[out * 3]     = dv.getFloat32(base + off["x"], true);
    positions[out * 3 + 1] = dv.getFloat32(base + off["y"], true);
    positions[out * 3 + 2] = dv.getFloat32(base + off["z"], true);

    if (isSplatFormat) {
      colors[out * 3]     = Math.max(0, Math.min(1, 0.5 + SH_C0 * dv.getFloat32(base + off["f_dc_0"], true)));
      colors[out * 3 + 1] = Math.max(0, Math.min(1, 0.5 + SH_C0 * dv.getFloat32(base + off["f_dc_1"], true)));
      colors[out * 3 + 2] = Math.max(0, Math.min(1, 0.5 + SH_C0 * dv.getFloat32(base + off["f_dc_2"], true)));
    } else if (hasRGB) {
      colors[out * 3]     = dv.getUint8(base + off["red"]) / 255;
      colors[out * 3 + 1] = dv.getUint8(base + off["green"]) / 255;
      colors[out * 3 + 2] = dv.getUint8(base + off["blue"]) / 255;
    } else {
      colors[out * 3] = 0.4; colors[out * 3 + 1] = 0.8; colors[out * 3 + 2] = 1.0;
    }
    out++;
  }

  return { positions, colors, count: out, totalVertices: vertexCount, isSplatFormat };
}

// ── Fetch + parse with progress ──────────────────────────────────────────
export async function loadAndParsePLY(
  url: string,
  maxPoints = 1_500_000,
  onProgress?: (p: ParseProgress) => void
): Promise<PLYParseResult> {
  onProgress?.({ phase: "downloading", loaded: 0, total: 0 });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching PLY`);

  const total = parseInt(res.headers.get("content-length") ?? "0");
  let buffer: ArrayBuffer;

  if (res.body && total > 0) {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.({ phase: "downloading", loaded, total });
    }
    buffer = new ArrayBuffer(loaded);
    const view = new Uint8Array(buffer);
    let offset = 0;
    for (const c of chunks) { view.set(c, offset); offset += c.byteLength; }
  } else {
    buffer = await res.arrayBuffer();
  }

  onProgress?.({ phase: "parsing", loaded: 0, total: 1 });
  // Yield the event loop so the UI can update before the sync parse
  await new Promise<void>((r) => setTimeout(r, 0));
  const result = parsePLYBuffer(buffer, maxPoints);
  onProgress?.({ phase: "parsing", loaded: 1, total: 1 });
  return result;
}
