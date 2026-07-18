// POST /api/login
// Body: { password: "..." }
// Checks the password against TEACHER_PASSWORD (a Vercel environment variable).
// On success, returns a short-lived signed session token the browser uses for
// subsequent /api/applications requests. The GitHub token itself is never
// sent to the browser at any point.

const { createToken } = require("./_lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { TEACHER_PASSWORD } = process.env;
  if (!TEACHER_PASSWORD) {
    res.status(500).json({ error: "Server is not configured yet. Missing TEACHER_PASSWORD." });
    return;
  }

  const { password } = req.body || {};
  if (!password || password !== TEACHER_PASSWORD) {
    res.status(401).json({ error: "Incorrect password." });
    return;
  }

  res.status(200).json({ token: createToken() });
};
