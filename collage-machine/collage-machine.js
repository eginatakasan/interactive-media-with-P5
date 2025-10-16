let images = [];
let placedItems = [];
let fileInput;
let minScale = 0.1;
let maxScale = 0.5;
let expectedCount = 0;
let loadedCount = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noLoop();
  background(255);

  fileInput = createFileInput(handleFiles, true);
  fileInput.parent("ui");
  fileInput.changed(onInputChange);
}

function draw() {}

function handleFiles(fileOrFiles) {
  const list = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
  list.forEach((f) => {
    if (f && f.type === "image" && f.data) {
      loadImage(
        f.data,
        (img) => {
          images.push(img);
          loadedCount += 1;
          if (expectedCount === 0 || loadedCount >= expectedCount) {
            layoutAndRender();
          }
        },
        () => {
          loadedCount += 1;
          if (expectedCount === 0 || loadedCount >= expectedCount) {
            layoutAndRender();
          }
        }
      );
    } else {
      loadedCount += 1;
      if (expectedCount === 0 || loadedCount >= expectedCount) {
        layoutAndRender();
      }
    }
  });
}

function onInputChange() {
  expectedCount =
    fileInput && fileInput.elt && fileInput.elt.files
      ? fileInput.elt.files.length
      : 0;
  loadedCount = 0;
  images = [];
  placedItems = [];
  clear();
  background(255);
}

function layoutAndRender() {
  placedItems = [];

  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  let done = false;
  while (!done) {
    let placedThisCycle = false;
    for (let index = 0; index < images.length; index++) {
      const img = images[index];

      let availableWidth = windowWidth - cursorX;
      let availableHeight = windowHeight - cursorY;

      if (availableWidth < 100 && availableHeight >= 100) {
        if (rowHeight <= 0) {
          done = true;
          break;
        }
        cursorX = 0;
        cursorY += rowHeight;
        rowHeight = 0;
        index -= 1;
        continue;
      }

      if (availableWidth < 100 && availableHeight < 100) {
        done = true;
        break;
      }

      const baseScale = random(minScale, maxScale);
      const maxScaleToFitWidth = availableWidth / img.width;
      const maxScaleToFitHeight = availableHeight / img.height;
      let scale = Math.min(baseScale, maxScaleToFitWidth, maxScaleToFitHeight);

      if (!isFinite(scale) || scale <= 0) {
        if (rowHeight <= 0) {
          done = true;
          break;
        }
        cursorX = 0;
        cursorY += rowHeight;
        rowHeight = 0;
        index -= 1;
        continue;
      }

      let w = img.width * scale;
      let h = img.height * scale;

      if (w > availableWidth) {
        const fitScale = availableWidth / w;
        w *= fitScale;
        h *= fitScale;
        scale *= fitScale;
      }
      if (h > availableHeight) {
        const fitScale = availableHeight / h;
        w *= fitScale;
        h *= fitScale;
        scale *= fitScale;
      }

      placedItems.push({ img, x: cursorX, y: cursorY, w, h });

      cursorX += w;
      if (h > rowHeight) {
        rowHeight = h;
      }

      placedThisCycle = true;
    }
    if (done) {
      break;
    }
    if (!placedThisCycle) {
      break;
    }
  }

  clear();
  background(255);
  placedItems.forEach((item) => {
    image(item.img, item.x, item.y, item.w, item.h);
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (images.length > 0) {
    layoutAndRender();
  } else {
    clear();
    background(255);
  }
}
