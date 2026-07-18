// GET /api/applications
// Requires: Authorization: Bearer <token from /api/login>
// Reads every file under applications/ in the GitHub repo and returns them
// as a JSON array, newest first.

const { requireAuth } = require("./_lib/auth");

const GITHUB_API = "https://api.github.com";

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!requireAuth(req, res)) return;

  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH = "main" } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    res.status(500).json({ error: "Server is not configured yet. Missing GitHub environment variables." });
    return;
  }

  const ghHeaders = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json"
  };

  try {
    const listRes = await fetch(
      `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/applications?ref=${GITHUB_BRANCH}`,
      { headers: ghHeaders }
    );

    if (listRes.status === 404) {
      // No applications folder yet means no submissions yet.
      res.status(200).json({ applications: [] });
      return;
    }
    if (!listRes.ok) {
      res.status(502).json({ error: "Could not reach GitHub." });
      return;
    }

    const files = await listRes.json();
    const jsonFiles = files.filter((f) => f.name.endsWith(".json"));

    const entries = await Promise.all(
      jsonFiles.map(async (f) => {
        const fileRes = await fetch(f.url, { headers: ghHeaders });
        const fileData = await fileRes.json();
        const decoded = Buffer.from(fileData.content, "base64").toString("utf8");
        return JSON.parse(decoded);
      })
    );

    entries.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    res.status(200).json({ applications: entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unexpected server error." });
  }
};
