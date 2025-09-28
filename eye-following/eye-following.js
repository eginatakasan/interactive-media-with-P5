// Eye following cursor program
let leftEyeX, leftEyeY, rightEyeX, rightEyeY;
let eyeRadius = 60;
let pupilRadius = 20;
let eyeSpacing = 200;
let mic;
let isShaking = false;
let shakeStartTime = 0;
let shakeDuration = 500; // in milliseconds
let shakeIntensity = 10;

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Position the eyes in the center of the screen
  leftEyeX = width / 2 - eyeSpacing / 2;
  leftEyeY = height / 2;
  rightEyeX = width / 2 + eyeSpacing / 2;
  rightEyeY = height / 2;

  try {
    mic = new p5.AudioIn();
    mic.start();
  } catch (error) {
    console.log("AudioIn not available:", error);
  }
}

function draw() {
  background(240);
  checkAudioLevel();
  //   draw eyes
  drawEye(leftEyeX, leftEyeY, eyeRadius);
  drawEye(rightEyeX, rightEyeY, eyeRadius);
}

function checkAudioLevel() {
  if (mic && mic.enabled) {
    let level = mic.getLevel();
    let threshold = 0.1; // Adjust this value to change sensitivity

    // If sound level is above threshold and not already shaking
    if (level > threshold && !isShaking) {
      isShaking = true;
      shakeStartTime = millis();
    }

    // Check if shaking should stop
    if (isShaking && millis() - shakeStartTime > shakeDuration) {
      isShaking = false;
    }
  }
}

function drawEye(eyeX, eyeY, radius) {
  // white part of the eye
  fill(255);
  stroke(0);
  strokeWeight(2);
  ellipse(eyeX, eyeY, radius * 2, radius * 2);

  // Calculate pupil position based on mouse position or shaking
  let pupilX, pupilY;

  if (isShaking) {
    // random shaking movement
    let shakeX = random(-shakeIntensity, shakeIntensity);
    let shakeY = random(-shakeIntensity, shakeIntensity);
    pupilX = eyeX + shakeX;
    pupilY = eyeY + shakeY;
  } else {
    // Get the direction from eye center to mouse
    let dx = mouseX - eyeX;
    let dy = mouseY - eyeY;
    // Calculate distance from eye center to mouse
    let distance = sqrt(dx * dx + dy * dy);

    // Limit how far the pupil can move from the center
    let maxPupilDistance = radius - pupilRadius - 5;
    if (distance > maxPupilDistance) {
      // Normalize the direction and scale to max distance
      dx = (dx / distance) * maxPupilDistance;
      dy = (dy / distance) * maxPupilDistance;
    }

    // Calculate final pupil position
    pupilX = eyeX + dx;
    pupilY = eyeY + dy;
  }

  // Ensure pupil stays within eye boundaries even when shaking
  let maxPupilDistance = radius - pupilRadius - 5;
  let dx = pupilX - eyeX;
  let dy = pupilY - eyeY;
  let distance = sqrt(dx * dx + dy * dy);

  if (distance > maxPupilDistance) {
    dx = (dx / distance) * maxPupilDistance;
    dy = (dy / distance) * maxPupilDistance;
    pupilX = eyeX + dx;
    pupilY = eyeY + dy;
  }

  // Draw the pupil
  fill(0);
  noStroke();
  ellipse(pupilX, pupilY, pupilRadius * 2, pupilRadius * 2);
  fill(255);
  ellipse(pupilX - 5, pupilY - 5, 8, 8);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  leftEyeX = width / 2 - eyeSpacing / 2;
  leftEyeY = height / 2;
  rightEyeX = width / 2 + eyeSpacing / 2;
  rightEyeY = height / 2;
}
