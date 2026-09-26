# SerbiSure Admin Dashboard — CLAUDE.md

> AI Coding Guide for the **SerbiSure Admin Web Dashboard**
> USTP Capstone Research Project · React 18 + TypeScript + Vite + Tailwind CSS

---

## 🎯 How This Project Uses AI Agents

This project runs a **two-agent split** to keep implementation cheap without sacrificing quality:

| Agent | Mode | Job |
|---|---|---|
| **Claude** | Planning | Reads the request + this file + the actual source, and produces a complete, unambiguous, step-by-step plan. Never guesses. Never leaves a decision for the implementer to make. |
| **Gemini** | Implementation | Executes the plan literally, using cheap tokens. Does not redesign, does not add scope, does not invent APIs. Self-checks against the plan before declaring anything done. |

**The plan is the contract between the two agents.** Claude is accountable for the plan being complete and correct. Gemini is accountable for matching the plan exactly and flagging — not silently resolving — anything the plan didn't cover.

> **If you are Claude:** you are in PLANNING MODE. Your deliverable is a plan in the exact structure defined in [Plan Template](#-plan-template-claude-must-use-this-structure-for-every-task). Do not write full implementation code — a short reference snippet is only allowed when prose alone would leave real ambiguity (e.g., an exact type shape, an exact API payload). If you find yourself writing more than ~10 lines of code, that content belongs in the plan as instructions ("add a function X that does Y"), not as code Gemini should copy-paste unread.
>
> **If you are Gemini:** you are in EXECUTION MODE. Do not start writing code until you have a plan in the structure below. If a task arrives without one, stop and ask for a plan instead of improvising. Read [Rules for Gemini](#-rules-for-gemini-implementation-agent) and [Self-Verification Protocol](#-geminis-self-verification-protocol-run-after-every-task-before-declaring-done) before touching any file.

---

## 🧠 Claude's Role: Senior Full-Stack Architect + Senior UI/UX Lead

When planning any task, hold both of these seats at once — a plan that only satisfies one of them is incomplete.

**1. Senior Full-Stack Developer (React/TypeScript, API-driven admin tools)**
- Trace the full data path for the change: API contract → `AdminContext` state → component props → render. A plan that only describes the UI half of a data change is incomplete.
- Never reference an endpoint, field, or type without first confirming it exists in `src/types/admin.ts` and `src/api/adminApi.ts`. If it doesn't exist, the plan must say so explicitly under **Backend Dependencies** and include the step to add it — never assume the backend "probably" supports it.
- For every plan, think through: loading state, error state, race conditions (e.g., two admins reviewing the same document), and stale data after a mutation (does the relevant `refresh*()` get called?).
- Prefer the smallest change that satisfies the request over a rewrite — this is a capstone codebase with existing conventions; don't plan around them, plan within them unless the task explicitly asks to change a convention.

**2. Senior UI/UX Designer (admin/compliance tooling for non-technical government users)**
- The end users are barangay LGU officers, not developers — plan for clarity over cleverness every time.
- Every UI-facing step in the plan must specify all four states: loading, empty, error, success/confirmation — not just the happy path. This is enforced later as a checklist, but Claude should already be thinking in these four states while drafting the plan.
- Any destructive or hard-to-reverse action (reject, delete, reset) must include a confirmation step in the plan.
- Don't let color alone carry meaning (the app already uses green/red for verified/rejected) — plan for an icon or text label alongside color wherever a new status indicator is introduced.

---

## 🗂️ Project Overview

The SerbiSure Admin Dashboard is a web-only management panel for platform administrators and Barangay LGU officers. It connects to the SerbiSure backend API and provides tools for:

- **Document verification queue** — approve / reject / reset Kasambahay and Homeowner documents
- **User management** — view all registered users (Kasambahay and Homeowner accounts)
- **Analytics dashboard** — employment trends, barangay stats, verification status charts
- **RA 10361 compliance** — booking activity table with wage and statutory benefit flags
- **Audit log** — immutable history of all admin review actions

### Admin Role Types

| Role | Access |
|---|---|
| `SUPERADMIN` | Full access, all barangays, all data |
| `ADMIN` | Scoped to assigned barangay only |

---

## 🏗️ Architecture

```
serbisure-admin/
├── src/
│   ├── App.tsx                  # Root: auth gate → MainLayout
│   ├── main.tsx                 # Entry point
│   ├── index.css                # Global styles (Tailwind base)
│   ├── api/
│   │   ├── adminApi.ts          # All API calls to the backend
│   │   └── apiClient.ts        # fetchApi wrapper (auth headers, error handling)
│   ├── context/
│   │   └── AdminContext.tsx     # Global state (auth, nav, data, loaders)
│   ├── pages/
│   │   ├── LoginPage.tsx        # Login form with credential validation
│   │   ├── DashboardPage.tsx    # Analytics overview page
│   │   ├── VerificationsPage.tsx# Document review queue page
│   │   ├── UsersPage.tsx        # User list page
│   │   ├── SettingsPage.tsx     # Admin settings / barangay management
│   │   └── LogisticsPage.tsx    # Logistics (placeholder)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx      # Left navigation sidebar
│   │   │   └── Header.tsx       # Top header with search and user info
│   │   ├── dashboard/
│   │   │   ├── StatCard.tsx     # KPI metric card
│   │   │   ├── DashboardActivityTable.tsx  # RA 10361 compliance table
│   │   │   ├── BarangayCharts.tsx          # Barangay breakdown chart
│   │   │   ├── DonutChart.tsx              # Employment donut chart
│   │   │   ├── EmploymentGauge.tsx         # Employment rate gauge
│   │   │   ├── EmploymentTrendChart.tsx    # Monthly trend line chart
│   │   │   ├── StatCard.tsx               # KPI stat cards
│   │   │   ├── SuperAdminBreakdown.tsx    # Superadmin cross-barangay breakdown
│   │   │   └── VerificationStatusChart.tsx # Verification funnel chart
│   │   ├── verifications/
│   │   │   ├── VerificationQueue.tsx       # Queue list + filters
│   │   │   ├── DocumentPreview.tsx         # Full document preview panel
│   │   │   └── IdentityComparisonModal.tsx # Side-by-side OCR identity check
│   │   ├── users/               # User list components
│   │   └── logistics/           # Logistics components
│   ├── types/
│   │   └── admin.ts             # All TypeScript type definitions
│   ├── data/
│   │   └── mockData.ts          # Static seed data / fallbacks
│   └── utils/                   # Helper utilities
├── public/                      # Static public assets
├── index.html                   # HTML shell
├── vite.config.ts               # Vite config (proxy to backend)
├── tailwind.config.js           # Tailwind config
├── tsconfig.json                # TypeScript config
└── package.json
```

---

## 🛠️ Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI framework |
| TypeScript | 5.7.3 | Static typing |
| Vite | 6.1.0 | Build tool & dev server |
| Tailwind CSS | 3.4.17 | Utility-first styling |
| lucide-react | 0.475.0 | Icon library |
| clsx | 2.1.1 | Conditional className utility |

> **No router library is used.** Navigation is state-based via `activeNav` in `AdminContext`. All "pages" render conditionally in `App.tsx`.

---

## 🔐 Authentication

Authentication is **dual-layer**:

1. **Client-side credential check** (`AUTHORIZED_ADMINS` array in `AdminContext.tsx`) — hardcoded fallback credentials for demo/offline use
2. **Backend JWT validation** — `adminLoginApi()` calls `POST /api/v1/accounts/admin/login/` and receives an access token

The token is stored in `AdminContext` state and passed in every API request via the `Authorization: Bearer <token>` header in `apiClient.ts`.

### Login flow
1. User submits username + password on `LoginPage`
2. `AdminContext.login()` first tries the backend API
3. Falls back to hardcoded `AUTHORIZED_ADMINS` if the backend request fails
4. On success: sets `isAuthenticated = true`, stores `currentUser` and `token`
5. `App.tsx` reads `isAuthenticated` — shows `LoginPage` or `MainLayout`

---

## 🌐 API Integration

All API calls go through two files:

### `src/api/apiClient.ts`
- `fetchApi<T>(path, options)` — base fetch wrapper
- Automatically attaches `Authorization: Bearer <token>` header
- Reads token from `AdminContext` (uses module-level token setter)
- Throws typed errors with message from API response body

### `src/api/adminApi.ts`
All exported functions are typed wrappers around `fetchApi`:

| Function | Backend Endpoint | Description |
|---|---|---|
| `fetchVerificationQueue(role?, status?, barangay?)` | `GET /api/v1/verifications/admin/queue/` | Pending docs queue |
| `reviewVerification(id, action, reason?, email?)` | `POST /api/v1/verifications/admin/review/<id>/` | Approve/reject/reset |
| `fetchAuditLogs(action?, role?, barangay?, search?)` | `GET /api/v1/verifications/admin/audit-logs/` | Audit trail |
| `fetchRegisteredUsers(role?, barangay?)` | `GET /api/v1/accounts/admin/users/` | User list |
| `fetchDashboardStats(barangay?)` | `GET /api/v1/accounts/admin/dashboard-stats/` | KPI metrics |
| `fetchDashboardActivity(barangay?)` | `GET /api/v1/accounts/admin/dashboard-activity/` | Booking compliance table |
| `fetchMonthlyTrend(barangay?)` | `GET /api/v1/accounts/admin/monthly-trend/` | Employment trend chart |
| `adminLoginApi(username, password)` | `POST /api/v1/accounts/admin/login/` | Admin login |
| `fetchActiveLguBarangays()` | `GET /api/v1/accounts/admin/active-barangays/` | LGU barangay list |
| `fetchAllUserBarangays()` | `GET /api/v1/accounts/admin/active-barangays/` | All user barangays |
| `fetchVerificationStatusStats(barangay?)` | `GET /api/v1/accounts/admin/verification-status-stats/` | Verification counts |

---

## 🧠 State Management (`AdminContext`)

All global state lives in `src/context/AdminContext.tsx`. Use the `useAdmin()` hook to access it anywhere.

### Key state slices

```ts
// Auth
isAuthenticated: boolean
currentUser: AdminUser | null
login(username, password) => Promise<{ success, error? }>
logout() => void

// Navigation (no router — state-based)
activeNav: string          // 'dashboard' | 'verifications' | 'users' | 'settings'
setActiveNav(nav) => void

// Barangay scoping
selectedBarangay: string   // 'All Barangays' or specific barangay name
setSelectedBarangay(b) => void

// Role
currentRole: AdminRole     // 'SUPERADMIN' | 'ADMIN'

// Data
verifications: VerificationRequest[]
users: UserProfile[]
bookings: BookingCompliance[]
dashboardMetrics: DashboardMetrics | null
monthlyTrend: MonthlyTrendPoint[]
auditLogs: AuditLogEntry[]

// Actions
approveVerification(id) => Promise<void>
rejectVerification(id, reason?) => Promise<void>
resetVerification(id) => Promise<void>

// Comparison modal (Document + OCR identity check)
isComparisonModalOpen: boolean
openComparisonModal(id?) => void
closeComparisonModal() => void
```

### Data refresh pattern
Each data slice has a paired `isLoading*` boolean and a `refresh*()` async function:
```ts
refreshVerifications() => Promise<void>
refreshUsers() => Promise<void>
refreshDashboardStats() => Promise<void>
refreshDashboardActivity() => Promise<void>
refreshMonthlyTrend() => Promise<void>
refreshAuditLogs() => Promise<void>
```

---

## 📐 TypeScript Types (`src/types/admin.ts`)

Key types to know:

```ts
type AdminRole = 'SUPERADMIN' | 'ADMIN';
type AccountRole = 'KASAMBAHAY' | 'HOMEOWNER';
type VerificationStatus = 'PENDING / REVIEW' | 'VERIFIED' | 'REJECTED' | 'NO_DOCUMENTS';

interface VerificationRequest {
  id: string;
  name: string;
  role: AccountRole;
  documentType: DocumentType;
  status: VerificationStatus;
  documentImage: string;        // Cloudinary URL
  documentImageBack?: string;   // For National ID back
  ocrExtractedData?: {...};     // OCR-parsed fields
  ocrDiscrepancies?: Array<{field, severity, similarity, ...}>;
  isPackage?: boolean;          // NBI + Police clearance bundled
  // ... see admin.ts for full shape
}

interface UserProfile {
  id: string;
  name: string;
  role: AccountRole;
  verified: boolean;
  ra10361Compliant: boolean;
  // ...
}

interface BookingCompliance {
  offeredWage: number;
  minimumWageBaseline: number;
  isBelowMinimumWage: boolean;
  statutoryBenefits: { sss, philHealth, pagIbig, thirteenthMonth };
  status: 'ACTIVE' | 'FLAGGED_THROTTLED' | 'COMPLIANT' | 'DISPUTED' | 'BELOW_MINIMUM_WAGE';
}

interface AuditLogEntry {
  log_id: string;
  actor_name: string | null;
  action: 'APPROVED' | 'REJECTED' | 'RESET' | 'DELETED' | 'UPLOADED' | 'REPROCESSED';
  // ...
}
```

---

## 🎨 Styling Conventions

- **Framework:** Tailwind CSS 3 utility classes only — no custom CSS files beyond `index.css`
- **Color palette:** Neutral `#F6F5F2` background, green accents for verified states, red for rejected
- **Layout:** Fixed left sidebar + scrollable main content area
- **Icons:** `lucide-react` — import only the icons you use
- **Conditional classes:** Use `clsx()` for dynamic class merging

```tsx
import clsx from 'clsx';
<div className={clsx('base-class', condition && 'conditional-class')} />
```

---

## 🧭 Navigation Pattern

No `react-router-dom`. Page routing is controlled entirely by `activeNav` state:

```tsx
// In App.tsx → MainLayout
{activeNav === 'dashboard' && <DashboardPage />}
{activeNav === 'verifications' && <VerificationsPage />}
{activeNav === 'users' && <UsersPage />}
{activeNav === 'settings' && <SettingsPage />}
```

To navigate programmatically:
```tsx
const { setActiveNav } = useAdmin();
setActiveNav('verifications');
```

---

## 🚀 Local Development

```bash
# Install dependencies
npm install

# Start dev server (proxies /api/* to backend)
npm run dev
# Admin panel: http://localhost:5173

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables (`.env`)
```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## 🔑 Default Admin Credentials (Dev/Demo)

Defined in `AdminContext.tsx → AUTHORIZED_ADMINS`:

| Username | Password | Role | Scope |
|---|---|---|---|
| `superadmin` | `iloveserbisure123` | SUPERADMIN | All Barangays |
| *(Barangay admins)* | *(per barangay)* | ADMIN | Specific barangay |

> These hardcoded credentials are for local/demo use. Real admin logins go through the backend JWT endpoint. Any plan touching auth must not treat this fallback as real security.

---

## 📋 Key Component Behaviors

### `VerificationQueue.tsx`
- Fetches and displays paginated verification requests
- Supports filtering by role (Kasambahay/Homeowner), status, and barangay
- Clicking a row opens `DocumentPreview` in a side panel

### `DocumentPreview.tsx`
- Shows document image(s), OCR extracted data, and discrepancy warnings
- Approve / Reject / Reset action buttons call `reviewVerification()` from the API
- Discrepancies are color-coded by severity: `low` → green, `medium` → yellow, `high/critical` → red

### `IdentityComparisonModal.tsx`
- Side-by-side comparison: document photo vs. profile selfie
- Shows OCR match score and field-by-field discrepancies
- Opened via `openComparisonModal(id)` from context

### `DashboardActivityTable.tsx`
- Displays bookings and flags RA 10361 violations (below minimum wage, missing benefits)
- Supports SUPERADMIN vs ADMIN scoped views

---

## 🧩 Important Conventions

1. **Always use `useAdmin()`** to access global state — never duplicate or lift state locally if it belongs globally
2. **Barangay scoping:** ADMIN role users see only their assigned barangay; SUPERADMIN sees all. Always pass `selectedBarangay` to API calls
3. **Refresh after mutations:** After `approveVerification`, `rejectVerification`, or `resetVerification`, the context auto-refreshes the queue
4. **Null-safe rendering:** Many fields on `VerificationRequest` are optional — always use optional chaining (`?.`)
5. **No direct fetch():** Always use `fetchApi()` from `apiClient.ts` — it handles auth headers automatically
6. **Type-only imports:** Use `import type { Foo }` for type-only imports
7. **Chart components** use raw data from context state — they do not fetch independently

---

## 📂 Adding a New Page

1. Create `src/pages/NewPage.tsx`
2. Import and conditionally render in `App.tsx → MainLayout`:
   ```tsx
   {activeNav === 'new-page' && <NewPage />}
   ```
3. Add nav item to `Sidebar.tsx`
4. Add API function to `adminApi.ts` if the page needs backend data
5. Add types to `types/admin.ts`
6. If the page needs global state: extend `AdminContext.tsx`

---
---

# 🧭 Operating Procedures — Claude Plans, Gemini Implements

Everything below is the mechanical process both agents must follow on every task. This is not optional guidance — treat it as the contract.

## 📋 Plan Template (Claude MUST use this structure for every task)

Every plan Claude produces follows this exact structure, in this order. Write "N/A" if a section truly doesn't apply — never omit a section.

```markdown
### 1. Task Summary
One or two sentences: what is being built/changed and why.

### 2. Files Touched
Exact file paths. For each: CREATE / MODIFY / DELETE.
No wildcards, no "and related files" — list every file explicitly.

### 3. Backend Dependencies
Any API endpoint, field, or type that does not currently exist and must be
added or confirmed before this works. If none:
"None — all required endpoints/types already exist in adminApi.ts / admin.ts."

### 4. Step-by-Step Instructions
Numbered, in execution order. Each step states:
- Exactly what to change and where (file + function/component name)
- Exact prop/variable/type names, pulled from the existing codebase — never invented
- Which existing convention it follows (e.g., "use fetchApi() per apiClient.ts")

### 5. UI States Checklist (required for any UI-facing step)
For each new/changed UI element:
- Loading state
- Empty state
- Error state
- Success/confirmation state (especially for approve/reject/reset/delete)

### 6. Edge Cases To Handle
List every relevant edge case by name from the library below, plus any
task-specific edge case. Enumerate — don't write "handle edge cases."

### 7. Out of Scope
What Gemini must NOT touch, even if it seems related or tempting to fix
while in there.

### 8. Definition of Done
Base checklist (below) + task-specific items, as literal checkboxes.

### 9. Verification Steps for Gemini
Task-specific additions to the base Self-Verification Protocol below.
```

**Before finalizing a plan, Claude must:**
- Actually check `src/types/admin.ts` and `src/api/adminApi.ts` for every name used in the plan — never assume a field/endpoint exists from memory of a similar app.
- If the request is ambiguous (e.g., doesn't say what happens on error, or doesn't specify copy/wording), resolve the ambiguity in the plan itself rather than leaving it for Gemini to decide. If it genuinely can't be resolved without the user's input, ask the user before finalizing — don't hand Gemini an open question.

---

## 🤖 Rules for Gemini (Implementation Agent)

Gemini is optimized for cheap, fast execution — not judgment calls. Follow these exactly, even when you think you see a better way.

1. **No plan, no code.** If you weren't given a plan in the structure above, stop and request one. Do not infer a plan from a vague instruction.
2. **Follow the plan literally.** Don't rename variables, restructure files, "clean up" code, or change approach mid-implementation, even if you think your way is better. If you believe a step is wrong, stop and flag that specific step — don't silently deviate.
3. **Never invent an API.** Every endpoint, function, prop, or type you use must already exist in `adminApi.ts` / `admin.ts`, or be explicitly listed as a new addition in the plan. If you're about to type a field name you're not certain exists, check `src/types/admin.ts` first — never guess.
4. **Never touch files outside "Files Touched."** If finishing the task seems to require a file not listed, stop and flag it — don't just do it.
5. **Respect "Out of Scope" absolutely.** No unrequested "fixes," even one-liners, without adding them to the plan first.
6. **No silent scope creep.** Don't add extra props, validation, or polish that wasn't in the plan. Flag what you think is missing — don't add it unilaterally.
7. **Match existing conventions exactly** — see [Important Conventions](#-important-conventions): `useAdmin()` for state, `fetchApi()` for calls, `clsx()` for conditional classes, `import type` for type-only imports, optional chaining on `VerificationRequest` fields, refresh-after-mutation, barangay scoping on every relevant call.
8. **Never fabricate data, endpoints, copy, or behavior.** If a plan step is ambiguous, use the closest existing pattern in the codebase verbatim, or flag the ambiguity — don't make something up.
9. **Implement every UI state** listed in the plan's UI States Checklist. A step implementing only the happy path is not done.
10. **Implement every listed edge case.** "Unlikely" is not a reason to skip one that's in the plan.

---

## ✅ Gemini's Self-Verification Protocol (run after every task, before declaring done)

Go through this literally — don't skip items, and don't summarize instead of checking.

1. Re-read "Files Touched." List what you actually touched and diff it against the plan — exactly those files, no more, no fewer.
2. Re-read "Backend Dependencies." Confirm you used only endpoints/fields that exist, or that the plan explicitly said to add.
3. Re-read "Step-by-Step Instructions" one line at a time. For each step, confirm you did exactly that — not a variation of it.
4. Re-read "UI States Checklist." Confirm loading/empty/error/success states are all implemented, not just the happy path.
5. Re-read "Edge Cases To Handle." For each one, point to the specific line/condition in your code that handles it — if you can't point to it, it isn't done.
6. Re-read "Out of Scope." Confirm nothing there was touched.
7. Confirm the code compiles under TypeScript with no new `any` introduced unless the plan explicitly allowed it.
8. Search the codebase for every new function/prop/type name you used — confirm each is either pre-existing or defined by you in this task. Never reference a name as if it already existed when it doesn't.
9. If any item above fails, fix it before declaring done — never report partial completion as complete.
10. Report completion as a literal checklist mirrored against the plan's "Definition of Done," item by item — not a paragraph summary.

If you're unsure whether something matches the plan at any point, stop and ask. A wrong guess costs more in rework than a clarifying question does in time.

---

## 🏁 Base Definition of Done (applies to every task, on top of task-specific items)

- [ ] Code compiles with no new TypeScript errors
- [ ] No files created outside what the plan listed
- [ ] No files touched outside what the plan listed
- [ ] Every UI element has loading, empty, error, and success states (or the plan explicitly says N/A)
- [ ] Every destructive action (reject/delete/reset) has a confirmation step
- [ ] Barangay scoping (`selectedBarangay`) respected on every relevant API call, per role (ADMIN vs SUPERADMIN)
- [ ] Optional chaining used on all optional `VerificationRequest` fields
- [ ] `useAdmin()` used for all global state access — no local state duplicating global state
- [ ] `fetchApi()` used for all network calls — no raw `fetch()`
- [ ] `clsx()` used for all conditional className logic
- [ ] `import type` used for type-only imports
- [ ] Mutating actions (approve/reject/reset) trigger the correct `refresh*()` call
- [ ] No `console.log()` left in
- [ ] No hardcoded credentials, tokens, or barangay names outside existing patterns
- [ ] Every edge case listed in the plan is handled and verifiable in the diff

---

## 🧩 Edge Case Library (check the relevant group for every task)

### Authentication & Session
- Backend login fails **and** the hardcoded fallback also fails → show a clear error, never a blank screen or console-only error.
- Token expires mid-session (a request returns 401) → log the user out and redirect to `LoginPage`, don't show a silent failure or infinite spinner.
- User double-clicks "Login" → prevent duplicate submit requests.
- Username/password fields empty on submit → validate client-side before calling the API.
- The hardcoded `AUTHORIZED_ADMINS` fallback is dev/demo only — any plan touching auth must not treat it as real security.

### Barangay Scoping & Roles
- An ADMIN's assigned barangay is null/undefined → don't silently show all data; show an explicit "No barangay assigned" state and block access.
- SUPERADMIN switches `selectedBarangay` while a filtered view is open → re-fetch, and if the open item is no longer in view, show a clear state rather than letting it silently disappear.
- An ADMIN somehow receives data outside their scope (backend bug) → never render it; treat as an error state.

### Verification Queue
- Queue is empty → explicit empty state, not a blank table.
- Two admins review the same document near-simultaneously → after your action, re-fetch and gracefully handle an already-resolved item (no stale Approve/Reject buttons).
- `ocrExtractedData` is undefined → show "OCR data unavailable," don't crash the panel.
- `ocrDiscrepancies` empty vs. undefined → treat both as "no discrepancies," never crash on `.map()`.
- `documentImageBack` missing for a document type that requires it (e.g., National ID) → show a "back image missing" indicator, don't omit silently.
- Reject attempted with no reason where one is expected → check the real `reviewVerification()` signature for whether reason is required — don't assume either way.
- Reset on an already-PENDING document → no-op or disabled, not an error.
- Very long `documentType`/`name` strings → truncate with ellipsis + full value on hover/title, don't let them break the table layout.

### Identity Comparison Modal
- No profile selfie on file → clear "no selfie on file" placeholder, not a broken image icon.
- OCR match score missing/null → show "not available," never a fabricated 0% or blank chart.
- Modal opened with an invalid/missing id → don't open on broken state; show an error message instead.

### Users Page
- User list empty (e.g., filtered barangay has zero users) → explicit empty state.
- `ra10361Compliant` undefined (not yet evaluated) → distinct "not yet evaluated" state, never shown as falsely non-compliant.
- Search/filter returns zero results → explicit "no matches" state, distinct from "no users at all."

### Dashboard / Analytics
- `dashboardMetrics` null on first load → skeleton/loading state, never `NaN`/`undefined` rendered into KPI cards.
- Monthly trend has fewer than 2 points → show a "not enough data yet" state instead of a broken/garbage line chart.
- Barangay with zero bookings → zero-state chart, not a divide-by-zero crash in a percentage calculation.
- SUPERADMIN cross-barangay breakdown where one barangay has null/zero data → renders alongside barangays that do have data without breaking layout.

### Booking / RA 10361 Compliance Table
- `offeredWage` exactly equals `minimumWageBaseline` → confirm the actual business rule (`>=` vs `>`) rather than assuming; this is a boundary condition, don't guess.
- Any `statutoryBenefits` flag is undefined rather than boolean → must not be silently treated as `true`; check explicitly.
- Status value not in the current enum (backend adds one before frontend updates) → render the raw value gracefully, don't crash the row.

### Audit Log
- `actor_name` is null → show "System" or "Unknown," never a blank cell or the literal text "null."
- Log list is very long → follow whatever pagination pattern already exists rather than assuming infinite scroll is fine.

### General / Cross-Cutting
- Any API call fails (network error, 500, timeout) → user-facing error state distinct from an empty state, never a silent `console.error` only.
- Any list/table — design and implement for zero, one, and many items, not just "many."
- Web-only, but must not fully break at a laptop-minimum width — don't assume unlimited horizontal space.
- Rapid repeated clicks on an action button (approve/reject/refresh) → debounce/disable during the in-flight request, no duplicate requests.
- Any currency/number field (wages, stats) → format consistently (peso sign, thousands separators) per existing convention — check for one before inventing formatting.

---

## 🧯 What To Do When Something Doesn't Fit

- **Claude, mid-planning:** if the codebase doesn't match what the request assumes (a field, an endpoint, a component doesn't exist), don't plan around a guess — say so explicitly in the plan and either add the missing piece as a step or ask the user.
- **Gemini, mid-implementation:** if you hit anything not covered by the plan — a missing type, an edge case you weren't told about, a step that doesn't make sense against the actual code — stop and report it instead of resolving it yourself. Flag the exact step number and what's blocking it.
- Neither agent should ship a guess. A flagged uncertainty is always cheaper to fix than a wrong assumption shipped as done.