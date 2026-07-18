// Runs OCR on the captured ID card image and extracts the fields we care about.
// Tuned for the "Shree Mahadev Janata Model Sec. School" ID card layout:
//   ... photo ...
//   <Student Name>
//   Class : IX        Sec : C      Roll No. : 43
//   Guardian: ...
//   ...

async function runOcrOnImage(imageSource) {
  const { data } = await Tesseract.recognize(imageSource, "eng", {
    logger: () => {} // silence per-progress logs; UI shows its own status text
  });
  return parseIdCardText(data.text);
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