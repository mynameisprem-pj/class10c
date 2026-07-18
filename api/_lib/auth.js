const crypto = require("crypto");

// Creates a signed, expiring token. Nothing here is a secret the teacher has
// to remember beyond her short password — TOKEN_SECRET lives only in Vercel's
// environment variables and never reaches the browser.
function createToken() {
  const { TOKEN_SECRET } = process.env;
  const expiresAt = Date.now() + 1000 * 60 * 60 * 8; // 8 hour session
  const payload = `${expiresAt}`;
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64");
}

function verifyToken(token) {
  try {
    const { TOKEN_SECRET } = process.env;
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const [payload, signature] = decoded.split(".");
    const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");

    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return false;
    }
    return Number(payload) > Date.now();
  } catch {
    return false;
  }
}

function requireAuth(req, res) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || !verifyToken(token)) {
    res.status(401).json({ error: "Not logged in or session expired." });
    return false;
  }
  return true;
}

module.exports = { createToken, verifyToken, requireAuth };
