# 🤖 AGENTS.md — Agent System Guide for Fatness

Welcome, AI Agent! This file is your primary orientation guide. Read this before attempting any file modifications.

For detailed architecture, DB schemas, and full API references, see **[`TECHNICAL_DOCS.md`](TECHNICAL_DOCS.md)**.

---

## ⚡ Instant Page-to-File Lookup

When the user asks you to implement, modify, or debug a feature on any page, use this map:

- **Dashboard / Weekly Split Overview:**
  - File: [`frontend/src/pages/Dashboard.tsx`](frontend/src/pages/Dashboard.tsx)
  - Features: Weekly completion bar, Session cards, In-place plan edit mode, Add/Remove exercise buttons.
- **Workout Logging Session:**
  - File: [`frontend/src/pages/Workout.tsx`](frontend/src/pages/Workout.tsx)
  - Features: Previous/Next day switch, Set logging textarea, Target parameters, Form tutorial link.
- **Plan Builder:**
  - File: [`frontend/src/pages/PlanBuilder.tsx`](frontend/src/pages/PlanBuilder.tsx)
  - Features: Split templates (PPL, Upper/Lower, Bro Split, Full Body), Custom exercise list, Week start date.
- **Exercise Catalog / Movement Library:**
  - File: [`frontend/src/pages/ExerciseCatalog.tsx`](frontend/src/pages/ExerciseCatalog.tsx)
  - Features: Muscle group filters, Exercise search, Create/Edit exercise modal, YouTube video link.
- **User Settings & Profile:**
  - File: [`frontend/src/pages/Settings.tsx`](frontend/src/pages/Settings.tsx)
  - Features: Fitness level, Goals, Preferred split, Training days slider, Equipment notes.
- **Coach Portal & Client Roster:**
  - File: [`frontend/src/pages/CoachClients.tsx`](frontend/src/pages/CoachClients.tsx)
  - Features: Email-based client lookup, read & edit client weekly plans, add/remove planned movements.
- **Authentication & Login:**
  - File: [`frontend/src/pages/Login.tsx`](frontend/src/pages/Login.tsx)
  - Features: Supabase Sign In / Sign Up, email verification.
- **Navbar, Header & Theme Toggle:**
  - File: [`frontend/src/components/Layout.tsx`](frontend/src/components/Layout.tsx)
  - Hook: [`frontend/src/hooks/useTheme.tsx`](frontend/src/hooks/useTheme.tsx)

---

## 🛠️ Backend Endpoints & Files

All backend code lives in [`backend/`](backend/):

- **Route registration:** [`backend/src/main.rs`](backend/src/main.rs) (Axum 0.8)
- **Profile endpoints:** [`backend/src/handlers/profile.rs`](backend/src/handlers/profile.rs)
- **Coach endpoints & client plan editing:** [`backend/src/handlers/coach.rs`](backend/src/handlers/coach.rs)
- **Exercise catalog endpoints:** [`backend/src/handlers/exercises.rs`](backend/src/handlers/exercises.rs)
- **Plan & Plan Exercises endpoints:** [`backend/src/handlers/plans.rs`](backend/src/handlers/plans.rs)
- **Workout Log & Delete Planned Exercise:** [`backend/src/handlers/logs.rs`](backend/src/handlers/logs.rs)
- **Supabase ES256 Auth Middleware:** [`backend/src/middleware/auth.rs`](backend/src/middleware/auth.rs)
- **Data Models:** [`backend/src/models/`](backend/src/models/)

---

## 🚨 Critical Agent Rules

1. **NO `/api/` Prefix:** Backend routes do NOT use `/api/`. They are `/plans`, `/exercises`, `/profile`, etc.
2. **Role-Based Permissions:** All users default to `CLIENT`. The `COACH` role is granted via manual database execution (`UPDATE public.user_profiles SET role = 'COACH' WHERE email = '...';`). Ensure `isCoach` is checked before rendering coach actions or hitting `/coach/*` endpoints.
3. **Always Add Dark Mode Classes:** Ensure every UI element has `dark:...` Tailwind classes.
4. **Never Wipe Workout Logs:** When updating or modifying planned exercises, keep `actual_log` and `logged_at` intact.
5. **Pre-Commit Verification:**
   - Frontend: `cd frontend && npm run build`
   - Backend: `cd backend && cargo check`
