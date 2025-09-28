let mousePositions = [];
const maxPositions = 100;
let previousThickness = 5; // Track previous thickness for smooth transitions

let ellipseProgress = 0; // Current position along the trail (0 to 1)
let ellipseSpeed = 0.02; // Speed of ellipse movement

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(255);
  stroke(0);
  strokeCap(ROUND);
}

function animateEllipse() {
  if (mousePositions.length < 2) return;
  ellipseProgress += ellipseSpeed;

  // Reset ellipse
  if (ellipseProgress >= 1) {
    ellipseProgress = 0;
  }

  const totalSegments = mousePositions.length - 1;
  const targetSegment = ellipseProgress * totalSegments;
  const segmentIndex = Math.floor(targetSegment);
  const segmentProgress = targetSegment - segmentIndex;

  if (segmentIndex >= totalSegments) return;

  const startPoint = mousePositions[segmentIndex];
  const endPoint = mousePositions[segmentIndex + 1];

  const ellipseX = lerp(startPoint.x, endPoint.x, segmentProgress);
  const ellipseY = lerp(startPoint.y, endPoint.y, segmentProgress);

  push();
  noStroke();
  fill(255, 0, 0);
  ellipse(ellipseX, ellipseY, 15, 15);
  fill(255, 0, 0, 50);
  ellipse(ellipseX, ellipseY, 25, 25);
  pop();
}

function drawMouseTrail() {
  for (let i = 1; i < mousePositions.length; i++) {
    push();
    const current = mousePositions[i];
    const previous = mousePositions[i - 1];

    // Skip if the points are the same as previous (not moving)
    if (previous.x === current.x && previous.y === current.y) {
      continue;
    }

    // Calculate thickness based on distance
    const distance = dist(current.x, current.y, previous.x, previous.y);
    const targetThickness = constrain(20 / (distance * 0.3 + 1), 1, 20);
    const thickness = lerp(previousThickness, targetThickness, 0.3);
    previousThickness = thickness;

    strokeWeight(thickness);
    line(previous.x, previous.y, current.x, current.y);
    pop();
  }
}

function draw() {
  if (mouseX > 0 && mouseY > 0) {
    mousePositions.push({ x: mouseX, y: mouseY });
    if (mousePositions.length > maxPositions) {
      mousePositions.shift();
    }
  }

  background(255);

  drawMouseTrail();

  animateEllipse();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(255);
}
