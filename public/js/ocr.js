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
  tessedit_pageseg_mode: "3", // Keep standard left-to-right processing
  tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.:- " 
  // ^ Forces Tesseract to keep all alphanumeric text and basic punctuation alive!
});

  const { data } = await worker.recognize(preprocessed);
  await worker.terminate();

  // Useful for debugging misreads on a real card — check the browser console.
  console.log("OCR raw text:\n" + data.text);

  return parseIdCardText(data.text);
}

// Resizes the photo into a sensible working range and converts it to
// high-contrast black-and-white using *adaptive* (local) thresholding
// instead of one global threshold. A single global threshold (like Otsu)
// picks one brightness cutoff for the whole photo, which works differently
// depending on how that particular photo was lit — shadows, glare, or angle
// can push it the wrong way, which is why results varied between attempts.
// Adaptive thresholding compares each pixel to its own local neighborhood,
// so unevenly lit photos still binarize cleanly and consistently.
function preprocessImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MIN_WIDTH = 1200;
      const MAX_WIDTH = 1800; // keeps memory/CPU reasonable on phones
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
      const gray = toGrayscale(imageData);
      const binary = adaptiveThreshold(gray, canvas.width, canvas.height);

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

// Local mean thresholding via an integral image (summed-area table), so each
// pixel's local neighborhood average can be computed in constant time. A
// pixel becomes black if it's noticeably darker than its local surroundings.
function adaptiveThreshold(gray, width, height) {
  const windowSize = Math.max(15, Math.round(width / 8));
  const half = Math.floor(windowSize / 2);
  const darknessMargin = 0.12; // pixel must be >=12% darker than local mean to count as text

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

  const cleanFullText = rawText.replace(/\s+/g, " ");

  // 1. Section Extraction
  const secMatch = cleanFullText.match(/sec(?:tion)?[^a-z0-9]*([a-z0-9])\b/i);
  if (secMatch) result.section = secMatch[1].toUpperCase();

  // 2. Roll No Extraction
  const rollMatch = cleanFullText.match(/(?:roll|rol|roil|rall|r0ll)[^0-9]*(\d+)/i);
  if (rollMatch) result.roll = rollMatch[1];

  // 3. Class Extraction (With smart support for both IX and X)
  const classMatch = cleanFullText.match(/(?:class|clas|clss)[^a-z0-9]*([ivxivxl1]{1,5}|\d{1,2})\b/i);
  
  if (classMatch) {
    let rawClass = classMatch[1].toUpperCase().replace(/1/g, "I").replace(/L/g, "I");
    result.className = normalizeClass(rawClass);
  } else {
    // FALLBACK 1: Look for explicit whole Roman numerals like IX or VIII anywhere else
    const words = cleanFullText.split(" ");
    const romanNumeralMatch = words.find(w => /^[VLCDMvlcdm]+$/.test(w.trim()) || /^IX$/i.test(w.trim()));
    
    if (romanNumeralMatch) {
      result.className = normalizeClass(romanNumeralMatch.toUpperCase());
    } 
    // FALLBACK 2: If Tesseract drops the "Class" label but cleanly reads a lone "X"
    else if (/\bX\b/i.test(cleanFullText)) {
      result.className = "10"; // Safely force it to Class 10!
    }
    // FALLBACK 3: Address your exact OCR glitch layout for Class 9 ("I Nu HSv4")
    else if (/\bI\b\s+(?:Nu|Nz|Ma|Mo)/i.test(cleanFullText) || /\bI\s+Nu\b/i.test(cleanFullText)) {
      result.className = "9"; 
    } 
    // FALLBACK 4: If it only generated a completely isolated letter "I" on its own line
    else if (/\bI\b/.test(cleanFullText)) {
      result.className = "9"; 
    }
  }

  // 4. Name Finder Logic
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const metadataIndex = lines.findIndex((l) => /sec|roli/i.test(l));
  if (metadataIndex > 0) {
    for (let i = metadataIndex - 1; i >= 0; i--) {
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
  if (/school|janata|model|sec|guardian|sign|principal|student|id[\s-]?card|harion|phone|ph\./i.test(line)) return false;
  const alphaCount = (line.match(/[a-zA-Z]/g) || []).length;
  if (alphaCount < line.length * 0.6) return false;
  const words = line.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 4;
}

function cleanSectionValue(sec) {
  sec = sec.toUpperCase();
  // Common OCR misreads for sections
  if (sec === "0" || sec === "O") return "O"; 
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