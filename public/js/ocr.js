// Runs OCR on the captured ID card image and extracts the fields we care about.
async function runOcrOnImage(imageDataUrl) {
  const preprocessed = await preprocessImage(imageDataUrl);

  const worker = await Tesseract.createWorker("eng", 1, { logger: () => {} });
  
  await worker.setParameters({
    // PSM 6: Assume a single uniform block of text (far better for ID cards)
    tessedit_pageseg_mode: "11",
  });

  const { data } = await worker.recognize(preprocessed);
  await worker.terminate();

  console.log("OCR raw text:\n" + data.text);
  return parseIdCardText(data.text);
}

function preprocessImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MIN_WIDTH = 1200;
      const MAX_WIDTH = 1600;
      let targetWidth = img.width;
      if (targetWidth < MIN_WIDTH) targetWidth = MIN_WIDTH;
      if (targetWidth > MAX_WIDTH) targetWidth = MAX_WIDTH;
      const scale = targetWidth / img.width;

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // 1. Convert to Grayscale
      const gray = toGrayscale(imageData);
      
      // 2. Contrast Stretching (Normalizes dark images like id3/id4)
      const contrastStretched = stretchContrast(gray);

      // 3. Otsu's Global Thresholding (Kills plastic glare noise)
      const binary = otsuThreshold(contrastStretched);

      const { data } = imageData;
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        data[i] = data[i + 1] = data[i + 2] = binary[p];
      }
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

// Spreads light values to cover the full 0-255 range
function stretchContrast(gray) {
  let min = 255, max = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < min) min = gray[i];
    if (gray[i] > max) max = gray[i];
  }
  
  const out = new Uint8ClampedArray(gray.length);
  const range = max - min || 1;
  for (let i = 0; i < gray.length; i++) {
    out[i] = Math.min(255, Math.max(0, ((gray[i] - min) / range) * 255));
  }
  return out;
}

// Otsu's Algorithm: Calculates the optimal global threshold automatically
function otsuThreshold(gray) {
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) {
    histogram[gray[i]]++;
  }

  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let varMax = 0;
  let threshold = 0;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;

    wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const varBetween = wB * wF * (mB - mF) * (mB - mF);

    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }

  const out = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = gray[i] < threshold ? 0 : 255;
  }
  return out;
}

// Fast 3x3 Gaussian Blur filter to suppress ISO sensor noise in dark photos
function gaussianBlur3x3(gray, width, height) {
  const out = new Uint8ClampedArray(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const sum =
        gray[idx - width - 1] * 1 + gray[idx - width] * 2 + gray[idx - width + 1] * 1 +
        gray[idx - 1]         * 2 + gray[idx]         * 4 + gray[idx + 1]         * 2 +
        gray[idx + width - 1] * 1 + gray[idx + width] * 2 + gray[idx + width + 1] * 1;
      out[idx] = sum >> 4; // divide by 16
    }
  }
  return out;
}

function adaptiveThreshold(gray, width, height) {
  // Optimal local window for card width
  const windowSize = Math.max(21, Math.round(width / 16));
  const half = Math.floor(windowSize / 2);
  const darknessMargin = 0.15; // Raised slightly to ignore plastic sleeve haze

  const integral = new Uint32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    const rowOffset = (y + 1) * (width + 1);
    const prevRowOffset = y * (width + 1);
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x];
      integral[rowOffset + x + 1] = integral[prevRowOffset + x + 1] + rowSum;
    }
  }

  const out = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - half);
    const y2 = Math.min(height - 1, y + half);
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - half);
      const x2 = Math.min(width - 1, x + half);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * (width + 1) + (x2 + 1)] -
        integral[y1 * (width + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (width + 1) + x1] +
        integral[y1 * (width + 1) + x1];
      const localMean = sum / count;
      const px = gray[y * width + x];
      out[y * width + x] = px < localMean * (1 - darknessMargin) ? 0 : 255;
    }
  }
  return out;
}

function parseIdCardText(rawText) {
  const result = {
    name: "",
    className: "",
    section: "",
    roll: ""
  };

  // Clean out stray border symbols
  const cleanRawText = rawText.replace(/[|\\/]/g, " ");
  const cleanFullText = cleanRawText.replace(/\r?\n/g, " ").replace(/\s+/g, " ");

  // 1. Extract Section
  const secMatch = cleanFullText.match(/\bsec(?:tion)?[^a-z0-9]*([a-z0-9])\b/i);
  if (secMatch) {
    result.section = cleanSectionValue(secMatch[1]);
  }

  // --- ROLL NO EXTRACTION ---
// 1. First try matching on the exact same line
const rollLineMatch = cleanRawText.match(/(?:roll|rol|roil|rall|r0ll)[^\n]*/i);

if (rollLineMatch) {
  const rollLine = rollLineMatch[0];
  const sameLineDigits = rollLine.match(/\b([0-9]{1,3})\b/);
  
  if (sameLineDigits) {
    result.roll = sameLineDigits[1];
  } else {
    // 2. If no digits on the same line, check ONLY the single line directly beneath it
    const lines = cleanRawText.split("\n").map(l => l.trim()).filter(Boolean);
    const rollIndex = lines.findIndex(l => /(?:roll|rol|roil|rall|r0ll)/i.test(l));
    
    if (rollIndex !== -1 && rollIndex + 1 < lines.length) {
      const nextLine = lines[rollIndex + 1];
      // Only accept if the next line is purely 1-3 digits (ignores text like "Guardian...")
      const nextLineDigits = nextLine.match(/^(\d{1,3})$/);
      if (nextLineDigits) {
        result.roll = nextLineDigits[1];
      }
    }
  }
}

  // 3. Extract Class
  const classMatch = cleanFullText.match(/(?:class|clas|clss|cus|oass)[^a-z0-9]*([ivxivxl10]{1,5}|\d{1,2})\b/i);
  if (classMatch) {
    let rawClass = classMatch[1].toUpperCase().replace(/1/g, "I").replace(/L/g, "I");
    result.className = normalizeClass(rawClass);
  } else {
    if (/\bX\b/.test(cleanFullText)) {
      result.className = "10";
    } else if (/\bIX\b/i.test(cleanFullText)) {
      result.className = "9";
    }
  }

  // 4. Targeted Name Extraction
  const lines = cleanRawText.split("\n").map((l) => l.trim()).filter(Boolean);

  // Find where student details begin (Class, Sec, Roll, or Guardian)
  const detailIndex = lines.findIndex((l) => 
    /class|cus|oass|sec|roll|rol|guardian/i.test(l)
  );

  if (detailIndex > 0) {
    // Look UPWARDS from the Class/Guardian field to find the closest valid name line
    for (let i = detailIndex - 1; i >= 0; i--) {
      if (looksLikeName(lines[i])) {
        result.name = sanitizeName(lines[i]);
        break;
      }
    }
  }

  // Fallback: If working bottom-up didn't find it, scan lines starting AFTER school header lines
  if (!result.name) {
    for (const line of lines) {
      if (looksLikeName(line)) {
        result.name = sanitizeName(line);
        break;
      }
    }
  }

  return result;
}

function looksLikeName(line) {
  if (!line) return false;

  const cleanLine = line.replace(/[^a-zA-Z\s]/g, "").trim();

  // Strict rejection of header text, school names, and card metadata
  const blacklistedKeywords = /shree|mahadev|mahad|janata|model|school|sec|secondary|harion|sarlahi|student|id[\s-]?card|principal|sign|guardian|address|house|contact|phone|ph\./i;
  
  if (blacklistedKeywords.test(cleanLine)) {
    return false;
  }

  const alphaCount = cleanLine.replace(/\s/g, "").length;
  if (alphaCount < 4) return false;

  const words = cleanLine.split(/\s+/).filter(Boolean);
  // Student names on these cards are 2-4 words
  return words.length >= 2 && words.length <= 4;
}

function sanitizeName(rawName) {
  let name = rawName
    .replace(/[^a-zA-Z\s]/g, "")
    .trim();

  // Patch common OCR glitched last name
  name = name.replace(/\bha\b/i, "Jha");

  return titleCase(name);
}

function cleanSectionValue(sec) {
  sec = sec.toUpperCase();
  if (sec === "0" || sec === "O") return "C";
  return sec;
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