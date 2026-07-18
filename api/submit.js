// POST /api/submit
// Receives one leave application from the student form and commits it as a
// JSON file to the GitHub repo configured via environment variables.
//
// Required environment variables (set in Vercel project settings, never in code):
//   GITHUB_TOKEN        - fine-grained PAT, scoped ONLY to the one repo below,
//                          with Contents: Read and write permission
//   GITHUB_OWNER        - e.g. "premkumarjha"
//   GITHUB_REPO         - e.g. "class-10c-leave-records"
//   GITHUB_BRANCH       - e.g. "main" (optional, defaults to main)

const GITHUB_API = "https://api.github.com";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH = "main" } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    res.status(500).json({ error: "Server is not configured yet. Missing GitHub environment variables." });
    return;
  }

  const body = req.body;
  const required = ["name", "roll", "className", "section", "dateFrom", "dateTo", "reasonType", "reasonDetails", "guardianContact"];
  const missing = required.filter((k) => !body || !body[k]);
  if (missing.length) {
    res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });
    return;
  }

  const entry = {
    id: `${Date.now()}-${body.roll}`,
    name: String(body.name).slice(0, 100),
    roll: String(body.roll).slice(0, 10),
    className: String(body.className).slice(0, 10),
    section: String(body.section).slice(0, 10),
    dateFrom: body.dateFrom,
    dateTo: body.dateTo,
    dateFromBS: typeof body.dateFromBS === "string" ? body.dateFromBS.slice(0, 40) : null,
    dateToBS: typeof body.dateToBS === "string" ? body.dateToBS.slice(0, 40) : null,
    reasonType: body.reasonType,
    reasonDetails: String(body.reasonDetails).slice(0, 1000),
    guardianContact: String(body.guardianContact).slice(0, 20),
    verified: body.verified === true,
    idPhoto: typeof body.idPhoto === "string" && body.idPhoto.startsWith("data:image/")
      ? body.idPhoto.slice(0, 400000) // guard against oversized payloads
      : null,
    submittedAt: body.submittedAt || new Date().toISOString()
  };

  const filePath = `applications/${entry.id}.json`;

  try {
    const putRes = await fetch(
      `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Leave application: ${entry.name} (Roll ${entry.roll}) ${entry.dateFrom} to ${entry.dateTo}`,
          content: Buffer.from(JSON.stringify(entry, null, 2)).toString("base64"),
          branch: GITHUB_BRANCH
        })
      }
    );

    if (!putRes.ok) {
      const errText = await putRes.text();
      console.error("GitHub commit failed:", putRes.status, errText);
      res.status(502).json({ error: "Could not save the application. Please try again." });
      return;
    }

    res.status(200).json({ ok: true, id: entry.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unexpected server error." });
  }
};