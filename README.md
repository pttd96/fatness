# 🏋️ Fatness — Fitness Tracking Web App

Personalized fitness tracking web application where users track weekly exercise splits, manage and edit routines in-place, browse a comprehensive exercise library, and log their actual workout performance with progressive overload.

- 🌐 **Live Web Application:** [https://fatness-514604.web.app](https://fatness-514604.web.app)
- 🚀 **Live Backend API:** [https://fatness-564210787365.asia-southeast1.run.app/health](https://fatness-564210787365.asia-southeast1.run.app/health)
- 📖 **Technical Documentation:** See **[`TECHNICAL_DOCS.md`](TECHNICAL_DOCS.md)**
- 🤖 **AI Agent Context & Navigation:** See **[`AGENTS.md`](AGENTS.md)**

---

## 🏛️ Architecture & Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS (Light & Dark mode support)
- **Backend:** Rust + Axum 0.8 + SQLx 0.8 (PostgreSQL)
- **Database & Auth:** Supabase (PostgreSQL with Row Level Security + Modern Asymmetric ES256 Auth)
- **Deployment & CI/CD:**
  - Frontend: Firebase Hosting via GitHub Actions ([`.github/workflows/deploy-frontend.yml`](.github/workflows/deploy-frontend.yml))
  - Backend: GCP Cloud Run via GitHub Actions ([`.github/workflows/deploy-backend.yml`](.github/workflows/deploy-backend.yml))

---

## 🧭 Page-to-File Index (For Developers & AI Agents)

| Page | URL Path | Component File |
|---|---|---|
| **Dashboard** | `/` or `/dashboard` | [`frontend/src/pages/Dashboard.tsx`](frontend/src/pages/Dashboard.tsx) |
| **Workout Logging** | `/workout/:dayIndex` | [`frontend/src/pages/Workout.tsx`](frontend/src/pages/Workout.tsx) |
| **Plan Builder** | `/builder` | [`frontend/src/pages/PlanBuilder.tsx`](frontend/src/pages/PlanBuilder.tsx) |
| **Exercise Library** | `/exercises` | [`frontend/src/pages/ExerciseCatalog.tsx`](frontend/src/pages/ExerciseCatalog.tsx) |
| **User Settings** | `/settings` | [`frontend/src/pages/Settings.tsx`](frontend/src/pages/Settings.tsx) |
| **Login / Demo** | `/login` | [`frontend/src/pages/Login.tsx`](frontend/src/pages/Login.tsx) |
| **Shell & Layout** | All pages | [`frontend/src/components/Layout.tsx`](frontend/src/components/Layout.tsx) |

For complete endpoint mappings, database schema, and operational guides, consult **[`TECHNICAL_DOCS.md`](TECHNICAL_DOCS.md)**.

---

## 💻 Local Development

### 1. Frontend
```bash
cd frontend
npm install
npm run dev      # Local Vite dev server on http://localhost:5173
npm run build    # Production build & TypeScript check
```

### 2. Backend
```bash
cd backend
cp .env.example .env   # Configure DATABASE_URL and Supabase keys
cargo run              # Axum server on http://localhost:8080
cargo check            # Fast compilation check
```
