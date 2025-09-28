function setup() {
  createCanvas(400, 400);
}

let x = 400;

function draw() {
  background(x, (255 / 400) * x);
  stroke(0);
  fill(175);
  rectMode(CENTER);
  rect(mouseX, mouseY, 50, 50);
  x = x - 50;
}
