// Fish Fight - Draw, Anchor, Animate
// Steps:
// 1) Draw creature (freehand). UI: Next, Clear
// 2) Place anchors: Mouth, Back (draggable). UI: Next, Reset
// 3) Animate with Perlin-noise motion and edge wrap

let currentStep = 1; // 1: draw, 2: anchors, 3: animate

// Drawing data (user strokes as arrays of points)
let strokes = []; // each stroke: [{x,y}, ...]
let currentStroke = [];
let drawingBounds = null; // {minX, minY, maxX, maxY}

// UI buttons
let nextButton;
let clearButton;
let resetButton;

// Anchor handles
let mouthAnchor = { x: 0, y: 0, r: 16, label: "Mouth" };
let backAnchor = { x: 0, y: 0, r: 16, label: "Back" };
let draggingAnchor = null;

// Creature image (graphics buffer) and animation state
let creatureGfx; // p5.Graphics of the drawn creature
let creaturePos = { x: 0, y: 0 };
let creatureVel = { x: 0, y: 0 };
let noiseOffsets = { x: Math.random() * 1000, y: Math.random() * 1000 };
let noiseSpeed = 0.005;
let speedScale = 2.2;
let creatureSize = { w: 0, h: 0 };

// Multiplayer state
let actors = []; // local fallback actors
let isLoadingActors = false;
let socket;
let serverActors = new Map(); // id -> {x,y,vx,vy,heading,w,h}
let renderActors = new Map(); // id -> {gfx,size,pos}
let assetsById = {}; // id -> {gfx,size}
let world = { w: 800, h: 400 };
let biteSound;
const API_BASE =
  typeof location !== "undefined" && /^https?:\/\//i.test(location.origin)
    ? ""
    : "http://localhost:3000";

// Namespaced modules
const UI = {
  setup: setupUI,
  updateForStep: updateUIForStep,
};

const Connection = {
  connectSockets: connectSockets,
  startMultiplayer: startMultiplayer,
};

const Drawing = {
  drawHeader: drawStepHeader,
  drawArea: drawDrawingArea,
  drawStrokes: drawStrokes,
  placeDefaultAnchorsIfNeeded: placeDefaultAnchorsIfNeeded,
  drawAnchor: drawAnchor,
  computeBounds: computeBounds,
  isPointInBounds: isPointInBounds,
  rasterizeCreature: rasterizeCreature,
};

const Animation = {
  renderAllServer: renderAllServer,
  getViewport: getViewport,
  debugAnchors: true,
};

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("canvas-container");
  strokeJoin(ROUND);
  strokeCap(ROUND);
  // preload bite sound lazily once audio context is allowed by user gesture
  try {
    soundFormats("mp3");
    biteSound = loadSound("assets/cartoon_bite_sound_effect.mp3");
  } catch (e) {}

  UI.setup();
  UI.updateForStep();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(250);

  if (currentStep === 1) {
    Drawing.drawHeader(
      "Step 1: Draw your creature",
      "Use mouse/touch to draw. Click Next when done."
    );
    Drawing.drawArea();
    Drawing.drawStrokes();
  } else if (currentStep === 2) {
    Drawing.drawHeader(
      "Step 2: Place Mouth and Back",
      "Drag the labeled circles onto your drawing, then Next."
    );
    Drawing.drawArea();
    Drawing.drawStrokes();
    Drawing.placeDefaultAnchorsIfNeeded();
    Drawing.drawAnchor(mouthAnchor, color(220, 60, 60));
    Drawing.drawAnchor(backAnchor, color(60, 120, 220));
  } else if (currentStep === 3) {
    Drawing.drawHeader("Animation", "Server-synced positions.");
    if (!socket) Connection.connectSockets();
    Animation.renderAllServer();
  }
}

// ---------- UI ----------
function setupUI() {
  // Bind to HTML buttons
  const btnNext = document.getElementById("btn-next");
  const btnClear = document.getElementById("btn-clear");
  const btnReset = document.getElementById("btn-reset");
  if (btnNext) btnNext.onclick = onNext;
  if (btnClear) btnClear.onclick = onClear;
  if (btnReset) btnReset.onclick = onReset;
  nextButton = btnNext;
  clearButton = btnClear;
  resetButton = btnReset;
}

function updateUIForStep() {
  if (!nextButton || !clearButton || !resetButton) return;
  if (currentStep === 1) {
    nextButton.style.display = "inline-block";
    clearButton.style.display = "inline-block";
    resetButton.style.display = "inline-block";
    setHint("Use mouse/touch to draw. Click Next when done.");
  } else if (currentStep === 2) {
    nextButton.style.display = "inline-block";
    clearButton.style.display = "inline-block";
    resetButton.style.display = "inline-block";
    setHint("Drag mouth/back anchors to your drawing, then Next.");
  } else if (currentStep === 3) {
    nextButton.style.display = "none";
    clearButton.style.display = "none";
    resetButton.style.display = "inline-block";
    setHint("");
  }
}

function setHint(text) {
  const el = document.getElementById("ui-hint");
  if (el) el.textContent = text;
}

function onNext() {
  if (currentStep === 1) {
    if (strokes.length === 0) return; // need something drawn
    Drawing.computeBounds();
    currentStep = 2;
  } else if (currentStep === 2) {
    // Require both anchors inside bounds
    if (!drawingBounds) Drawing.computeBounds();
    if (!Drawing.isPointInBounds(mouthAnchor.x, mouthAnchor.y, drawingBounds))
      return;
    if (!Drawing.isPointInBounds(backAnchor.x, backAnchor.y, drawingBounds))
      return;
    Drawing.rasterizeCreature();
    initAnimationState();
    // Start multiplayer: upload drawing and fetch all
    Connection.startMultiplayer();
    currentStep = 3;
  }
  UI.updateForStep();
}

function onClear() {
  strokes = [];
  currentStroke = [];
  drawingBounds = null;
}

function onReset() {
  currentStep = 1;
  strokes = [];
  currentStroke = [];
  drawingBounds = null;
  creatureGfx = null;
  draggingAnchor = null;
  UI.updateForStep();
}

// ---------- Drawing phase ----------
function mousePressed() {
  if (currentStep === 2) {
    // begin dragging anchors if clicked
    const m = { x: mouseX, y: mouseY };
    if (dist(m.x, m.y, mouthAnchor.x, mouthAnchor.y) <= mouthAnchor.r) {
      draggingAnchor = mouthAnchor;
      return;
    }
    if (dist(m.x, m.y, backAnchor.x, backAnchor.y) <= backAnchor.r) {
      draggingAnchor = backAnchor;
      return;
    }
  }
  if (currentStep === 1) {
    if (isInsideDrawBox(mouseX, mouseY)) {
      currentStroke = [];
      currentStroke.push({ x: mouseX, y: mouseY });
    }
  }
}

function mouseDragged() {
  if (currentStep === 2 && draggingAnchor) {
    draggingAnchor.x = mouseX;
    draggingAnchor.y = mouseY;
    return;
  }
  if (currentStep === 1) {
    if (isInsideDrawBox(mouseX, mouseY)) {
      currentStroke.push({ x: mouseX, y: mouseY });
    }
  }
}

function mouseReleased() {
  if (currentStep === 2) {
    draggingAnchor = null;
    return;
  }
  if (currentStep === 1 && currentStroke.length > 0) {
    strokes.push(currentStroke);
    currentStroke = [];
  }
}

// touch support
function touchStarted() {
  mousePressed();
  return false;
}
function touchMoved() {
  mouseDragged();
  return false;
}
function touchEnded() {
  mouseReleased();
  return false;
}

function drawStrokes() {
  noFill();
  stroke(20);
  strokeWeight(4);
  for (let s of strokes) {
    beginShape();
    for (let p of s) vertex(p.x, p.y);
    endShape();
  }
  if (currentStroke.length > 0) {
    beginShape();
    for (let p of currentStroke) vertex(p.x, p.y);
    endShape();
  }
}

function drawDrawingArea() {
  // Fixed 150x150 drawing box centered below header
  const boxSize = 150;
  const top = 100;
  const cx = width / 2;
  const cy = top + boxSize / 2;
  const x = cx - boxSize / 2;
  const y = cy - boxSize / 2;
  push();
  noFill();
  stroke(200);
  strokeWeight(2);
  rect(x, y, boxSize, boxSize, 8);
  pop();
}

function isInsideDrawBox(px, py) {
  const boxSize = 150;
  const top = 100;
  const cx = width / 2;
  const cy = top + boxSize / 2;
  const x = cx - boxSize / 2;
  const y = cy - boxSize / 2;
  return px >= x && px <= x + boxSize && py >= y && py <= y + boxSize;
}

function drawStepHeader(titleText, subtitleText) {
  push();
  noStroke();
  fill(20);
  textAlign(LEFT, BASELINE);
  textSize(20);
  text(titleText, 16, 56);
  textSize(12);
  fill(80);
  text(subtitleText, 16, 74);
  pop();
}

function computeBounds() {
  if (strokes.length === 0) {
    drawingBounds = null;
    return;
  }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let s of strokes) {
    for (let p of s) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  // Expand slightly to include stroke thickness
  const pad = 10;
  drawingBounds = {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}

function isPointInBounds(x, y, b) {
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
}

function placeDefaultAnchorsIfNeeded() {
  if (!drawingBounds) return;
  if (mouthAnchor.x === 0 && mouthAnchor.y === 0) {
    mouthAnchor.x = drawingBounds.minX + 20;
    mouthAnchor.y = (drawingBounds.minY + drawingBounds.maxY) / 2;
  }
  if (backAnchor.x === 0 && backAnchor.y === 0) {
    backAnchor.x = drawingBounds.maxX - 20;
    backAnchor.y = (drawingBounds.minY + drawingBounds.maxY) / 2;
  }
}

function drawAnchor(anchor, c) {
  push();
  noFill();
  stroke(c);
  strokeWeight(2);
  circle(anchor.x, anchor.y, anchor.r * 2);
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(11);
  text(anchor.label, anchor.x, anchor.y - anchor.r - 12);
  pop();
}

// ---------- Rasterize creature to buffer ----------
function rasterizeCreature() {
  if (!drawingBounds) computeBounds();
  const w = Math.max(32, Math.ceil(drawingBounds.maxX - drawingBounds.minX));
  const h = Math.max(32, Math.ceil(drawingBounds.maxY - drawingBounds.minY));
  creatureSize.w = w;
  creatureSize.h = h;
  creatureGfx = createGraphics(w, h);
  creatureGfx.stroke(20);
  creatureGfx.noFill();
  creatureGfx.strokeWeight(4);
  creatureGfx.strokeJoin(ROUND);
  creatureGfx.strokeCap(ROUND);
  // Draw all strokes relative to top-left of bounds
  for (let s of strokes) {
    creatureGfx.beginShape();
    for (let p of s)
      creatureGfx.vertex(p.x - drawingBounds.minX, p.y - drawingBounds.minY);
    creatureGfx.endShape();
  }
}

function initAnimationState() {
  // Start at center
  creaturePos.x = width / 2;
  creaturePos.y = height / 2;
  creatureVel.x = 0;
  creatureVel.y = 0;
  // Align orientation by vector from mouth to back defining forward/back
  // We'll compute a heading each frame if needed; here we store anchor vector in buffer space
}

// ---------- Animation (local-only legacy) ----------
function animateCreature() {
  if (!creatureGfx) return;

  // Update velocity by Perlin noise fields
  const nx = noise(noiseOffsets.x);
  const ny = noise(noiseOffsets.y);
  noiseOffsets.x += noiseSpeed;
  noiseOffsets.y += noiseSpeed;

  const angle = map(nx, 0, 1, -PI, PI);
  const speed = map(ny, 0, 1, 0.5, 1) * speedScale;
  creatureVel.x = cos(angle) * speed;
  creatureVel.y = sin(angle) * speed;

  creaturePos.x += creatureVel.x;
  creaturePos.y += creatureVel.y;

  // Edge wrap
  if (creaturePos.x < -creatureSize.w) creaturePos.x = width + creatureSize.w;
  if (creaturePos.x > width + creatureSize.w) creaturePos.x = -creatureSize.w;
  if (creaturePos.y < -creatureSize.h) creaturePos.y = height + creatureSize.h;
  if (creaturePos.y > height + creatureSize.h) creaturePos.y = -creatureSize.h;

  // Optional subtle rotation based on velocity
  const heading = atan2(creatureVel.y, creatureVel.x);

  push();
  translate(creaturePos.x, creaturePos.y);
  rotate(heading);
  imageMode(CENTER);
  image(creatureGfx, 0, 0);
  pop();
}

// ---------- Multiplayer helpers ----------
function connectSockets() {
  try {
    const base = API_BASE || "";
    socket = io(base, { transports: ["websocket"], autoConnect: true });
    socket.on("state", (msg) => {
      if (!msg || !Array.isArray(msg.actors)) return;
      if (
        msg.world &&
        typeof msg.world.w === "number" &&
        typeof msg.world.h === "number"
      ) {
        world = { w: msg.world.w, h: msg.world.h };
      }
      for (let a of msg.actors) serverActors.set(a.id, a);
    });
    socket.on("eaten", (ev) => {
      if (!ev || !ev.preyId) return;
      // Remove prey immediately from local maps so it stops rendering
      serverActors.delete(ev.preyId);
      renderActors.delete(ev.preyId);
      // Play bite sound
      if (biteSound && biteSound.isLoaded()) {
        try {
          biteSound.play();
        } catch (e) {}
      }
    });
    // Hot-join: when a new drawing arrives, build its asset immediately
    socket.on("newDrawing", (item) => {
      if (!item || !item.id || !item.bounds || !Array.isArray(item.strokes))
        return;
      if (!assetsById[item.id]) {
        const gfxInfo = createGfxFromDrawing(item.strokes, item.bounds);
        assetsById[item.id] = { gfx: gfxInfo.gfx, size: gfxInfo.size };
      }
    });
  } catch (e) {}
}
async function startMultiplayer() {
  try {
    isLoadingActors = true;
    // Upload current drawing
    const payload = {
      strokes: strokes,
      bounds: drawingBounds,
      anchors: {
        mouth: { x: mouthAnchor.x, y: mouthAnchor.y },
        back: { x: backAnchor.x, y: backAnchor.y },
      },
    };
    await fetch(`${API_BASE}/api/drawings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});

    // Fetch all drawings
    const res = await fetch(`${API_BASE}/api/drawings`).catch(() => null);
    if (!res) {
      // Fallback: at least animate local creature
      actors = [createActorFromLocal()];
      isLoadingActors = false;
      return;
    }
    const list = await res.json();
    // build local assets map by id for rendering
    assetsById = {};
    for (let item of list) {
      const gfxInfo = createGfxFromDrawing(item.strokes, item.bounds);
      assetsById[item.id] = { gfx: gfxInfo.gfx, size: gfxInfo.size };
    }
  } catch (e) {
    // Fallback to local only: create an asset for current drawing
    if (creatureGfx) {
      assetsById = { local: { gfx: creatureGfx, size: creatureSize } };
    }
  } finally {
    isLoadingActors = false;
  }
}

function createActorFromRemote(item) {
  const gfxInfo = createGfxFromDrawing(item.strokes, item.bounds);
  return makeActor(gfxInfo.gfx, gfxInfo.size);
}

function createActorFromLocal() {
  // Use already generated creatureGfx and size
  return makeActor(creatureGfx, creatureSize);
}

function makeActor(gfx, size) {
  return {
    gfx,
    size: { w: size.w, h: size.h },
    pos: { x: random(width), y: random(height) },
    vel: { x: 0, y: 0 },
    noise: { x: Math.random() * 1000, y: Math.random() * 1000 },
    noiseSpeed: 0.005,
    speedScale: 2.2,
  };
}

function createGfxFromDrawing(srcStrokes, bounds) {
  const w = Math.max(32, Math.ceil(bounds.maxX - bounds.minX));
  const h = Math.max(32, Math.ceil(bounds.maxY - bounds.minY));
  const gfx = createGraphics(w, h);
  gfx.stroke(20);
  gfx.noFill();
  gfx.strokeWeight(4);
  gfx.strokeJoin(ROUND);
  gfx.strokeCap(ROUND);
  for (let s of srcStrokes) {
    gfx.beginShape();
    for (let p of s) gfx.vertex(p.x - bounds.minX, p.y - bounds.minY);
    gfx.endShape();
  }
  return { gfx, size: { w, h } };
}

function renderAllServer() {
  const vp = getViewport();
  push();
  translate(vp.ox, vp.oy);
  scale(vp.s);
  // world frame
  noFill();
  stroke(180);
  strokeWeight(1 / vp.s);
  rect(0, 0, world.w, world.h);
  // grid
  stroke(235);
  strokeWeight(1 / vp.s);
  for (let x = 200; x < world.w; x += 200) line(x, 0, x, world.h);
  for (let y = 200; y < world.h; y += 200) line(0, y, world.w, y);

  // actors
  const smoothing = 0.15;
  for (let [id, state] of serverActors.entries()) {
    const asset = assetsById[id];
    if (!asset) continue;
    let r = renderActors.get(id);
    if (!r) {
      r = { pos: { x: state.x, y: state.y }, size: asset.size, gfx: asset.gfx };
      renderActors.set(id, r);
    }
    r.pos.x += (state.x - r.pos.x) * smoothing;
    r.pos.y += (state.y - r.pos.y) * smoothing;

    const heading =
      typeof state.heading === "number"
        ? state.heading
        : Math.atan2(state.vy, state.vx);
    push();
    translate(r.pos.x, r.pos.y);
    rotate(heading);
    imageMode(CENTER);
    const sc = typeof state.scale === "number" ? state.scale : 1;
    push();
    scale(sc);
    image(r.gfx, 0, 0);
    pop();

    // Debug anchors
    if (Animation.debugAnchors && state.mouthOffset && state.backOffset) {
      const mx = state.mouthOffset.x * sc;
      const my = state.mouthOffset.y * sc;
      const bx = state.backOffset.x * sc;
      const by = state.backOffset.y * sc;
      // already rotated above
      push();
      noFill();
      stroke(220, 60, 60);
      strokeWeight(1 / vp.s);
      circle(mx, my, 16);
      stroke(60, 120, 220);
      circle(bx, by, 16);
      pop();
    }
    pop();
  }
  pop();
}

function getViewport() {
  const pad = 12; // screen padding
  const top = 60; // header space
  const sx = (width - pad * 2) / world.w;
  const sy = (height - top - pad * 2) / world.h;
  const s = Math.min(sx, sy);
  const vw = world.w * s;
  const vh = world.h * s;
  const ox = (width - vw) / 2;
  const oy = top + (height - top - vh) / 2;
  return { s, ox, oy };
}

function animateAll() {
  for (let a of actors) {
    const nx = noise(a.noise.x);
    const ny = noise(a.noise.y);
    a.noise.x += a.noiseSpeed;
    a.noise.y += a.noiseSpeed;

    const ang = map(nx, 0, 1, -PI, PI);
    const spd = map(ny, 0, 1, 0.5, 1) * a.speedScale;
    a.vel.x = cos(ang) * spd;
    a.vel.y = sin(ang) * spd;

    a.pos.x += a.vel.x;
    a.pos.y += a.vel.y;

    if (a.pos.x < -a.size.w) a.pos.x = width + a.size.w;
    if (a.pos.x > width + a.size.w) a.pos.x = -a.size.w;
    if (a.pos.y < -a.size.h) a.pos.y = height + a.size.h;
    if (a.pos.y > height + a.size.h) a.pos.y = -a.size.h;

    const heading = atan2(a.vel.y, a.vel.x);

    push();
    translate(a.pos.x, a.pos.y);
    rotate(heading);
    imageMode(CENTER);
    image(a.gfx, 0, 0);
    pop();
  }
}

function drawLoadingNotice() {
  push();
  noStroke();
  fill(60);
  textAlign(CENTER, CENTER);
  textSize(16);
  const msg = isLoadingActors
    ? "Loading drawings from server…"
    : "No drawings available yet.";
  text(msg, width / 2, height / 2);
  pop();
}
