// Flocking Triangles with two groups and dynamic edge destinations (p5.js)

let groupA = [];
let groupB = [];
let targetA;
let targetB;

const NUM_PER_GROUP = 100;
let min_cursor_distance = 30; // pixels

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(RADIANS);

  // Initialize two groups with different starting regions and colors
  for (let i = 0; i < NUM_PER_GROUP; i++) {
    const posA = createVector(
      random(width * 0.1, width * 0.4),
      random(height * 0.2, height * 0.8)
    );
    const posB = createVector(
      random(width * 0.6, width * 0.9),
      random(height * 0.2, height * 0.8)
    );
    groupA.push(new Boid(posA, color(60, 180, 255)));
    groupB.push(new Boid(posB, color(255, 120, 80)));
  }

  // Initial random edge destinations
  targetA = randomEdgePoint();
  targetB = randomEdgePoint();
}

function draw() {
  background(18);

  // Draw current destinations
  drawTarget(targetA, color(60, 180, 255));
  drawTarget(targetB, color(255, 120, 80));

  // Run flocking and update for each group
  runGroup(groupA, targetA);
  runGroup(groupB, targetB);

  // Retarget when any triangle from a group reaches its destination
  if (anyReached(groupA, targetA, 22)) {
    targetA = randomEdgePoint();
  }
  if (anyReached(groupB, targetB, 22)) {
    targetB = randomEdgePoint();
  }
}

function runGroup(boids, groupTarget) {
  for (let i = 0; i < boids.length; i++) {
    boids[i].flock(boids, groupTarget);
    boids[i].update();
    boids[i].edgesWrap();
    boids[i].render();
  }
}

function drawTarget(v, c) {
  push();
  noFill();
  stroke(c);
  strokeWeight(2);
  circle(v.x, v.y, 16);
  pop();
}

function anyReached(boids, target, threshold) {
  for (let i = 0; i < boids.length; i++) {
    if (p5.Vector.dist(boids[i].position, target) < threshold) return true;
  }
  return false;
}

function randomEdgePoint() {
  const edge = floor(random(4));
  if (edge === 0) return createVector(random(width), 0); // top
  if (edge === 1) return createVector(width, random(height)); // right
  if (edge === 2) return createVector(random(width), height); // bottom
  return createVector(0, random(height)); // left
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // Ensure targets stay on edges after resize
  targetA = constrainToNearestEdge(targetA);
  targetB = constrainToNearestEdge(targetB);
}

function constrainToNearestEdge(v) {
  if (!v) return randomEdgePoint();
  // Snap to the closest canvas edge while preserving orthogonal coordinate
  const distances = [v.y, width - v.x, height - v.y, v.x]; // top, right, bottom, left
  const minIdx = distances.indexOf(min(distances));
  if (minIdx === 0) return createVector(constrain(v.x, 0, width), 0);
  if (minIdx === 1) return createVector(width, constrain(v.y, 0, height));
  if (minIdx === 2) return createVector(constrain(v.x, 0, width), height);
  return createVector(0, constrain(v.y, 0, height));
}

class Boid {
  constructor(position, col) {
    this.position = position.copy();
    this.velocity = p5.Vector.random2D();
    this.velocity.setMag(random(1.2, 2.2));
    this.acceleration = createVector(0, 0);

    this.maxSpeed = 3.0;
    this.maxForce = 0.07;
    this.perception = 60; // neighborhood radius
    this.separationDistance = 24; // desired minimum separation

    this.col = col;
    this.size = 8; // triangle scale
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
  }

  edgesWrap() {
    if (this.position.x < -this.size) this.position.x = width + this.size;
    if (this.position.y < -this.size) this.position.y = height + this.size;
    if (this.position.x > width + this.size) this.position.x = -this.size;
    if (this.position.y > height + this.size) this.position.y = -this.size;
  }

  flock(boids, groupTarget) {
    const separation = this.separate(boids).mult(1.6);
    const alignment = this.align(boids).mult(1.0);
    const cohesion = this.cohere(boids).mult(0.9);
    const towardTarget = this.seek(groupTarget).mult(0.65);
    const wander = p5.Vector.random2D().mult(0.02);
    const cursorSteer = this.avoidCursor(
      createVector(mouseX, mouseY),
      min_cursor_distance
    );

    this.applyForce(separation);
    this.applyForce(alignment);
    this.applyForce(cohesion);
    this.applyForce(towardTarget);
    this.applyForce(cursorSteer);
    this.applyForce(wander);
  }

  align(boids) {
    let steering = createVector(0, 0);
    let total = 0;
    for (let i = 0; i < boids.length; i++) {
      const other = boids[i];
      const d = p5.Vector.dist(this.position, other.position);
      if (other !== this && d < this.perception) {
        steering.add(other.velocity);
        total++;
      }
    }
    if (total > 0) {
      steering.div(total);
      steering.setMag(this.maxSpeed);
      steering.sub(this.velocity);
      steering.limit(this.maxForce);
    }
    return steering;
  }

  cohere(boids) {
    let steering = createVector(0, 0);
    let total = 0;
    for (let i = 0; i < boids.length; i++) {
      const other = boids[i];
      const d = p5.Vector.dist(this.position, other.position);
      if (other !== this && d < this.perception) {
        steering.add(other.position);
        total++;
      }
    }
    if (total > 0) {
      steering.div(total);
      return this.steerTo(steering);
    }
    return steering;
  }

  separate(boids) {
    let steering = createVector(0, 0);
    let total = 0;
    for (let i = 0; i < boids.length; i++) {
      const other = boids[i];
      const d = p5.Vector.dist(this.position, other.position);
      if (other !== this && d < this.separationDistance) {
        const diff = p5.Vector.sub(this.position, other.position);
        diff.normalize();
        diff.div(d); // weight by inverse distance
        steering.add(diff);
        total++;
      }
    }
    if (total > 0) {
      steering.div(total);
    }
    if (steering.magSq() > 0) {
      steering.setMag(this.maxSpeed);
      steering.sub(this.velocity);
      steering.limit(this.maxForce * 1.2);
    }
    return steering;
  }

  seek(target) {
    return this.steerTo(target);
  }

  steerTo(target) {
    const desired = p5.Vector.sub(target, this.position);
    const d = desired.mag();
    if (d === 0) return createVector(0, 0);

    // Arrive behavior: slow down near target
    const slowRadius = 140;
    const speed =
      d < slowRadius ? map(d, 0, slowRadius, 0, this.maxSpeed) : this.maxSpeed;
    desired.setMag(speed);
    const steer = p5.Vector.sub(desired, this.velocity);
    steer.limit(this.maxForce);
    return steer;
  }

  render() {
    const heading = this.velocity.heading();
    push();
    translate(this.position.x, this.position.y);
    rotate(heading + PI / 2); // point triangle in velocity direction
    noStroke();
    fill(this.col);
    // Oriented triangle centered at position, pointing forward
    const s = this.size;
    triangle(0, -s * 1.6, -s * 0.8, s * 1.0, s * 0.8, s * 1.0);
    pop();
  }

  // Repel from cursor and add tangential component to circle around it when near
  avoidCursor(cursor, minDist) {
    const toBoid = p5.Vector.sub(this.position, cursor);
    const d = toBoid.mag();
    if (d === 0) return createVector(0, 0);

    // Influence radius grows from the minimum distance for a smoother feel
    const influenceRadius = minDist * 6;
    if (d > influenceRadius) return createVector(0, 0);

    // Radial repulsion (stronger when very close)
    const away = toBoid.copy().normalize();
    const repulseStrength = map(
      d,
      0,
      influenceRadius,
      this.maxForce * 2.2,
      0,
      true
    );
    away.mult(repulseStrength);

    // Tangential circling (perpendicular to radial vector)
    const tangent = toBoid
      .copy()
      .rotate(PI / 2)
      .normalize();
    const circleStrength = map(
      d,
      0,
      influenceRadius,
      this.maxForce * 1.4,
      0,
      true
    );
    tangent.mult(circleStrength);

    const steer = p5.Vector.add(away, tangent);
    // Limit to avoid overpowering other behaviors
    steer.limit(this.maxForce * 2.2);
    return steer;
  }
}
