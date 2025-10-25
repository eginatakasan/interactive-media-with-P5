/*
Rainbow Circles with Perlin noise motion, collision color-cycling, and edge wrapping
*/

let rainbowColors = [];
let agents = [];

const NUM_CIRCLES = 60;
const NOISE_SPEED = 0.01; // step for noise progression per frame
const MAX_SPEED = 2.2; // max pixel/frame speed derived from noise
const MIN_RADIUS = 10;
const MAX_RADIUS = 22;
const COLOR_CHANGE_COOLDOWN_FRAMES = 12; // prevent rapid cycling while overlapping

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("canvas-container");

  colorMode(HSB, 360, 100, 100, 1);
  noStroke();

  // 1) Generate an array of 7 rainbow colors (evenly spaced across hue)
  rainbowColors = Array.from({ length: 7 }, (_, i) => {
    const hue = Math.round((i * 360) / 7);
    return color(hue, 90, 100);
  });

  // 2) Generate n circles with these colors sequentially
  agents = [];
  for (let i = 0; i < NUM_CIRCLES; i++) {
    const radius = random(MIN_RADIUS, MAX_RADIUS);
    const px = random(radius, width - radius);
    const py = random(radius, height - radius);
    const colorIndex = i % rainbowColors.length;
    agents.push(new CircleAgent(px, py, radius, colorIndex));
  }
}

function draw() {
  background(0);

  // 3) Move circles using Perlin noise–driven velocity
  for (const agent of agents) {
    agent.updateFromNoise();
  }

  // 4) Detect collisions and advance colors when colliding
  handleCollisions();

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

    this.framesUntilNextColorChange = 0;
  }

  updateFromNoise() {
    const vx = map(noise(this.noiseX), 0, 1, -MAX_SPEED, MAX_SPEED);
    const vy = map(noise(this.noiseY), 0, 1, -MAX_SPEED, MAX_SPEED);
    this.position.x += vx;
    this.position.y += vy;

    this.noiseX += NOISE_SPEED;
    this.noiseY += NOISE_SPEED;

    if (this.framesUntilNextColorChange > 0) {
      this.framesUntilNextColorChange--;
    }
  }

  advanceColor() {
    if (this.framesUntilNextColorChange > 0) return;
    this.colorIndex = (this.colorIndex + 1) % rainbowColors.length;
    this.framesUntilNextColorChange = COLOR_CHANGE_COOLDOWN_FRAMES;
  }

  wrapAround() {
    const r = this.radius;
    if (this.position.x < -r) this.position.x = width + r;
    else if (this.position.x > width + r) this.position.x = -r;

    if (this.position.y < -r) this.position.y = height + r;
    else if (this.position.y > height + r) this.position.y = -r;
  }

  render() {
    fill(rainbowColors[this.colorIndex]);
    circle(this.position.x, this.position.y, this.radius * 2);
  }
}

function handleCollisions() {
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i];
      const b = agents[j];
      const dx = a.position.x - b.position.x;
      const dy = a.position.y - b.position.y;
      const rSum = a.radius + b.radius;
      if (dx * dx + dy * dy <= rSum * rSum) {
        // Both circles advance to the next color on collision
        a.advanceColor();
        b.advanceColor();
      }
    }
  }
}
