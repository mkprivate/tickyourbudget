# APP.md — tickyourbudget Complete Application Specification

> This document is the single source of truth for the tickyourbudget application.
> It is written for both LLM AI agents and human developers to understand the full
> architecture, data flow, UI behaviour, business rules, and file-level implementation.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technical Architecture](#2-technical-architecture)
3. [File Map & Module Responsibilities](#3-file-map--module-responsibilities)
4. [Data Models & IndexedDB Schema](#4-data-models--indexeddb-schema)
5. [Application State Management](#5-application-state-management)
6. [UI Layout & Component Hierarchy](#6-ui-layout--component-hierarchy)
7. [View Specifications & Behaviour](#7-view-specifications--behaviour)
8. [Business Rules & Logic](#8-business-rules--logic)
9. [Import / Export Schema & Validation](#9-import--export-schema--validation)
10. [Theming System](#10-theming-system)
11. [PWA & Offline Strategy](#11-pwa--offline-strategy)
12. [Deployment (GitHub Pages)](#12-deployment-github-pages)
13. [Known Constraints & Edge Cases](#13-known-constraints--edge-cases)

---

## 1. Overview

**tickyourbudget** is a lightweight, offline-first Progressive Web App (PWA) that works as a monthly budget checklist. Users define recurring budget items (templates), the app generates concrete transactions for each month, and users check them off as paid.

**Core concept:** Budget Item (the rule) → Transaction (the occurrence).

| Attribute | Value |
|-----------|-------|
| Platform | PWA (installable, offline-first) |
| Frameworks | None — pure vanilla HTML5, CSS3, ES6+ |
| Database | IndexedDB (client-side only, no server) |
| Hosting | GitHub Pages (static files) |
| Auth | None (single-device, local storage) |

---

## 2. Technical Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Browser                           │
│                                                      │
│  ┌──────────────┐   ┌──────────────────────────────┐ │
│  │ Service Worker│   │         index.html           │ │
│  │   (sw.js)    │   │  ┌────────────────────────┐  │ │
│  │  cache-first │   │  │      app.js (entry)     │  │ │
│  └──────────────┘   │  │  ┌──────┐ ┌──────────┐ │  │ │
│                     │  │  │Router│ │  State    │ │  │ │
│                     │  │  └──────┘ │(localStorage│ │ │
│                     │  │           │ + callbacks)│ │  │ │
│                     │  │           └──────────┘ │  │ │
│                     │  └────────┬───────────────┘  │ │
│                     │           │                   │ │
│                     │  ┌────────▼───────────────┐  │ │
│                     │  │       Views             │  │ │
│                     │  │ home │ items │ cats│data│  │ │
│                     │  └────────┬───────────────┘  │ │
│                     │           │                   │ │
│                     │  ┌────────▼───────────────┐  │ │
│                     │  │     Components          │  │ │
│                     │  │ modal│toast│theme│profile│ │ │
│                     │  └────────┬───────────────┘  │ │
│                     │           │                   │ │
│                     │  ┌────────▼───────────────┐  │ │
│                     │  │   db.js + models.js     │  │ │
│                     │  │  transaction-engine.js  │  │ │
│                     │  └────────┬───────────────┘  │ │
│                     │           │                   │ │
│                     │  ┌────────▼───────────────┐  │ │
│                     │  │      IndexedDB          │  │ │
│                     │  │ profiles│categories│    │  │ │
│                     │  │ budgetItems│transactions│  │ │
│                     │  └────────────────────────┘  │ │
│                     └──────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Module loading

All JavaScript uses ES6 module syntax (`import`/`export`). The entry point is `js/app.js`, loaded via `<script type="module">` in `index.html`. No bundler, no transpiler — files are served as-is.

---

## 3. File Map & Module Responsibilities

```
tickyourbudget.github.io/
├── index.html                     → Single-page app shell (all views as <section> elements)
├── manifest.json                  → PWA manifest (name, icons, theme, display mode)
├── sw.js                          → Service Worker (cache-first offline strategy)
├── css/
│   └── styles.css                 → Complete stylesheet (1172 lines, light+dark themes)
├── js/
│   ├── app.js                     → Entry point: init DB, theme, profiles, views, router
│   ├── db.js                      → IndexedDB wrapper (CRUD, indexes, import/export)
│   ├── models.js                  → Factory functions, enums (FREQUENCY, TX_STATUS), formatters
│   ├── transaction-engine.js      → Occurrence calculation + transaction generation/reconciliation
│   ├── components/
│   │   ├── modal.js               → openModal() + showConfirm() — bottom-sheet modal system
│   │   ├── toast.js               → showToast(message, type) — auto-dismiss notifications
│   │   ├── theme.js               → Dark/light toggle, localStorage persistence, system detection
│   │   └── profile.js             → Profile CRUD, selector dropdown, cascade delete
│   └── views/
│       ├── home.js                → Checklist view: month nav, summary, grouped transactions
│       ├── items.js               → Budget items: card list, add/edit/delete with modal forms
│       ├── categories.js          → Category tree: parent/child, add/edit/delete
│       └── data.js                → JSON preview, export, import, sample data, clear
├── icons/
│   ├── icon-192.png               → PWA icon 192×192
│   ├── icon-192.svg               → Source SVG
│   ├── icon-512.png               → PWA icon 512×512
│   └── icon-512.svg               → Source SVG
└── .github/
    └── workflows/
        └── deploy.yml             → GitHub Actions: deploy static files to GitHub Pages
```

### Module dependency graph

```
app.js
├── db.js
├── components/theme.js
├── components/profile.js
│   ├── db.js
│   ├── models.js
│   ├── components/modal.js
│   └── components/toast.js
├── views/home.js
│   ├── db.js
│   ├── transaction-engine.js
│   │   ├── models.js
│   │   └── db.js
│   ├── models.js
│   └── components/profile.js
├── views/items.js
│   ├── db.js
│   ├── models.js
│   ├── components/profile.js
│   ├── components/modal.js
│   └── components/toast.js
├── views/categories.js
│   ├── db.js
│   ├── models.js
│   ├── components/profile.js
│   ├── components/modal.js
│   └── components/toast.js
└── views/data.js
    ├── db.js
    ├── models.js
    ├── components/profile.js
    ├── components/modal.js
    └── components/toast.js
```

---

## 4. Data Models & IndexedDB Schema

### Database: `tickyourbudget`, Version: `1`

Four object stores, all using `id` as `keyPath`.

### 4.1 Profile

Represents a distinct budget context (e.g., "Personal", "Family").

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | String (UUID) | Yes | Primary key |
| `name` | String | Yes | Display name |

**Indexes:** None (queried by `id` or `getAll`).

**Factory:** `createProfile(name)` → `{ id, name }`

### 4.2 Category

Hierarchical taxonomy for budget items. Supports **one level** of nesting (parent → children).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | String (UUID) | Yes | Primary key |
| `profileId` | String (UUID) | Yes | FK → Profile |
| `name` | String | Yes | Display name (max 50 chars in UI) |
| `description` | String | No | Optional description (max 200 chars in UI) |
| `parentId` | String (UUID) \| null | No | FK → Category (parent). `null` = top-level |

**Indexes:**
- `profileId` → non-unique
- `parentId` → non-unique

**Factory:** `createCategory({ profileId, name, description, parentId })`

**Nesting rule:** A category with `parentId = null` is a parent. A category with a `parentId` pointing to another category is a child. Children cannot have children (max 1 level deep). The UI enforces this by only showing the "Add sub-category" button on parent nodes.

### 4.3 Budget Item (The Template / Rule)

Defines a recurring or one-time expense/income with a frequency and start date.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | String (UUID) | Yes | Primary key |
| `profileId` | String (UUID) | Yes | FK → Profile |
| `categoryId` | String (UUID) | Yes | FK → Category |
| `name` | String | Yes | Display name (max 100 chars in UI) |
| `amount` | Number (float) | Yes | Default amount in USD |
| `description` | String | No | Optional notes (max 200 chars in UI) |
| `frequency` | String (Enum) | Yes | One of the FREQUENCY values (see below) |
| `startDate` | String (YYYY-MM-DD) | Yes | When occurrences begin |

**Indexes:**
- `profileId` → non-unique
- `categoryId` → non-unique

**Factory:** `createBudgetItem({ profileId, categoryId, name, amount, description, frequency, startDate })`

**FREQUENCY Enum values:**

| Value | String | Meaning |
|-------|--------|---------|
| `ONE_TIME` | `"One Time"` | Occurs only in the month of `startDate` |
| `WEEKLY` | `"Weekly"` | Every 7 days from `startDate` |
| `BI_WEEKLY` | `"Bi-Weekly"` | Every 14 days from `startDate` |
| `MONTHLY` | `"Monthly"` | Same day each month (clamped to month length) |
| `QUARTERLY` | `"Quarterly"` | Every 3 months from `startDate` month |
| `YEARLY` | `"Yearly"` | Same month and day each year |

### 4.4 Transaction (The Occurrence / Snapshot)

A concrete instance of a budget item for a specific date. Created by the transaction engine and persisted in IndexedDB.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | String (UUID) | Yes | Primary key |
| `budgetItemId` | String (UUID) | Yes | FK → Budget Item |
| `profileId` | String (UUID) | Yes | FK → Profile |
| `date` | String (YYYY-MM-DD) | Yes | The specific occurrence date |
| `status` | String (Enum) | Yes | `"Pending"` or `"Paid"` |
| `snapshotAmount` | Number (float) | Yes | Amount at time of creation |
| `snapshotName` | String | Yes | Name at time of creation |

**Indexes:**
- `profileId` → non-unique
- `budgetItemId` → non-unique
- `date` → non-unique
- `profileId_date` → compound index `[profileId, date]` (used for month range queries)

**Factory:** `createTransaction({ budgetItemId, profileId, date, amount, name })`

**TX_STATUS Enum:**

| Value | String |
|-------|--------|
| `PENDING` | `"Pending"` |
| `PAID` | `"Paid"` |

### 4.5 UUID Generation

Uses `crypto.randomUUID()` in secure contexts (HTTPS / localhost). Falls back to a Math.random-based UUID v4 implementation otherwise.

---

## 5. Application State Management

There is **no central state store**. State is managed through:

| State | Storage | Accessed Via |
|-------|---------|--------------|
| Active Profile ID | `localStorage` key `tyb_active_profile` | `getActiveProfileId()` / `setActiveProfileId(id)` |
| Theme (dark/light) | `localStorage` key `tyb_theme` | `initTheme()` / `toggleTheme()` |
| Current View | In-memory variable `currentView` in `app.js` | Set by navigation click handler |
| Current Month/Year | In-memory variables in `home.js` | `currentYear`, `currentMonth` |
| All persistent data | IndexedDB `tickyourbudget` DB | `db.js` async functions |

### Callback system

Two callback functions enable cross-module reactivity:

1. **`onProfileChange`** (set via `setProfileChangeCallback`): Called when the profile dropdown changes. Triggers `renderCurrentView()`.
2. **`onDataChange`** (set via `setDataChangeCallback`): Called after import, sample load, or clear. Triggers `renderCurrentView()`.

---

## 6. UI Layout & Component Hierarchy

### 6.1 Page layout

```
┌─────────────────────────────────┐
│         App Header (fixed)      │  56px height
│  [tickyourbudget]  [Profile▾][⚙][☀]
├─────────────────────────────────┤
│                                 │
│         Toast Container         │  Floating, z-index: 300
│                                 │
├─────────────────────────────────┤
│                                 │
│       Main Content Area         │  padding-top: 68px
│       (max-width: 600px)        │  padding-bottom: 84px
│       (centered)                │
│                                 │
│   ┌───────────────────────┐     │
│   │   Active View Section │     │  Only one visible at a time
│   │   (Home/Items/Cats/   │     │
│   │    Data)               │     │
│   └───────────────────────┘     │
│                                 │
│              [FAB +]            │  Floating, bottom-right
│                                 │  Only on Items & Categories views
├─────────────────────────────────┤
│       Bottom Navigation (fixed) │  64px height
│  [✓Home] [📄Items] [📁Cats] [🗄Data]
└─────────────────────────────────┘
```

### 6.2 App Header elements

| Position | Element | Behaviour |
|----------|---------|-----------|
| Left | App title "tickyourbudget" | Static text, purple accent color |
| Right | Profile `<select>` dropdown | Shows all profiles, changes trigger `onProfileChange` |
| Right | Profile manage button (⚙) | Opens Profile Manager modal |
| Right | Theme toggle (☀/🌙) | Toggles `data-theme` attribute on `<html>` |

### 6.3 Bottom Navigation

4 tabs implemented as `<button class="nav-item">` with `data-view` attribute:

| Tab | data-view | Icon | Active by default |
|-----|-----------|------|-------------------|
| Home | `viewHome` | Checkmark box | Yes |
| Items | `viewItems` | Card/document | No |
| Categories | `viewCategories` | Folder | No |
| Data | `viewData` | Database | No |

**Behaviour:**
- Click → remove `active` class from all nav items and views → add `active` to clicked tab and corresponding `<section>` → hide all FABs → show relevant FAB if Items or Categories → call view renderer.
- CSS: `.view { display: none }` + `.view.active { display: block }` with fade-in animation.

### 6.4 Modal system (`components/modal.js`)

**`openModal(title, contentHTML, options)`**
- Creates a bottom-sheet overlay (`modal-overlay`)
- On desktop (≥500px), centers vertically instead
- Returns `{ overlay, close }` object
- Closes on: close button click, overlay click, Escape key

**`showConfirm(title, message, options)`**
- Creates a centered confirmation dialog
- Returns a `Promise<boolean>` (`true` = confirm, `false` = cancel)
- Options: `{ okText, cancelText, danger }` — `danger: true` uses red styling for the confirm button

### 6.5 Toast system (`components/toast.js`)

**`showToast(message, type)`**
- `type`: `"success"` | `"error"` | `"info"` (default)
- Appended to `#toastContainer` (fixed, top-center, z-index 300)
- Auto-removes after 3 seconds
- CSS animation: slide-in + fade-out at 2.5s

---

## 7. View Specifications & Behaviour

### 7.1 Home View (`views/home.js`)

**Purpose:** Primary checklist interface. Displays transactions for a selected month.

#### Month Navigation Bar

```
[ ◄ ] [ February 2026 ] [ ► ] [Today]
```

| Element | Behaviour |
|---------|-----------|
| `◄` (Previous) | Decrements `currentMonth`. If < 0, wraps to December of previous year. Calls `renderHome()`. |
| `►` (Next) | Increments `currentMonth`. If > 11, wraps to January of next year. Calls `renderHome()`. |
| Month label | Displays `"Month YYYY"` format via `getMonthLabel()` (e.g., "February 2026"). |
| Today button | Resets `currentYear`/`currentMonth` to today's date. Calls `renderHome()`. |

Navigation is **unbounded** — users can scroll to any past or future month.

#### Summary Bar

3-column grid showing:

| Card | Calculation | Color |
|------|-------------|-------|
| **Total** | Sum of `snapshotAmount` for all transactions in the month | Purple (accent) |
| **Paid** | Sum where `status === "Paid"` | Green |
| **Pending** | Sum where `status === "Pending"` | Amber/Orange |

Updates in real-time when a transaction is toggled.

#### Transaction Checklist

**Rendering flow:**
1. Call `generateTransactionsForMonth(profileId, year, month)` → this creates new transactions for any budget items that don't already have one for this month, and returns the full list sorted by date.
2. Fetch budget items and categories for the current profile.
3. Group transactions by category (using the budget item's `categoryId`) → Map of `{ categoryName, transactions[] }`.
4. Render grouped list with category headers.

**Checklist item anatomy:**
```
┌──────────────────────────────────────┐
│ ○  Netflix          Feb 1, 2026  $15.99 │
└──────────────────────────────────────┘
  │      │                │          │
  │      └─snapshotName   └─date     └─snapshotAmount
  └─ check circle (empty = Pending, filled purple = Paid)
```

**Click behaviour:**
1. User clicks anywhere on the row.
2. Calls `toggleTransactionStatus(transaction)` → flips status in IndexedDB.
3. Toggles `.checked` CSS class on the element (instant visual feedback).
4. Recalculates and updates summary bar totals.

**When checked:** Row gets `opacity: 0.65`, name gets `line-through`, check circle fills purple with white checkmark.

**Empty state:** Shown when no transactions exist for the month. Message: "No transactions this month — Add budget items in the Items tab to get started."

### 7.2 Items View (`views/items.js`)

**Purpose:** CRUD management of budget item templates.

#### Card List

Each budget item renders as a card:

```
┌──────────────────────────────────────┐
│  Netflix                      $15.99 │  ← name + amount
│  Standard plan                       │  ← description (optional)
│  [Subscriptions] [Monthly] [From Feb 1, 2026] │  ← badges
│  ─────────────────────────────────── │
│  [Edit]  [Delete]                    │  ← actions
└──────────────────────────────────────┘
```

**Badges:**
- Category badge (pink background)
- Frequency badge (blue background)
- Start date badge (default accent)

#### Add/Edit Form (Modal)

Opened by: FAB button (+) or Edit button on card.

**Fields:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Name | text input | Yes | max 100 chars |
| Amount | number input | Yes | min=0, step=0.01 |
| Category | select dropdown | Yes | Populated from profile's categories |
| Frequency | select dropdown | Yes | Pre-populated with FREQUENCY_LIST |
| Start Date | date input | Yes | Defaults to today for new items |
| Description | text input | No | max 200 chars |

**Precondition:** At least one category must exist. If no categories, shows toast error: "Please create a category first".

**Submit behaviour:**
- **Add:** Creates via `createBudgetItem()` → `dbAdd()` → toast → close modal → `renderItems()`.
- **Edit:** Spreads existing item, overwrites changed fields → `dbPut()` → toast → close modal → `renderItems()`.

#### Delete Flow

1. First confirm: "Delete [name]? You can choose to also remove all related transactions."
   - Cancel → nothing happens
   - "Delete Item Only" → proceeds to step 2
2. Second confirm: "Also delete all past transactions linked to this item?"
   - "Yes, delete transactions" → calls `deleteTransactionsByBudgetItem(id)` then deletes item
   - "No, keep them" → only deletes the budget item (orphan transactions preserved)
3. Toast confirmation → `renderItems()`

### 7.3 Categories View (`views/categories.js`)

**Purpose:** Manage hierarchical categories (one level of nesting).

#### Tree Layout

```
┌──────────────────────────────────────┐
│  Housing    Rent, mortgage...  [+][✎][🗑] │  ← parent
│    └─ Utilities  Electric...     [✎][🗑] │  ← child (indented, left border)
│                                          │
│  Transportation  Car, gas...   [+][✎][🗑] │
│  Food & Dining   Groceries...  [+][✎][🗑] │
└──────────────────────────────────────┘
```

**Rendering flow:**
1. Fetch all categories for profile.
2. Separate into parents (`parentId === null`) and children.
3. Build a `childMap` (parentId → children[]).
4. Render each parent with its children nested below.
5. Orphan children (parent deleted) render as top-level.

**Action buttons:**
- `[+]` Add sub-category — only on parent nodes (opens category form with `parentId` preset)
- `[✎]` Edit — opens category form pre-filled
- `[🗑]` Delete — with confirmation

#### Add/Edit Form (Modal)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Name | text input | Yes | max 50 chars |
| Description | text input | No | max 200 chars |

Title changes based on context: "Add Category" / "Add Sub-category" / "Edit Category".

#### Delete Flow

Confirmation message dynamically includes:
- Count of sub-categories that will be deleted (if parent)
- Count of budget items that use this category (they become "Uncategorized" in display, `categoryId` becomes a dead reference)

Delete: removes the category + all its children from IndexedDB.

### 7.4 Data View (`views/data.js`)

**Purpose:** Data portability, debugging, and tools.

#### JSON Preview

- Read-only `<textarea>` showing the current profile's complete data as formatted JSON.
- Updated every time the view renders.
- Structure: `{ profile: {...}, categories: [...], budgetItems: [...], transactions: [...] }`

#### Export Section

| Button | Behaviour |
|--------|-----------|
| **Copy to Clipboard** | Copies the JSON preview textarea content. Uses `navigator.clipboard.writeText()` with `document.execCommand('copy')` fallback. |
| **Download .json** | Exports **all profiles** (not just current) as a Blob download. Filename: `tickyourbudget-YYYY-MM-DD.json`. Structure: `{ profiles: [...], categories: [...], budgetItems: [...], transactions: [...] }`. |

#### Import Section

| Button | Behaviour |
|--------|-----------|
| **Import from File** | Opens file picker (`.json` only). Reads file text → `JSON.parse` → `importData()` → refresh. |
| **Paste JSON** | Opens a modal with a textarea. User pastes JSON → submit → `importData()` → refresh. |

#### Tools Section

| Button | Behaviour |
|--------|-----------|
| **Load Sample Data** | Confirm dialog → generates sample data (1 profile, 7 categories, 11 budget items, 0 transactions) → imports → sets active profile to sample → refresh. Does NOT delete existing data. |
| **Clear All Data** | Danger confirm dialog → `dbClearAll()` → clears `localStorage` active profile → refresh. |

---

## 8. Business Rules & Logic

### 8.1 Transaction Generation (`transaction-engine.js`)

**Function:** `generateTransactionsForMonth(profileId, year, month)`

**Flow:**
1. Fetch all budget items for the profile.
2. Fetch existing transactions for the target month (via compound index range query on `[profileId, startOfMonth]` to `[profileId, endOfMonth]`).
3. Build a dedup set of `"budgetItemId|date"` from existing transactions.
4. For each budget item, calculate occurrences in the month via `getOccurrencesInMonth()`.
5. For each occurrence date not in the dedup set, create a new transaction with `status: "Pending"` and snapshot of current name/amount.
6. Persist new transactions via `dbAdd()`.
7. Return all transactions (existing + new) sorted by date ascending.

**Critical rule:** Existing transactions are NEVER modified or deleted by this function. Only new ones are added.

### 8.2 Occurrence Calculation (`getOccurrencesInMonth`)

Given a budget item, a year, and a month (0-indexed), returns an array of `YYYY-MM-DD` date strings.

**Pre-check:** If `startDate > endOfMonth`, returns `[]`.

| Frequency | Algorithm |
|-----------|-----------|
| **One Time** | If `startDate` year+month matches target year+month → `[startDate]`, else `[]` |
| **Monthly** | Day = `min(startDate.day, lastDayOfMonth)`. If resulting date ≥ startDate → include. Handles months with fewer days (e.g., Feb 28). |
| **Weekly** | Fast-forward cursor from `startDate` by full weeks to reach ≥ monthStart. Then iterate +7 days, collecting dates within `[monthStart, monthEnd]` that are also ≥ `startDate`. |
| **Bi-Weekly** | Same as weekly but with 14-day intervals. |
| **Quarterly** | Convert months to absolute (year×12 + month). If `(targetAbsMonth - startAbsMonth) % 3 === 0` and diff ≥ 0 → include. Day clamped to month length. |
| **Yearly** | If target month matches startDate month and target year ≥ startDate year → include. Day clamped to month length. |

### 8.3 Snapshot Immutability

When a transaction is created, it captures:
- `snapshotName` ← current `budgetItem.name`
- `snapshotAmount` ← current `budgetItem.amount`

After creation, editing the budget item does **NOT** retroactively change existing transactions. Only newly generated transactions will use the updated name/amount.

### 8.4 Transaction Status Toggle

**Function:** `toggleTransactionStatus(transaction)`

Flips `status` between `"Pending"` ↔ `"Paid"` and persists via `dbPut()`. Returns the updated transaction object.

### 8.5 Profile Isolation

All data queries are scoped by `profileId`. Changing the profile dropdown:
1. Updates `localStorage` key `tyb_active_profile`.
2. Calls `onProfileChange` callback.
3. Current view re-renders with data from the new profile.

No data from other profiles is ever visible.

### 8.6 Delete Cascading

**Profile deletion:**
- Deletes all categories with matching `profileId`
- Deletes all budget items with matching `profileId`
- Deletes all transactions with matching `profileId`
- Deletes the profile itself
- Switches to next available profile or clears selection

**Category deletion:**
- Deletes all child categories (where `parentId` = this category's `id`)
- Deletes the category itself
- Budget items referencing this category are NOT deleted (they become "Uncategorized" in display)

**Budget item deletion:**
- Optionally deletes linked transactions (user-prompted, 2-step confirmation)
- Deletes the budget item itself

### 8.7 Month Query Range

Transactions for a month are queried using the compound index `profileId_date`:
- Lower bound: `[profileId, "YYYY-MM-01"]`
- Upper bound: `[profileId, "YYYY-MM-DD"]` where DD is last day of month

Uses `IDBKeyRange.bound()` for inclusive range scan.

---

## 9. Import / Export Schema & Validation

### Export format (single profile — JSON Preview)

```json
{
  "profile": { "id": "uuid", "name": "string" },
  "categories": [ { "id": "uuid", "profileId": "uuid", "name": "string", "description": "string", "parentId": "uuid|null" } ],
  "budgetItems": [ { "id": "uuid", "profileId": "uuid", "categoryId": "uuid", "name": "string", "amount": 0.00, "description": "string", "frequency": "Monthly", "startDate": "YYYY-MM-DD" } ],
  "transactions": [ { "id": "uuid", "budgetItemId": "uuid", "profileId": "uuid", "date": "YYYY-MM-DD", "status": "Pending|Paid", "snapshotAmount": 0.00, "snapshotName": "string" } ]
}
```

### Export format (all data — Download)

```json
{
  "profiles": [ ... ],
  "categories": [ ... ],
  "budgetItems": [ ... ],
  "transactions": [ ... ]
}
```

### Import validation rules (`importData()`)

The import function accepts both formats (single `profile` key or plural `profiles` key).

| Entity | Required fields | Validation |
|--------|----------------|------------|
| Profile | `id`, `name` | Both must be truthy |
| Category | `id`, `profileId`, `name` | All must be truthy |
| Budget Item | `id`, `profileId`, `categoryId`, `name`, `amount` | All truthy; `amount != null` |
| Transaction | `id`, `budgetItemId`, `profileId`, `date` | All must be truthy |

Import uses `dbPut()` (upsert) — existing records with the same `id` are overwritten.

On validation failure: throws `Error` with descriptive message → caught by caller → displayed as error toast.

---

## 10. Theming System

### CSS custom properties approach

All colors, shadows, radii, and transitions are defined as CSS custom properties on `:root` (light) and `[data-theme='dark']`.

### Toggle mechanism

1. `<html data-theme="light|dark">` attribute controls the theme.
2. `initTheme()`: reads `localStorage` → falls back to `prefers-color-scheme` media query → applies.
3. `toggleTheme()`: flips attribute → saves to `localStorage` → swaps sun/moon icons → updates `<meta name="theme-color">`.

### Color palette

| Token | Light | Dark |
|-------|-------|------|
| `--bg-primary` | `#faf5ff` (lavender white) | `#1a1625` (deep purple-black) |
| `--bg-card` | `#ffffff` | `#2a2438` |
| `--accent` | `#a78bfa` (violet) | `#a78bfa` (same) |
| `--accent-hover` | `#8b5cf6` | `#c4b5fd` |
| `--text-primary` | `#1e1b2e` | `#f0ecf5` |
| `--success` | `#86efac` | `#86efac` |
| `--danger` | `#fca5a5` | `#fca5a5` |

Design language: **Pastel/friendly** — soft colors, rounded corners (`8px` to `9999px`), subtle shadows with purple tint, smooth 0.2s transitions.

---

## 11. PWA & Offline Strategy

### manifest.json

| Property | Value |
|----------|-------|
| `name` | `"tickyourbudget"` |
| `short_name` | `"tickyourbudget"` |
| `display` | `"standalone"` |
| `background_color` | `"#faf5ff"` |
| `theme_color` | `"#a78bfa"` |
| `start_url` | `"/"` |
| `orientation` | `"portrait-primary"` |
| `icons` | 192×192 and 512×512 PNGs, `purpose: "any maskable"` |

### Service Worker (`sw.js`)

**Strategy:** Cache-first.

**Install event:**
- Opens cache `tyb-cache-v1`.
- Pre-caches all 15 application assets (HTML, CSS, JS modules, manifest, icons).

**Activate event:**
- Deletes any caches with names other than the current version.
- Claims all clients immediately (`self.clients.claim()`).

**Fetch event:**
- Returns cached response if available.
- Otherwise fetches from network, caches successful same-origin responses, returns to page.
- Non-GET requests pass through without caching.

**Registration:** In `app.js` init, `navigator.serviceWorker.register('sw.js')` with error suppression.

---

## 12. Deployment (GitHub Pages)

### GitHub Actions workflow (`.github/workflows/deploy.yml`)

**Trigger:** Push to `main` branch, or manual dispatch.

**Steps:**
1. Checkout repository
2. Configure GitHub Pages
3. Upload entire repository root as pages artifact
4. Deploy via `actions/deploy-pages@v4`

**Required repo settings:**
- Settings → Pages → Source: **GitHub Actions**

**Output URL:** `https://<username>.github.io/` (or custom domain).

**No build step** — files are served as-is since there's no build process.

---

## 13. Known Constraints & Edge Cases

### Functional

| Constraint | Detail |
|-----------|--------|
| No server/auth | All data is local to the browser. Clearing browser data deletes everything. |
| No multi-device sync | Data lives only in IndexedDB on the device where it was created. |
| Single currency | Hardcoded to USD formatting (`Intl.NumberFormat('en-US', { currency: 'USD' })`). |
| Category deletion orphans items | Budget items referencing a deleted category show as "Uncategorized" but the `categoryId` pointer is stale. |
| No undo | Delete operations (profile, category, item, clear) are permanent. |
| Weekly/Bi-Weekly anchoring | Weekly items are anchored to the exact `startDate` weekday and interval — they don't align to calendar weeks. |
| Monthly day clamping | A monthly item starting on the 31st will appear on the 28th/29th/30th in shorter months. |
| Orphan transactions preserved | Deleting a budget item with "keep transactions" leaves transactions whose `budgetItemId` points to a deleted record. These still render their snapshot data correctly. |

### Technical

| Constraint | Detail |
|-----------|--------|
| No URL routing | The app is a single page with view toggling. The URL never changes. Browser back button does not navigate between views. |
| Module script required | Must be served over HTTP(S), not `file://` protocol (ES6 modules require same-origin). |
| IndexedDB required | Private/incognito mode in some browsers restricts IndexedDB. |
| No input validation beyond required | Amount field allows any number ≥ 0; no max limit. |

### Sample Data

The "Load Sample Data" feature creates:
- **1 profile:** "Sample Budget"
- **7 categories:** Housing, Utilities (sub of Housing), Transportation, Food & Dining, Entertainment, Subscriptions (sub of Entertainment), Insurance
- **11 budget items:** Rent ($1500/mo), Electric ($85/mo), Internet ($65/mo), Water ($40/mo), Car Payment ($350/mo), Gas ($50/wk), Grocery Run ($120/wk), Netflix ($15.99/mo), Spotify ($9.99/mo), Health Insurance ($320/mo), Car Insurance ($180/quarterly)
- **0 transactions** — generated on first view of a month

---

*End of specification. This document should be updated whenever the application behaviour changes.*
