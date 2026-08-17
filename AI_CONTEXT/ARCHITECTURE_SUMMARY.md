# ARCHITECTURE SUMMARY
**Version:** 2.2.0 | **Last updated:** 2026-05-28

---

## Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Vanilla JS (ES5/ES6), no bundler | Global variable pattern, IIFE for modules |
| Styling | CSS custom properties (design tokens) | 10 CSS files, load order matters |
| Backend | Google Apps Script (GAS) Web App | Deployed on google.com/script/macros |
| Database | Google Sheets (4 sheets) | MASTER_DATA, LOOKUP, ACTIVITY_LOG, DASHBOARD_READY |
| Transport | JSONP (all requests) | Workaround for GAS CORS issue |
| Auth | Email-based session (sessionStorage) | No real auth, role from ADMIN_EMAILS list |

---

## Page Map

```
login.html          ← Entry point (unauthenticated)
    │ login success
    ▼
index.html          ← Portal home (TPBank BIZ-inspired service cards)
    ├── → register.html   ← 4-step wizard (all authenticated users)
    └── → dashboard.html  ← Admin dashboard + approval (admin only)
```

---

## Auth Architecture

```
AuthService (assets/js/auth.js)
  ├── login(email)
  │     └── _resolveRole(email) → check APP_CONFIG.ADMIN_EMAILS
  │     └── store to sessionStorage['ai_user_session']
  ├── getUser() → {email, displayName, role, loginAt}
  ├── isLoggedIn() → boolean
  ├── isAdmin() → boolean
  ├── requireAuth() → redirect to login.html if not logged in
  └── requireAdmin() → requireAuth() + redirect to index.html if not admin

Session keys:
  ai_user_session  → full user object (new, v2.2.0)
  ai_admin_email   → legacy string, written for dashboard.js compat
```

---

## GAS API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `?action=health` | GET | None | Health check |
| `?action=lookup` | GET | None | Dropdown data |
| `?action=usecase&id=X` | GET | None | Get use case by ID |
| `?action=create&payload=B64` | GET+JSONP | None | Create use case |
| `?action=update&payload=B64` | GET+JSONP | None | Update use case |
| `?action=duplicate-check&payload=B64` | GET+JSONP | None | Check duplicate |
| `?action=list&filter=pending` | GET | None | List use cases |
| `?action=dashboard` | GET | None | Dashboard summary |
| `?action=approve&payload=B64` | GET+JSONP | Admin email in payload | Approve use case |
| `?action=reject&payload=B64` | GET+JSONP | Admin email in payload | Reject use case |

**Note:** GAS has no real auth gate — relies on `reviewer_email` in payload being in ADMIN_EMAILS.

---

## Google Sheets Structure

| Sheet | Purpose | Key Columns |
|-------|---------|-------------|
| MASTER_DATA | All use cases | 55 columns, Record_ID (UUID), UseCase_ID (AIUS-NNNN) |
| LOOKUP | Dropdown options | Field/Category, Value, Active |
| ACTIVITY_LOG | Audit trail | Action, User_Email, Previous/New Status |
| DASHBOARD_READY | Pre-aggregated cache | Refreshed every 30 min |
| CONFIG | System config | NEXT_ID counter, ADMIN_EMAILS |

---

## JS Module Dependency Graph

```
APP_CONFIG (env.js)
  └── AuthService (auth.js)          ← new v2.2.0
  └── API (routes.js)
  └── Storage (storage.js)

FIELDS/STEPS/FIELD_CONFIG (constants.js)
  └── Validator (validation.js)
  └── Wizard + FieldBuilder (wizard.js)

Api (api.js) + APP_CONFIG + API
  └── DuplicateChecker (duplicate-check.js)
  └── app.js (register.html entry)
  └── dashboard.js (dashboard entry)
```

---

## CSS File Load Order (required)

```
1. variables.css   ← tokens (must be first)
2. base.css        ← reset
3. typography.css
4. layout.css      ← app-header, containers
5. components.css  ← buttons, toast, badge
6. forms.css       ← inputs, selects
7. wizard.css      ← wizard-specific (register.html only)
8. states.css      ← loading, error states
9. responsive.css  ← breakpoints (must be last)
10. portal.css     ← portal home (index.html only)
11. login.css      ← login page (login.html only)
12. dashboard.css  ← dashboard (dashboard.html only)
```
