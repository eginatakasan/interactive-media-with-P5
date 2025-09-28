var theme_island = {
  island: "#ebb98d",
  mountain: "#524128",
  island_highlight: "#fce7d4",
  sea: "#83a3d6",
  forest: "#92b86e",
  deep_forest: "#6a8c32",
  deep_sea: "#23457d",
  path: "#000000",
  boat_path: "#eb5b34",
};

const theme = theme_island;
const squareSize = 1;
let offset = 10;
let xScale = 0.015;
let yScale = 0.03;
let step = 1;
let island_coords = {};

function setup() {
  createCanvas(windowWidth, windowHeight);

  background(theme.sea);
  strokeWeight(0);

  for (let i = 0; i < windowWidth; i += step) {
    for (let j = 0; j < windowHeight; j += step) {
      const n = noise(i * xScale, j * yScale);
      let color = theme.sea;
      if (n < 0.5) {
        color = theme.deep_sea;
      } else if (n >= 0.5 && n < 0.6) {
        color = theme.sea;
      } else {
        island_coords[`${i},${j}`] = true;
        if (n >= 0.6 && n < 0.65) {
          color = theme.island;
        } else if (n >= 0.65 && n < 0.75) {
          color = theme.forest;
        } else if (n >= 0.75 && n < 0.8) {
          color = theme.deep_forest;
        } else {
          color = theme.mountain;
        }
      }
      fill(color);
      const r = rect(i, j, squareSize, squareSize);
    }
  }
}

function mouseMoved() {
  if (
    mouseX > 0 &&
    mouseX < windowWidth &&
    mouseY > 0 &&
    mouseY < windowHeight
  ) {
    const x = Math.floor(mouseX / step);
    const y = Math.floor(mouseY / step);
    if (island_coords[`${x},${y}`]) {
      fill(theme.path);
      rect(x * step, y * step, step, step);
    } else {
      fill(theme.boat_path);
      rect(x * step, y * step, step, step);
    }
  }
}

function draw() {}
