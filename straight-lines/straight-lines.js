// Straight Lines Sketch
// Draw straight lines when clicking and dragging, longest line is red

let lines = [];
let isDrawing = false;
let startX, startY;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(255);
  stroke(0);
  strokeWeight(2);
}

function draw() {
  // Clear canvas and redraw all lines
  background(255);

  // Find the longest line to color it red
  let longestLine = null;
  let maxLength = 0;

  for (let line of lines) {
    const length = dist(line.x1, line.y1, line.x2, line.y2);
    if (length > maxLength) {
      maxLength = length;
      longestLine = line;
    }
  }

  // Draw all lines
  for (let line of lines) {
    if (line === longestLine) {
      stroke(255, 0, 0); // Red for longest line
    } else {
      stroke(0); // Black for other lines
    }
    strokeWeight(2);
    line(line.x1, line.y1, line.x2, line.y2);
  }

  // Draw preview line while dragging
  if (isDrawing) {
    stroke(100);
    strokeWeight(1);
    line(startX, startY, mouseX, mouseY);
  }
}

function mousePressed() {
  isDrawing = true;
  startX = mouseX;
  startY = mouseY;
}

function mouseReleased() {
  if (isDrawing) {
    // Add the line to the array
    lines.push({
      x1: startX,
      y1: startY,
      x2: mouseX,
      y2: mouseY,
    });
    isDrawing = false;
  }
}

function keyPressed() {
  // Clear all lines when 'c' is pressed
  if (key === "c" || key === "C") {
    lines = [];
    background(255);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(255);
}
