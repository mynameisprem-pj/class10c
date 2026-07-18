# Class X-C leave application system

Student ID card is scanned (OCR, no QR codes needed), student fills a short
leave form, it's committed to a GitHub repo as JSON, and the teacher views it
all on a password-protected dashboard. No traditional database.

## How it works

- `public/index.html` — student flow: camera scan of ID card -> Tesseract.js
  reads name/class/section/roll off the card -> student confirms/edits ->
  fills leave dates + reason -> submits.
- `public/teacher.html` — teacher flow: enters a short password -> sees every
  application, newest first.
- `api/submit.js` — Vercel serverless function. Receives the form data and
  commits it as a JSON file to `applications/` in your GitHub repo.
- `api/login.js` — checks the teacher's password against `TEACHER_PASSWORD`
  and, if correct, returns a signed session token. The GitHub token itself
  never reaches the browser at any point.
- `api/applications.js` — reads all files under `applications/` from GitHub
  and returns them, only if the request carries a valid session token.

## One-time setup

**1. Create a private GitHub repo** to hold the applications, e.g.
`class-10c-leave-records`. It can start completely empty.

**2. Create a fine-grained GitHub token**, scoped as narrowly as possible:
- github.com -> Settings -> Developer settings -> Personal access tokens ->
  Fine-grained tokens -> Generate new token
- Repository access: **Only select repositories** -> pick the repo from step 1
- Permissions: **Contents: Read and write** — nothing else
- Copy the token, you'll only see it once.

**3. Deploy to Vercel:**
- Push this project to its own GitHub repo (a separate one from the data repo
  is fine, or the same one — your call), then import it in Vercel.
- In the Vercel project -> Settings -> Environment Variables, add:
  - `GITHUB_TOKEN` — the token from step 2
  - `GITHUB_OWNER` — your GitHub username
  - `GITHUB_REPO` — the repo name from step 1
  - `GITHUB_BRANCH` — usually `main`
  - `TEACHER_PASSWORD` — whatever short password you want the teacher to use
  - `TOKEN_SECRET` — a random string, e.g. output of `openssl rand -hex 32`
- Deploy. Vercel will serve `public/` as the site and `api/` as serverless
  functions automatically.

**4. Share the links:**
- Students go to `yoursite.vercel.app/`
- Teacher goes to `yoursite.vercel.app/teacher.html`

## Notes

- Camera access requires HTTPS, which Vercel gives you by default. It won't
  work over plain HTTP.
- Tesseract OCR is tuned for this specific ID card's layout (name line above
  "Class : Sec : Roll No."). If a scan comes out wrong, the student can just
  fix the fields on the confirm screen before continuing.
- Every application becomes its own commit in the GitHub repo, so you get a
  free audit trail of who submitted what and when, visible in the repo's
  commit history.
