// Runs OCR on the captured ID card image and extracts the fields we care about.
// Tuned for the "Shree Mahadev Janata Model Sec. School" ID card layout:
//   ... photo ...
//   <Student Name>
//   Class : IX        Sec : C      Roll No. : 43
//   Guardian: ...
//   ...
//
// ID cards have small, dense text over a busy/colorful design, which Tesseract
// struggles with directly. Preprocessing the photo into a clean, upscaled,
// black-and-white image before OCR makes a large difference in accuracy.

async function runOcrOnImage(imageDataUrl) {
  const preprocessed = await preprocessImage(imageDataUrl);

  const worker = await Tesseract.createWorker("eng", 1, { logger: () => {} });
  await worker.setParameters({
    tessedit_pageseg_mode: "6" // treat the card as a single uniform block of text
  });

  const { data } = await worker.recognize(preprocessed);
  await worker.terminate();

  // Useful for debugging misreads on a real card — check the browser console.
  console.log("OCR raw text:\n" + data.text);

  return parseIdCardText(data.text);
}

// Upscales the photo and converts it to high-contrast black-and-white using
// Otsu's method, which finds the best split point between "text" and
// "background" automatically rather than a fixed guess.
function preprocessImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const targetWidth = Math.max(img.width, 1400);
      const scale = targetWidth / img.width;

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const gray = toGrayscale(imageData);
      const threshold = otsuThreshold(gray);
      binarize(imageData, gray, threshold);
      ctx.putImageData(imageData, 0, 0);

      resolve(canvas.toDataURL("image/png"));
    };
    img.src = dataUrl;
  });
}

function toGrayscale(imageData) {
  const { data, width, height } = imageData;
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
}

function otsuThreshold(gray) {
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) histogram[gray[i]]++;
  const total = gray.length;

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumB = 0, wB = 0, maxVar = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = t;
    }
  }
  return threshold;
}

function binarize(imageData, gray, threshold) {
  const { data } = imageData;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const v = gray[p] > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

function parseIdCardText(rawText) {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const result = {
    name: "",
    className: "",
    section: "",
    roll: ""
  };

  const classLineIndex = lines.findIndex((l) => /class\s*[:\-]/i.test(l));

  // Class / Section / Roll are usually all on one line, but OCR sometimes
  // splits them across two. Join the class line with the next one just in case.
  const classLine =
    classLineIndex !== -1
      ? lines[classLineIndex] + " " + (lines[classLineIndex + 1] || "")
      : lines.join(" ");

  const classMatch = classLine.match(/class\s*[:\-]?\s*([IVXivx]{1,5}|\d{1,2})\b/);
  const secMatch = classLine.match(/sec(?:tion)?\s*[:\-]?\s*([A-Za-z])\b/i);
  const rollMatch = classLine.match(/roll\s*no\.?\s*[:\-]?\s*(\d+)/i);

  if (classMatch) result.className = normalizeClass(classMatch[1]);
  if (secMatch) result.section = secMatch[1].toUpperCase();
  if (rollMatch) result.roll = rollMatch[1];

  // The name is typically the line right before the "Class :" line, and it's
  // one of the few lines with no punctuation and mixed-case letters only.
  if (classLineIndex > 0) {
    for (let i = classLineIndex - 1; i >= 0 && i >= classLineIndex - 3; i--) {
      const candidate = lines[i];
      if (looksLikeName(candidate)) {
        result.name = titleCase(candidate);
        break;
      }
    }
  }

  return result;
}

function looksLikeName(line) {
  if (!line) return false;
  if (/[0-9:]/.test(line)) return false;
  if (/sign|principal|student|id[\s-]?card/i.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 5;
}

function titleCase(str) {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalizeClass(val) {
  const romanMap = {
    I: "1", II: "2", III: "3", IV: "4", V: "5", VI: "6",
    VII: "7", VIII: "8", IX: "9", X: "10", XI: "11", XII: "12"
  };
  const upper = val.toUpperCase();
  return romanMap[upper] || val;
}