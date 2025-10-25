const express = require("express");
const path = require("path");
const cors = require("cors");
const os = require("os");
const http = require("http");
const { Server } = require("socket.io");
const { Noise } = require("noisejs");

const app = express();
const PORT = process.env.PORT || 3000;

// Increase JSON body limit to accommodate drawings
app.use(express.json({ limit: "10mb" }));
app.use(cors());

// In-memory storage for drawings for this session
// Each drawing: { id, strokes, bounds, anchors, timestamp }
const drawings = [];

// API: fetch all drawings
app.get("/api/drawings", (req, res) => {
  res.json(drawings);
});

// API: submit a drawing
app.post("/api/drawings", (req, res) => {
  const body = req.body || {};
  if (!Array.isArray(body.strokes) || !body.bounds) {
    return res
      .status(400)
      .json({ error: "Invalid payload: expected strokes[] and bounds{}" });
  }
  const id = body.id || `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
  const item = {
    id,
    strokes: body.strokes,
    bounds: body.bounds,
    anchors: body.anchors || null,
    timestamp: Date.now(),
  };
  drawings.push(item);
  res.json({ ok: true, id });
});

// Serve static files (the p5 app)
app.use(express.static(path.join(__dirname)));

// --- Socket.IO + Authoritative Simulation ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Actor state managed on server
const actors = {}; // id -> { id, pos:{x,y}, vel:{x,y}, size:{w,h}, noise:{x,y}, noiseSpeed, speedScale }
const noise = new Noise(Math.random());
const TICK_HZ = 30;
const BROADCAST_HZ = 15;
let lastStepTs = Date.now();
let tickAccumulatorMs = 0;

function createActorForDrawing(d) {
  const w = Math.max(32, Math.ceil(d.bounds.maxX - d.bounds.minX));
  const h = Math.max(32, Math.ceil(d.bounds.maxY - d.bounds.minY));
  actors[d.id] = {
    id: d.id,
    pos: { x: Math.random() * 800 + 100, y: Math.random() * 400 + 100 },
    vel: { x: 0, y: 0 },
    size: { w, h },
    noise: { x: Math.random() * 1000, y: Math.random() * 1000 },
    noiseSpeed: 0.35, // noise UV speed
    speedScale: 100, // px/sec
  };
}

// Create actors for any drawings already present
for (const d of drawings) createActorForDrawing(d);

// When a new drawing is posted, also spawn an actor if missing
const originalPostHandler = app._router.stack.find(
  (l) => l.route && l.route.path === "/api/drawings" && l.route.methods.post
).route.stack[0].handle;

app._router.stack.find(
  (l) => l.route && l.route.path === "/api/drawings" && l.route.methods.post
).route.stack[0].handle = (req, res) => {
  originalPostHandler(req, {
    status: (...args) => res.status(...args),
    json: (payload) => {
      const body = req.body || {};
      const id = payload && payload.id ? payload.id : body.id;
      if (id && !actors[id]) {
        const found = drawings.find((d) => d.id === id);
        if (found) createActorForDrawing(found);
      }
      return res.json(payload);
    },
  });
};

setInterval(() => {
  const now = Date.now();
  const dtMs = now - lastStepTs;
  lastStepTs = now;
  tickAccumulatorMs += dtMs;
  const stepMs = 1000 / TICK_HZ;
  let stepped = false;
  while (tickAccumulatorMs >= stepMs) {
    stepSimulation(1 / TICK_HZ);
    tickAccumulatorMs -= stepMs;
    stepped = true;
  }
  if (stepped) broadcastState();
}, 1000 / TICK_HZ);

function stepSimulation(dt) {
  for (const a of Object.values(actors)) {
    const nx = noise.perlin2(a.noise.x, 0);
    const ny = noise.perlin2(a.noise.y, 0);
    a.noise.x += a.noiseSpeed * dt;
    a.noise.y += a.noiseSpeed * dt;

    const angle = nx * Math.PI; // [-1..1] -> [-PI..PI]
    const speed = (0.5 + 0.5 * ny) * a.speedScale; // px/sec
    a.vel.x = Math.cos(angle) * speed;
    a.vel.y = Math.sin(angle) * speed;

    a.pos.x += a.vel.x * dt;
    a.pos.y += a.vel.y * dt;

    // generous wrap bounds (independent of client canvas)
    const wrapW = 1920 + a.size.w;
    const wrapH = 1080 + a.size.h;
    if (a.pos.x < -a.size.w) a.pos.x = wrapW;
    if (a.pos.x > wrapW) a.pos.x = -a.size.w;
    if (a.pos.y < -a.size.h) a.pos.y = wrapH;
    if (a.pos.y > wrapH) a.pos.y = -a.size.h;
  }
}

function broadcastState() {
  // downsample to BROADCAST_HZ using time-based modulus
  const now = Date.now();
  if (now % Math.round(1000 / BROADCAST_HZ) > 20) return;
  io.emit("state", {
    t: now,
    actors: Object.values(actors).map((a) => ({
      id: a.id,
      x: a.pos.x,
      y: a.pos.y,
      vx: a.vel.x,
      vy: a.vel.y,
      w: a.size.w,
      h: a.size.h,
    })),
  });
}

io.on("connection", (socket) => {
  // Send initial snapshot
  socket.emit("state", {
    t: Date.now(),
    actors: Object.values(actors).map((a) => ({
      id: a.id,
      x: a.pos.x,
      y: a.pos.y,
      vx: a.vel.x,
      vy: a.vel.y,
      w: a.size.w,
      h: a.size.h,
    })),
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        console.log(`  Network: http://${net.address}:${PORT}`);
      }
    }
  }
});
