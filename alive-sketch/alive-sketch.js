// A1F - Drawing Iterator Program
let drawing = []; // Array to store all drawing strokes
let currentStroke = []; // Current stroke being drawn
let isDrawing = false;
let iterating = false;
let iterationComplete = false;

// Iteration variables
let totalIterations = 15; // Total number of random copies
let currentIteration = 0;
let iterationDelay = 150; // milliseconds between iterations
let lastIterationTime = 0;

// Canvas size
let canvasSize = 300;

// Size control variables (adjustable thresholds)
let minSizeMultiplier = 0.2; // Minimum size as fraction of base size
let maxSizeMultiplier = 1.0; // Maximum size as fraction of base size

// Pause functionality
let pauseAfterIteration = false;
let pauseStartTime = 0;
let pauseDuration = 3000; // 3 seconds

// Noise system for organic line drawing
let wiggleDistance = 10; // Maximum wiggle distance in pixels
let wiggleScale = 0.05; // Noise smoothness

// Arrays to store random properties for each iteration
let iterationPositions = [];
let iterationScales = [];
let iterationRotations = [];

function setup() {
  createCanvas(canvasSize, canvasSize);
  background(255);
  strokeWeight(2);
  stroke(50);
  setSizeThresholds(minSizeMultiplier, maxSizeMultiplier); // Tiny to normal size
  setNoiseLevel(wiggleDistance, wiggleScale);
}

function draw() {
  // Handle pause after iteration
  if (pauseAfterIteration) {
    if (millis() - pauseStartTime > pauseDuration) {
      // End pause and reset to drawing mode
      pauseAfterIteration = false;
      showUI();
      setGrayBackground();
      background(255);
      redrawUserDrawing();
    }
    return;
  }

  // Only clear and redraw if we're iterating or if the drawing is complete
  if (iterating || iterationComplete) {
    background(255);

    if (iterationComplete) {
      drawAllIterations();
    } else if (iterating) {
      drawIterationProgress();
    }
  }
}

function mousePressed() {
  // Only allow drawing if we're not currently iterating
  if (!iterating && !iterationComplete) {
    isDrawing = true;
    currentStroke = [];
    currentStroke.push({ x: mouseX, y: mouseY });
  }
}

function mouseDragged() {
  if (isDrawing && !iterating && !iterationComplete) {
    let prevPoint = currentStroke[currentStroke.length - 1];

    // Apply noise to both points for organic drawing
    let prevX = wiggleX(prevPoint.x, prevPoint.y);
    let prevY = wiggleY(prevPoint.x, prevPoint.y);
    let currX = wiggleX(mouseX, mouseY);
    let currY = wiggleY(mouseX, mouseY);

    // Draw the line segment with noise
    line(prevX, prevY, currX, currY);

    // Add original point to current stroke (store clean coordinates)
    currentStroke.push({ x: mouseX, y: mouseY });
  }
}

function mouseReleased() {
  if (isDrawing) {
    isDrawing = false;
    // Add the completed stroke to the drawing array
    if (currentStroke.length > 0) {
      drawing.push([...currentStroke]);
    }
    currentStroke = [];
  }
}

function startIteration() {
  if (drawing.length === 0) {
    alert("Please draw something first!");
    return;
  }

  // Generate random properties for each iteration
  generateRandomIterations();

  iterating = true;
  iterationComplete = false;
  currentIteration = 0;
  lastIterationTime = millis();

  // Hide UI and change background
  hideUI();
  setWhiteBackground();
}

function drawIterationProgress() {
  // Calculate how many iterations to show based on time
  if (millis() - lastIterationTime > iterationDelay) {
    currentIteration++;
    lastIterationTime = millis();
  }

  // Check if iteration is complete
  if (currentIteration >= totalIterations) {
    iterating = false;
    iterationComplete = true;
    return;
  }

  // Draw iterations up to current iteration
  for (let i = 0; i <= currentIteration; i++) {
    drawIterationAt(i);
  }
}

function drawAllIterations() {
  // Draw all iterations when complete
  for (let i = 0; i < totalIterations; i++) {
    drawIterationAt(i);
  }
}

function drawIterationAt(index) {
  if (index >= iterationPositions.length) return;

  push();

  // Calculate the bounds of the original drawing
  let bounds = getDrawingBounds();
  if (!bounds) return;

  // Get random properties for this iteration
  let pos = iterationPositions[index];
  let scale = iterationScales[index];
  let rotation = iterationRotations[index];

  // Apply transformations
  translate(pos.x, pos.y);
  rotate(rotation);
  translate(-bounds.centerX * scale, -bounds.centerY * scale);

  // Draw each stroke with consistent properties for this iteration
  let alpha = map(index, 0, totalIterations, 80, 180); // Vary transparency based on iteration
  stroke(50, alpha); // Semi-transparent
  strokeWeight(1.2 + (index % 3) * 0.3); // Slight variation in stroke weight

  for (let strokeIndex = 0; strokeIndex < drawing.length; strokeIndex++) {
    let stroke = drawing[strokeIndex];
    if (stroke.length > 1) {
      for (let i = 1; i < stroke.length; i++) {
        let prevX = stroke[i - 1].x * scale;
        let prevY = stroke[i - 1].y * scale;
        let currX = stroke[i].x * scale;
        let currY = stroke[i].y * scale;

        // Apply noise with unique offset for each iteration and stroke
        let offset = index * 100 + strokeIndex * 10 + i;
        line(
          wiggleX(prevX, prevY, offset),
          wiggleY(prevX, prevY, offset),
          wiggleX(currX, currY, offset + 1),
          wiggleY(currX, currY, offset + 1)
        );
      }
    }
  }

  pop();
}

function getDrawingBounds() {
  if (drawing.length === 0) return null;

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;

  for (let stroke of drawing) {
    for (let point of stroke) {
      minX = min(minX, point.x);
      maxX = max(maxX, point.x);
      minY = min(minY, point.y);
      maxY = max(maxY, point.y);
    }
  }

  return {
    minX: minX,
    maxX: maxX,
    minY: minY,
    maxY: maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function clearDrawing() {
  drawing = [];
  currentStroke = [];
  isDrawing = false;
  iterating = false;
  iterationComplete = false;
  currentIteration = 0;

  // Clear iteration data
  iterationPositions = [];
  iterationScales = [];
  iterationRotations = [];

  // Reset UI and background
  showUI();
  setGrayBackground();
  document.getElementById("start-btn").disabled = false;
  document.getElementById("start-btn").textContent = "Start";

  // Clear canvas
  background(255);
}

function redrawUserDrawing() {
  // Redraw the user's original drawing
  stroke(50);
  strokeWeight(2);

  for (let strokeIndex = 0; strokeIndex < drawing.length; strokeIndex++) {
    let stroke = drawing[strokeIndex];
    if (stroke.length > 1) {
      for (let i = 1; i < stroke.length; i++) {
        // Apply noise with unique offset for consistent redrawing
        let offset = strokeIndex * 10 + i;
        line(
          wiggleX(stroke[i - 1].x, stroke[i - 1].y, offset),
          wiggleY(stroke[i - 1].x, stroke[i - 1].y, offset),
          wiggleX(stroke[i].x, stroke[i].y, offset + 1),
          wiggleY(stroke[i].x, stroke[i].y, offset + 1)
        );
      }
    }
  }
}

function generateRandomIterations() {
  // Clear previous iterations
  iterationPositions = [];
  iterationScales = [];
  iterationRotations = [];

  let bounds = getDrawingBounds();
  if (!bounds) return;

  // Generate random properties for each iteration
  for (let i = 0; i < totalIterations; i++) {
    // Random position (ensure drawing stays mostly visible)
    let margin = 30; // Smaller margin for 300px canvas
    let x = random(margin, width - margin);
    let y = random(margin, height - margin);
    iterationPositions.push({ x: x, y: y });

    // Random scale using adjustable thresholds
    let baseScale = min(80 / bounds.width, 80 / bounds.height); // Base scale for 300px canvas
    let scale = baseScale * random(minSizeMultiplier, maxSizeMultiplier);
    iterationScales.push(scale);

    // Random rotation (between -45 and 45 degrees)
    let rotation = random(-PI / 4, PI / 4);
    iterationRotations.push(rotation);
  }
}

// Helper function to easily adjust size thresholds
function setSizeThresholds(minSize, maxSize) {
  minSizeMultiplier = minSize;
  maxSizeMultiplier = maxSize;
}

// Helper function to easily adjust noise levels
function setNoiseLevel(level, scale = 0.01) {
  wiggleDistance = level;
  wiggleScale = scale;
  console.log(`Noise updated: wiggle = ${level}px, smoothness = ${scale}`);
}

// UI helper functions
function hideUI() {
  document.getElementById("ui").classList.add("hidden");
  document.getElementById("instructions").classList.add("hidden");
}

function showUI() {
  document.getElementById("ui").classList.remove("hidden");
  document.getElementById("instructions").classList.remove("hidden");
}

function setWhiteBackground() {
  document.body.style.backgroundColor = "white";
}

function setGrayBackground() {
  document.body.style.backgroundColor = "#888888";
}

// Noise functions for organic line drawing
function wiggle(v) {
  return wiggleDistance * (noise(v * wiggleScale) - 0.5) * 2; // Center around 0, range -wiggleDistance to +wiggleDistance
}

function wiggleX(x, y, offset = 0) {
  return x + wiggle((x + y + offset) * 0.1 + frameCount * 0.02);
}

function wiggleY(x, y, offset = 0) {
  return y + wiggle((x + y + offset + 1000) * 0.1 + frameCount * 0.02); // +1000 to differentiate from X
}
