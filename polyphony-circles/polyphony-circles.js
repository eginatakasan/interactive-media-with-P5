/*
Polyphony Circles: 5-color palette mapped to 5 drum sounds.
Noise-driven motion, edge wrapping, and same-color collision sound triggers.
*/

let palette = [];
let audioSources = [];
let agents = [];
let ripples = new Map(); // key: "i-j" -> Ripple instance
let pauseUntilMillis = 0;
const PAUSE_MS = 500;
let pairCooldownUntilMillis = new Map(); // key: "i-j" -> millis when next allowed
const PAIR_COOLDOWN_MS = 3000;

// Runtime-adjustable parameters (controlled by sliders)
let currentMaxSpeed = 10;
let currentNoiseSpeed = 0.01;
let uiRoot,
  maxSpeedLabel,
  noiseSpeedLabel,
  maxSpeedSliderEl,
  noiseSpeedSliderEl;

const NUM_CIRCLES = 25;
const NOISE_SPEED = 0.01; // step for noise progression per frame
const MAX_SPEED = 10; // max pixel/frame speed derived from noise
const MIN_RADIUS = 30;
const MAX_RADIUS = 50;
const SOUND_COOLDOWN_FRAMES = 12; // debounce repeated triggers while overlapping

function preload() {
  // Map 5 colors to 5 drum samples (order matters)
  // const drumPaths = [
  //   "assets/sounds/drums/lqokooeoixh-drum-sfx-3.mp3",
  //   "assets/sounds/drums/fx-percussion-huge-cinematic-tom-hit-283585.mp3",
  //   "assets/sounds/drums/mixkit-short-bass-hit-2299.wav",
  //   "assets/sounds/drums/mixkit-hand-tribal-drum-562.wav",
  //   "assets/sounds/drums/mixkit-drum-bass-hit-2294.wav",
  // ];
  // drums = drumPaths.map((p) => loadSound(p));

  const pianoPaths = [
    "assets/sounds/piano/a-piano-a4-422105.mp3",
    "assets/sounds/piano/c-piano-c4-422089.mp3",
    "assets/sounds/piano/g-piano-g4-422103.mp3",
    "assets/sounds/piano/ting-bing-170228.mp3",
    "assets/sounds/piano/toy-piano-key-g-102603.mp3",
  ];
  audioSources = pianoPaths.map((p) => loadSound(p));
}

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("canvas-container");

  colorMode(HSB, 360, 100, 100, 1);
  noStroke();
  userStartAudio();

  // 1) Build a 5-color rainbow-like palette (red, orange, yellow, green, blue)
  palette = [
    color(0, 90, 100), // red
    color(28, 90, 100), // orange
    color(55, 90, 100), // yellow
    color(120, 80, 100), // green
    color(230, 80, 100), // blue
  ];

  // 2) Generate n circles with these 5 colors sequentially
  agents = [];
  for (let i = 0; i < NUM_CIRCLES; i++) {
    const radius = random(MIN_RADIUS, MAX_RADIUS);
    const px = random(radius, width - radius);
    const py = random(radius, height - radius);
    const colorIndex = i % palette.length;
    agents.push(new CircleAgent(px, py, radius, colorIndex));
  }

  initUI();
}

function draw() {
  background(0);

  // 3) Move circles using Perlin noise–driven velocity
  for (const agent of agents) {
    agent.updateFromNoise();
  }

  // 4) Detect collisions, manage ripple lifecycles, and trigger sounds
  const overlaps = handleCollisions();
  updateAndDrawRipples(overlaps);

  // 5) Wrap around edges and render
  for (const agent of agents) {
    agent.wrapAround();
    agent.render();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

class CircleAgent {
  constructor(x, y, radius, colorIndex) {
    this.position = createVector(x, y);
    this.radius = radius;
    this.colorIndex = colorIndex;

    // independent noise coordinates for velocity generation
    this.noiseX = random(1000);
    this.noiseY = random(1000);
    this.framesUntilNextSound = 0;
  }

  updateFromNoise() {
    // Pause all movement while a same-color overlap pause is active
    if (millis() < pauseUntilMillis) {
      if (this.framesUntilNextSound > 0) {
        this.framesUntilNextSound--;
      }
      return;
    }
    const vx = map(noise(this.noiseX), 0, 1, -currentMaxSpeed, currentMaxSpeed);
    const vy = map(noise(this.noiseY), 0, 1, -currentMaxSpeed, currentMaxSpeed);
    this.position.x += vx;
    this.position.y += vy;

    this.noiseX += currentNoiseSpeed;
    this.noiseY += currentNoiseSpeed;
    if (this.framesUntilNextSound > 0) {
      this.framesUntilNextSound--;
    }
  }

  wrapAround() {
    const r = this.radius;
    if (this.position.x < -r) this.position.x = width + r;
    else if (this.position.x > width + r) this.position.x = -r;

    if (this.position.y < -r) this.position.y = height + r;
    else if (this.position.y > height + r) this.position.y = -r;
  }

  render() {
    fill(palette[this.colorIndex]);
    circle(this.position.x, this.position.y, this.radius * 2);
  }
}

function handleCollisions() {
  // Track which pairs overlap this frame
  const overlappedPairs = new Set();
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i];
      const b = agents[j];
      const dx = a.position.x - b.position.x;
      const dy = a.position.y - b.position.y;
      const rSum = a.radius + b.radius;
      if (dx * dx + dy * dy <= rSum * rSum) {
        // Only show/manage ripples and trigger behavior for same-color overlaps
        if (a.colorIndex === b.colorIndex) {
          const key = `${i}-${j}`;
          if (!ripples.has(key)) {
            ripples.set(
              key,
              new Ripple(i, j, palette[a.colorIndex], palette[b.colorIndex])
            );
          }
          overlappedPairs.add(key);

          // Play drum and pause all circles for two seconds (debounced + per-pair cooldown)
          const now = millis();
          const nextAllowed = pairCooldownUntilMillis.get(key) || 0;
          if (
            now >= nextAllowed &&
            a.framesUntilNextSound === 0 &&
            b.framesUntilNextSound === 0
          ) {
            const drum = audioSources[a.colorIndex % audioSources.length];
            if (drum && drum.isLoaded()) {
              drum.play();
            }
            a.framesUntilNextSound = SOUND_COOLDOWN_FRAMES;
            b.framesUntilNextSound = SOUND_COOLDOWN_FRAMES;
            pauseUntilMillis = max(pauseUntilMillis, millis() + PAUSE_MS);
            pairCooldownUntilMillis.set(key, now + PAIR_COOLDOWN_MS);
          }
        }
      }
    }
  }
  return overlappedPairs;
}

// Ensure audio context is started on user interaction in restrictive browsers
function mousePressed() {
  userStartAudio();
}
function touchStarted() {
  userStartAudio();
}

// ----------------------
// Ripple system
// ----------------------

const RING_SPACING = 24;
const RING_SPEED = 3;
const MAX_RIPPLE_RADIUS = 600;
const RIPPLE_FADE_RATE = 0.04;

class Ripple {
  constructor(iIdx, jIdx, colorA, colorB) {
    this.iIdx = iIdx;
    this.jIdx = jIdx;
    this.colorA = colorA;
    this.colorB = colorB;
    this.center = createVector(0, 0);
    this.phase = 0; // expanding radius base
    this.opacity = 1;
    this.lastSeenFrame = frameCount;
  }

  updateCenter() {
    const a = agents[this.iIdx];
    const b = agents[this.jIdx];
    if (!a || !b) return;
    this.center.x = (a.position.x + b.position.x) * 0.5;
    this.center.y = (a.position.y + b.position.y) * 0.5;
  }

  step(isOverlapping) {
    if (isOverlapping) {
      this.lastSeenFrame = frameCount;
      this.opacity = 1;
    } else {
      this.opacity = max(0, this.opacity - RIPPLE_FADE_RATE);
    }
    this.phase = (this.phase + RING_SPEED) % MAX_RIPPLE_RADIUS;
  }

  draw() {
    push();
    noFill();
    const rings = 5;
    for (let k = 0; k < rings; k++) {
      const r = ((this.phase + k * RING_SPACING) % MAX_RIPPLE_RADIUS) + 8;
      const c = k % 2 === 0 ? this.colorA : this.colorB;
      const a = withAlpha(c, 0.5 * this.opacity);
      stroke(a);
      strokeWeight(3);
      circle(this.center.x, this.center.y, r * 2);
    }
    pop();
  }
}

function withAlpha(c, alphaValue) {
  return color(hue(c), saturation(c), brightness(c), alphaValue);
}

function updateAndDrawRipples(currentOverlaps) {
  // Update, draw, and garbage-collect ripples
  for (const [key, ripple] of ripples) {
    ripple.updateCenter();
    ripple.step(currentOverlaps.has(key));
    ripple.draw();
    if (ripple.opacity <= 0.01 && frameCount - ripple.lastSeenFrame > 30) {
      ripples.delete(key);
    }
  }
}

// ----------------------
// UI (vanilla DOM sliders)
// ----------------------
function initUI() {
  // Create container
  uiRoot = document.createElement("div");
  uiRoot.style.position = "fixed";
  uiRoot.style.top = "12px";
  uiRoot.style.left = "12px";
  uiRoot.style.padding = "8px 10px";
  uiRoot.style.background = "rgba(0,0,0,0.45)";
  uiRoot.style.backdropFilter = "blur(2px)";
  uiRoot.style.color = "#fff";
  uiRoot.style.fontFamily =
    "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  uiRoot.style.fontSize = "12px";
  uiRoot.style.lineHeight = "1.2";
  uiRoot.style.borderRadius = "6px";
  uiRoot.style.zIndex = "1000";

  // Max Speed
  const maxRow = document.createElement("div");
  maxRow.style.marginBottom = "6px";
  maxSpeedLabel = document.createElement("div");
  maxSpeedLabel.textContent = `Max Speed: ${currentMaxSpeed.toFixed(2)}`;
  maxSpeedSliderEl = document.createElement("input");
  maxSpeedSliderEl.type = "range";
  maxSpeedSliderEl.min = "0";
  maxSpeedSliderEl.max = "20";
  maxSpeedSliderEl.step = "0.1";
  maxSpeedSliderEl.value = String(currentMaxSpeed);
  maxSpeedSliderEl.style.width = "180px";
  maxSpeedSliderEl.addEventListener("input", () => {
    currentMaxSpeed = parseFloat(maxSpeedSliderEl.value);
    maxSpeedLabel.textContent = `Max Speed: ${currentMaxSpeed.toFixed(2)}`;
  });
  maxRow.appendChild(maxSpeedLabel);
  maxRow.appendChild(maxSpeedSliderEl);
  uiRoot.appendChild(maxRow);

  // Noise Speed
  const noiseRow = document.createElement("div");
  noiseRow.style.marginBottom = "0px";
  noiseSpeedLabel = document.createElement("div");
  noiseSpeedLabel.textContent = `Noise Speed: ${currentNoiseSpeed.toFixed(3)}`;
  noiseSpeedSliderEl = document.createElement("input");
  noiseSpeedSliderEl.type = "range";
  noiseSpeedSliderEl.min = "0";
  noiseSpeedSliderEl.max = "0.05";
  noiseSpeedSliderEl.step = "0.001";
  noiseSpeedSliderEl.value = String(currentNoiseSpeed);
  noiseSpeedSliderEl.style.width = "180px";
  noiseSpeedSliderEl.addEventListener("input", () => {
    currentNoiseSpeed = parseFloat(noiseSpeedSliderEl.value);
    noiseSpeedLabel.textContent = `Noise Speed: ${currentNoiseSpeed.toFixed(
      3
    )}`;
  });
  noiseRow.appendChild(noiseSpeedLabel);
  noiseRow.appendChild(noiseSpeedSliderEl);
  uiRoot.appendChild(noiseRow);

  // Attach to body
  document.body.appendChild(uiRoot);
}
