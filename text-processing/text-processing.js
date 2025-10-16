let rawNounLines;
let nounList = [];
let nounSet = new Set();
let rhymingPairs = [];

let letterFreq = new Array(26).fill(0);

// This is a snippet of "The Road Not Taken" Poem by Robert Frost
const poem = [
  "Two roads diverged in a yellow wood",
  "And sorry I could not travel both",
  "And be one traveler, long I stood",
  "And looked down one as far as I could",
  "To where it bent in the undergrowth",
  "Then took the other, as just as fair",
  "And having perhaps the better claim",
  "Because it was grassy and wanted wear",
  "Though as for that the passing there",
  "Had worn them really about the same",
  "And both that morning equally lay",
  "In leaves no step had trodden black",
  "Oh, I kept the first for another day",
  "Yet knowing how way leads on to way",
  "I doubted if I should ever come back",
  "I shall be telling this with a sigh",
  "Somewhere ages and ages hence",
  "Two roads diverged in a wood, and I",
  "I took the one less traveled by",
  "And that has made all the difference",
];

function preload() {
  rawNounLines = loadStrings("nouns.txt");
}

async function setup() {
  createCanvas(windowWidth, windowHeight);
  background(186, 166, 151);
  textFont("Lucinda");

  initializeNounLists();
  await populateRhymingWords();
  renderFrame();
}

function draw() {}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  renderFrame();
}

function initializeNounLists() {
  const cleaned = (rawNounLines || [])
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());

  // keep only single alphabetic words to maximize rhyme success
  nounList = cleaned.filter((w) => /^[a-z]+$/.test(w));
  nounSet = new Set(nounList);
}

async function populateRhymingWords() {
  const candidate = random(nounList);
  const rhymes = await RiTa.rhymes(candidate, { limit: 15 });
  rhymingPairs.push(candidate);
  rhymingPairs = rhymingPairs.concat(rhymes);
}

function renderFrame() {
  clearFrame();
  const nouns = getAvailableNouns();
  if (!nouns.length) {
    drawLoadingIndicator();
    drawChartWithCurrentData();
    return;
  }

  const linesToRender = buildDisplayedPoemLines(nouns);
  const layout = computeLayout();
  drawPoemLines(linesToRender, layout);

  const displayedText = linesToRender.join(" ");
  letterFreq = computeLetterFrequencies(displayedText);
  drawChartWithCurrentData(layout);
}

function clearFrame() {
  background(186, 166, 151);
  fill(20);
}

function getAvailableNouns() {
  return rhymingPairs.map((w) => (w || "").toLowerCase()).filter(Boolean);
}

function drawLoadingIndicator() {
  textAlign(CENTER, CENTER);
  textSize(20);
  text("...", width / 2, height / 2);
}

function buildDisplayedPoemLines(nouns) {
  const lines = [];
  let nounIdx = 0;
  for (let i = 0; i < poem.length && nounIdx < nouns.length; i++) {
    const line = poem[i];
    const words = line.split(/(\s+)/); // keep whitespace tokens
    words[words.length - 1] = nouns[nounIdx];
    nounIdx++;
    lines.push(words.join(""));
  }
  return lines;
}

function computeLayout() {
  textAlign(LEFT, TOP);
  const margin = 40;
  const gap = 20;
  const chartWidth = max(220, min(360, width * 0.28));
  const chartX = width - margin - chartWidth;
  const maxWidth = max(0, chartX - margin - gap);
  const baseSize = min(28, max(14, width / 40));
  textSize(baseSize);
  return {
    margin,
    gap,
    chartWidth,
    chartX,
    maxWidth,
    baseSize,
    leading: baseSize * 1.4,
  };
}

function drawPoemLines(linesToRender, layout) {
  let x = layout.margin;
  let y = layout.margin;
  for (let k = 0; k < linesToRender.length; k++) {
    const line = linesToRender[k];
    const wrapped = wrapLine(line, layout.maxWidth);
    for (let wi = 0; wi < wrapped.length; wi++) {
      text(wrapped[wi], x, y);
      y += layout.leading;
    }
  }
}

function drawChartWithCurrentData(layout) {
  const margin = layout ? layout.margin : 40;
  const chartWidth = layout
    ? layout.chartWidth
    : max(220, min(360, width * 0.28));
  const chartX = layout ? layout.chartX : width - margin - chartWidth;
  const baseSize = layout ? layout.baseSize : min(28, max(14, width / 40));
  drawFrequencyChart(
    letterFreq,
    chartX,
    margin,
    chartWidth,
    height - margin * 2,
    baseSize
  );
}

function wrapLine(line, maxWidth) {
  const tokens = line.split(/\s+/);
  const lines = [];
  let current = "";
  for (let i = 0; i < tokens.length; i++) {
    const next = current ? current + " " + tokens[i] : tokens[i];
    if (textWidth(next) > maxWidth && current) {
      lines.push(current);
      current = tokens[i];
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Count how many times each letter appears in the text
function computeLetterFrequencies(text) {
  const counts = new Array(26).fill(0);
  const str = (text || "").toLowerCase();
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 97; // 'a' => 0
    if (code >= 0 && code < 26) counts[code]++;
  }
  return counts;
}

function drawFrequencyChart(freq, x, y, w, h, baseSize) {
  // Layout paddings
  const topPad = baseSize * 0.6;
  const bottomPad = baseSize * 2.0; // room for x-axis labels
  const chartTop = y + topPad;
  const chartBottom = y + h - bottomPad;
  const chartHeight = max(1, chartBottom - chartTop);
  const numBars = 26;
  const barSlot = w / numBars;
  const barWidth = barSlot * 0.72;

  const maxVal = max(1, ...freq);

  // Axes
  stroke(40);
  strokeWeight(1);
  line(x, chartBottom, x + w, chartBottom); // x-axis
  line(x, chartTop, x, chartBottom); // y-axis

  // Title
  noStroke();
  fill(20);
  textAlign(CENTER, TOP);
  textSize(baseSize * 0.9);

  // Bars and numeric labels
  noStroke();
  for (let i = 0; i < numBars; i++) {
    const value = freq[i] || 0;
    const barH = map(value, 0, maxVal, 0, chartHeight);
    const cx = x + i * barSlot + (barSlot - barWidth) / 2;
    const cy = chartBottom - barH;

    // Bar
    fill(189, 80, 17);
    rect(cx, cy, barWidth, barH);

    // Numeric label: inside if tall enough, else above
    const label = String(value);
    textSize(baseSize * 0.5);
    const labelPadding = 3;

    fill(255);
    textAlign(CENTER, CENTER);
    text(label, cx + barWidth / 2, cy - 10);
  }

  // X-axis labels (A-Z)
  fill(20);
  textAlign(CENTER, TOP);
  textSize(baseSize * 0.7);
  for (let i = 0; i < numBars; i++) {
    const labelX = x + i * barSlot + barSlot / 2;
    text(String.fromCharCode(65 + i), labelX, chartBottom + 4);
  }
}
