const express = require("express");
const path = require("path");
const cors = require("cors");
const os = require("os");
const http = require("http");
const { Server } = require("socket.io");
const { Noise } = require("noisejs");

const app = express();
const PORT = process.env.PORT || 3000;
const WORLD = { w: 800, h: 400 }; // shared world size

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
  // create actor if missing
  if (!actors[id]) createActorForDrawing(item);
  // notify all connected clients so they can build assets immediately
  io.emit("newDrawing", item);
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
  let heading = Math.random() * Math.PI * 2;
  if (d.anchors && d.anchors.mouth && d.anchors.back) {
    const mx = d.anchors.mouth.x;
    const my = d.anchors.mouth.y;
    const bx = d.anchors.back.x;
    const by = d.anchors.back.y;
    // Face from back -> mouth so mouth is the front
    heading = Math.atan2(my - by, mx - bx);
  }
  // Compute anchor offsets relative to image center in local (unrotated) space
  let mouthOffset = { x: 0, y: 0 };
  let backOffset = { x: 0, y: 0 };
  if (d.anchors && d.anchors.mouth && d.anchors.back) {
    const localMouth = {
      x: d.anchors.mouth.x - d.bounds.minX,
      y: d.anchors.mouth.y - d.bounds.minY,
    };
    const localBack = {
      x: d.anchors.back.x - d.bounds.minX,
      y: d.anchors.back.y - d.bounds.minY,
    };
    mouthOffset = { x: localMouth.x - w / 2, y: localMouth.y - h / 2 };
    backOffset = { x: localBack.x - w / 2, y: localBack.y - h / 2 };
  }
  actors[d.id] = {
    id: d.id,
    pos: { x: Math.random() * WORLD.w, y: Math.random() * WORLD.h },
    vel: { x: 0, y: 0 },
    size: { w, h },
    heading,
    mouthOffset,
    backOffset,
    scale: 1,
    noiseH: Math.random() * 1000,
    noiseS: Math.random() * 2000,
    noiseSpeed: 0.35, // noise UV speed
    speedScale: 100, // px/sec
    turnSpeed: 1.8, // rad/sec max turn rate
  };
}

// Create actors for any drawings already present (fresh boot)
for (const d of drawings) createActorForDrawing(d);

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
  const arr = Object.values(actors);
  const eatenEvents = [];
  for (const a of arr) {
    const hNoise = noise.perlin2(a.noiseH, 0); // [-1..1]
    const sNoise = noise.perlin2(a.noiseS, 0); // [-1..1]
    a.noiseH += a.noiseSpeed * dt;
    a.noiseS += a.noiseSpeed * dt;

    const turn = hNoise * a.turnSpeed; // rad/sec
    a.heading += turn * dt;

    const speed = (0.5 + 0.5 * sNoise) * a.speedScale; // px/sec
    a.vel.x = Math.cos(a.heading) * speed;
    a.vel.y = Math.sin(a.heading) * speed;

    a.pos.x += a.vel.x * dt;
    a.pos.y += a.vel.y * dt;

    // wrap inside WORLD
    const wrapW = WORLD.w + a.size.w * a.scale;
    const wrapH = WORLD.h + a.size.h * a.scale;
    if (a.pos.x < -a.size.w) a.pos.x = wrapW;
    if (a.pos.x > wrapW) a.pos.x = -a.size.w;
    if (a.pos.y < -a.size.h) a.pos.y = wrapH;
    if (a.pos.y > wrapH) a.pos.y = -a.size.h;
  }

  // Interactions: mouth(A) overlaps back(B) -> B eaten, A grows
  const toRemove = new Set();
  for (let i = 0; i < arr.length; i++) {
    const A = arr[i];
    if (toRemove.has(A.id)) continue;
    for (let j = 0; j < arr.length; j++) {
      if (i === j) continue;
      const B = arr[j];
      if (toRemove.has(B.id)) continue;
      // compute world anchor positions
      const cosA = Math.cos(A.heading),
        sinA = Math.sin(A.heading);
      const mouthAx =
        A.pos.x + (A.mouthOffset.x * cosA - A.mouthOffset.y * sinA) * A.scale;
      const mouthAy =
        A.pos.y + (A.mouthOffset.x * sinA + A.mouthOffset.y * cosA) * A.scale;

      const cosB = Math.cos(B.heading),
        sinB = Math.sin(B.heading);
      const backBx =
        B.pos.x + (B.backOffset.x * cosB - B.backOffset.y * sinB) * B.scale;
      const backBy =
        B.pos.y + (B.backOffset.x * sinB + B.backOffset.y * cosB) * B.scale;

      const dx = mouthAx - backBx;
      const dy = mouthAy - backBy;
      const dist2 = dx * dx + dy * dy;
      const rA = Math.max(Math.min(A.size.w, A.size.h) * 0.12 * A.scale, 8);
      const rB = Math.max(Math.min(B.size.w, B.size.h) * 0.12 * B.scale, 8);
      const thresh = rA + rB;
      if (dist2 <= thresh * thresh) {
        // A eats B
        toRemove.add(B.id);
        // Grow A (cap growth to avoid runaway)
        A.scale = Math.min(A.scale * 1.15, 4);
        eatenEvents.push({ eaterId: A.id, preyId: B.id });
      }
    }
  }
  if (toRemove.size > 0) {
    for (const id of toRemove) delete actors[id];
    // notify clients immediately about eaten fish
    for (const ev of eatenEvents) io.emit("eaten", ev);
  }
}

function broadcastState() {
  // downsample to BROADCAST_HZ using time-based modulus
  const now = Date.now();
  if (now % Math.round(1000 / BROADCAST_HZ) > 20) return;
  io.emit("state", {
    t: now,
    world: WORLD,
    actors: Object.values(actors).map((a) => ({
      id: a.id,
      x: a.pos.x,
      y: a.pos.y,
      vx: a.vel.x,
      vy: a.vel.y,
      heading: a.heading,
      scale: a.scale,
      mouthOffset: a.mouthOffset,
      backOffset: a.backOffset,
      w: a.size.w,
      h: a.size.h,
    })),
  });
}

io.on("connection", (socket) => {
  // Send initial snapshot
  socket.emit("state", {
    t: Date.now(),
    world: WORLD,
    actors: Object.values(actors).map((a) => ({
      id: a.id,
      x: a.pos.x,
      y: a.pos.y,
      vx: a.vel.x,
      vy: a.vel.y,
      heading: a.heading,
      scale: a.scale,
      mouthOffset: a.mouthOffset,
      backOffset: a.backOffset,
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
