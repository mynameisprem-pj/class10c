# 🏫 Class X-C Leave Application System

An OCR-powered leave application system for Class X-C. Students scan their physical ID cards (no QR codes needed) to auto-fill their credentials, submit a leave request, and it's committed directly to a private GitHub repo as a `.json` file—no traditional database required.

🔗 **Live Portal:** [class10c.vercel.app](https://class10c.vercel.app)  

---

## ⚡ How It Works

* **`public/index.html` (Student Flow):** Scans the ID card with the camera. [Tesseract.js](https://tesseract.projectnaptha.com/) reads the student's Name, Class, Section, and Roll No. automatically. The student reviews the details, picks leave dates, adds a reason, and submits.
* **`public/teacher.html` (Teacher Flow):** Password-protected dashboard displaying all submitted leave applications, sorted newest first.
* **`api/submit.js`:** Vercel serverless function that commits submitted form data as a `.json` file in the data repo's `applications/` directory.
* **`api/login.js`:** Checks the teacher's password and issues a signed session token. The GitHub token never touches the browser.
* **`api/applications.js`:** Fetches all JSON records from GitHub for authenticated dashboard requests.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3, JavaScript (ES6+)
* **OCR Engine:** Tesseract.js
* **Backend:** Vercel Serverless Functions (`api/`)
* **Database & Storage:** Private GitHub Repository (JSON file commits)

---

## ⚙️ Environment Variables (Vercel)

Set these in your Vercel Project Settings:

* `GITHUB_TOKEN`: Fine-grained token scoped to your data repo (`Contents: Read & write`)
* `GITHUB_OWNER`: Your GitHub username
* `GITHUB_REPO`: Private data repo name (e.g., `class-10c-leave-records`)
* `GITHUB_BRANCH`: `main`
* `TEACHER_PASSWORD`: Dashboard password
* `TOKEN_SECRET`: Random secret string for signing session tokens

---

## 👨‍💻 Author

Built by **Prem Jha** ([@mynameisprem-pj](https://github.com/mynameisprem-pj)) for Class X-C.

---
