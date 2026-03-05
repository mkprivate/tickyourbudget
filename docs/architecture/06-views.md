# 7. View Specifications & Behaviour

## 7.1 Home View (`views/home.js`)

**Purpose:** Primary checklist interface. Displays transactions for a selected month with progress tracking and spending insights.

The Home view layout (top to bottom):
1. Month navigation bar
2. Search filter (at the top for easy access)
3. Summary bar (Total / Paid / Pending + chart icon button)
4. Progress bar (hidden when no transactions)
5. Month-over-month comparison
6. Transaction checklist (or empty state)

### Month Navigation Bar

```
[ ◄ ] [ February 2026 ] [ ► ] [Today]
```

| Element        | Behaviour                                                                                    |
|----------------|----------------------------------------------------------------------------------------------|
| `◄` (Previous) | Decrements `currentMonth`. If < 0, wraps to December of previous year. Calls `renderHome()`. |
| `►` (Next)     | Increments `currentMonth`. If > 11, wraps to January of next year. Calls `renderHome()`.     |
| Month label    | Displays `"Month YYYY"` format via `getMonthLabel()` (e.g., "February 2026").                |
| Today button   | Resets `currentYear`/`currentMonth` to today's date. Calls `renderHome()`.                   |

Navigation is **unbounded** — users can scroll to any past or future month.

### Summary Bar

4-column grid (`1fr 1fr 1fr auto`) showing:

| Card/Button       | Calculation / Purpose                                    | Color           |
|-------------------|----------------------------------------------------------|-----------------|
| **Total**         | Sum of `snapshotAmount` for all transactions in the month | Purple (accent) |
| **Paid**          | Sum where `status === "Paid"`                             | Green           |
| **Pending**       | Sum where `status === "Pending"`                          | Amber/Orange    |
| **Chart button**  | Opens the category breakdown modal (pie-chart icon)       | Accent          |

The chart button is hidden when no transactions exist. Updates in real-time when a transaction is toggled.

### Progress Bar

Displayed below the summary bar. Shows the percentage of total amount that has been paid:

- Formula: `Math.round((paidAmount / totalAmount) * 100)`
- Visual: Horizontal bar with filled portion + label (e.g., "67% paid")
- Updates instantly when transactions are toggled
- Hidden when no profile is selected or no transactions exist

### Month-over-Month Comparison

Shows the difference between the current month's total and the previous month's total:

- Calculates previous month's transactions via `generateTransactionsForMonth()`
- Displays: `"↑ 12% more than January 2026 ($1,200.00)"` or `"↓ 5% less than ..."`
- Arrow classes: `--up` (increase), `--down` (decrease), `--same` (no change)
- Hidden when both months have zero totals

### Donut Chart Modal (Category Breakdown)

Shows spending distribution by category as an SVG donut chart inside a modal:

- **Trigger:** Pie-chart icon button in the summary bar → calls `showChartModal()`
- **Modal:** Opened via the shared `openModal('Category Breakdown', html)` component
- **Chart:** SVG circles with `stroke-dasharray`/`stroke-dashoffset` for each category slice
- **Center text:** Total amount and "Total" label
- **Legend:** Colored dots with category name, amount, and percentage
- **Colors:** 12-color palette cycling via `CHART_COLORS` array
- Categories sorted by total descending
- Module-scope `lastCategoryTotals` / `lastTotal` cache the data so the modal can open without re-querying
- Chart button hidden when no transactions exist

### Search Filter

Text input with search icon, positioned at the top of the view (right after month nav). Filters the checklist in real-time:

- Matches against transaction name (`snapshotName`) and amount
- Hides non-matching checklist items via `display: none`
- Hides category group headers when all items in the group are hidden
- Cleared when month changes or view re-renders

### Transaction Checklist

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
1. User clicks anywhere on the row **except the amount** → toggles Paid/Pending status.
2. Calls `toggleTransactionStatus(transaction)` → flips status in IndexedDB.
3. Toggles `.checked` CSS class on the element (instant visual feedback).
4. Recalculates and updates summary bar totals and progress bar.

**Amount edit / delete:**
1. User taps the amount area (has a small pencil icon hint).
2. Opens an "Edit Transaction" modal via `openEditAmountModal()` with a pre-filled number input and a "Delete Transaction" danger button.
3. **Save:** calls `updateTransactionAmount()` and re-renders the Home view. Only the transaction's `snapshotAmount` is changed — the source budget item is unaffected.
4. **Delete:** shows a confirm dialog → on confirm, calls `deleteTransaction()` and re-renders. The budget item is unaffected.

**When checked:** Row gets `opacity: 0.65`, name gets `line-through`, check circle fills purple with white checkmark.

**Empty state:** Shown when no transactions exist for the month. Message: "No transactions this month — Add budget items in the Items tab to get started."

---

## 7.2 Items View (`views/items.js`)

**Purpose:** CRUD management of budget item templates.

### Search Filter

Text input at the top. Filters cards in real-time by name, amount, or badge text (category, frequency). Cleared on view re-render.

### Card List

Each budget item renders as a card:

```
┌──────────────────────────────────────┐
│  Netflix                      $15.99 │  ← name + amount
│  Standard plan                       │  ← description (optional)
│  [Subscriptions] [Monthly] [From Feb 1, 2026] [Until Dec 31, 2026] │  ← badges
│  ─────────────────────────────────── │
│  [Edit]  [Delete]                    │  ← actions
└──────────────────────────────────────┘
```

**Badges:**
- Category badge (pink background)
- Frequency badge (blue background)
- Start date badge (default accent)
- End date badge (shown only if `endDate` is set)

### Add/Edit Form (Modal)

Opened by: FAB button (+) or Edit button on card.

**Fields:**

| Field       | Type            | Required | Validation                                            |
|-------------|-----------------|----------|-------------------------------------------------------|
| Name        | text input      | Yes      | max 100 chars                                         |
| Amount      | number input    | Yes      | min=0, step=0.01                                      |
| Category    | select dropdown | Yes      | Populated from profile's categories                   |
| Frequency   | select dropdown | Yes      | Pre-populated with FREQUENCY_LIST                     |
| Start Date  | date input      | Yes      | Defaults to today for new items                       |
| End Date    | date input      | No       | Optional. When set, occurrences stop after this date. |
| Description | text input      | No       | max 200 chars                                         |

**Precondition:** At least one category must exist. If no categories, shows toast error: "Please create a category first".

**Submit behaviour:**
- **Add:** Creates via `createBudgetItem()` → `dbAdd()` → toast → close modal → `renderItems()`.
- **Edit:** Spreads existing item, overwrites changed fields → `dbPut()` → toast → close modal → `renderItems()`.

### Delete Flow

1. First confirm: "Delete [name]? You can choose to also remove all related transactions."
   - Cancel → nothing happens
   - "Delete Item Only" → proceeds to step 2
2. Second confirm: "Also delete all past transactions linked to this item?"
   - "Yes, delete transactions" → calls `deleteTransactionsByBudgetItem(id)` then deletes item
   - "No, keep them" → only deletes the budget item (orphan transactions preserved)
3. Toast confirmation → `renderItems()`

---

## 7.3 Categories View (`views/categories.js`)

**Purpose:** Manage hierarchical categories (one level of nesting).

### Tree Layout

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

### Add/Edit Form (Modal)

| Field           | Type            | Required | Validation    |
|-----------------|-----------------|----------|---------------|
| Name            | text input      | Yes      | max 50 chars  |
| Description     | text input      | No       | max 200 chars |
| Parent Category | select dropdown | No       | See below     |

Title changes based on context: "Add Category" / "Add Sub-category" / "Edit Category".

**Parent Category dropdown** (shown when editing a category):
- Options include "— Root (no parent) —" (default, `parentId = null`) and all eligible root categories (excluding self).
- Allows **moving** a category between root and sub-category levels:
  - **Root → Sub-category:** If the moved category had children, those children are automatically re-parented to root level (`parentId = null`).
  - **Sub-category → Root:** Simply sets `parentId = null`.
  - **Sub-category → different parent:** Updates `parentId` to the new parent.
- When adding a new category via the FAB, no parent dropdown is shown (defaults to root). When adding via the `[+]` button on a parent, `parentId` is preset to that parent.

### Delete Flow

Confirmation message dynamically includes:
- Count of sub-categories that will be deleted (if parent)
- Count of budget items that use this category (they become "Uncategorized" in display, `categoryId` becomes a dead reference)

Delete: removes the category + all its children from IndexedDB.

---

## 7.4 Config View (`views/data.js`)

**Purpose:** Currency settings, data portability, debugging, and tools.

### Currency Section

- Dropdown (`<select id="currencySelect">`) with 20 currency options, each showing: `symbol — name (code)`.
- Populated at init by `initCurrencySelector()` from `CURRENCY_OPTIONS` in `profile.js`.
- Changing the currency saves to `localStorage` key `tyb_currency` via `setCurrency()` and shows a toast.
- Value is updated whenever the Config view renders.

### JSON Preview

- Read-only `<textarea>` showing the current profile's complete data as formatted JSON.
- Updated every time the view renders.
- Structure: `{ profile: {...}, categories: [...], budgetItems: [...], transactions: [...] }`

### Export Section

| Button                | Behaviour                                                                                                                                                                                                                |
|-----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Copy to Clipboard** | Copies the JSON preview textarea content. Uses `navigator.clipboard.writeText()` with `document.execCommand('copy')` fallback.                                                                                           |
| **Download .json**    | Exports **all profiles** (not just current) as a Blob download. Filename: `tickyourbudget-YYYY-MM-DD.json`. Structure: `{ profiles: [...], categories: [...], budgetItems: [...], transactions: [...] }`.                |
| **Download .csv**     | Exports current profile’s complete data as CSV: profile name, categories, budget items, and all transactions. One row per transaction (grouped by item), plus rows for items with no transactions and orphan transactions. Columns: Profile, Category, Item Name, Item Amount, Frequency, Start Date, End Date, Description, Transaction Date, Transaction Status, Transaction Amount. |

### Import Section

| Button               | Behaviour                                                                                    |
|----------------------|----------------------------------------------------------------------------------------------|
| **Import from File** | Opens file picker (`.json` only). Reads file text → `JSON.parse` → `importData()` → refresh. |
| **Paste JSON**       | Opens a modal with a textarea. User pastes JSON → submit → `importData()` → refresh.         |

### Tools Section

| Button               | Behaviour                                                                                                                                                                             |
|----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Load Sample Data** | Confirm dialog → generates sample data (1 profile, 7 categories, 11 budget items, 0 transactions) → imports → sets active profile to sample → refresh. Does NOT delete existing data. |
| **Clear All Data**   | Danger confirm dialog → `dbClearAll()` → clears `localStorage` active profile → refresh.                                                                                              |

---

## 7.5 Profiles View (`components/profile.js` → `renderProfiles()`)

**Purpose:** Manage profiles. Displayed as the 4th tab in the bottom navigation.

### Profile List

Each profile renders as a list item with rename and delete action buttons.

**Add Profile (FAB):**
- FAB button (+) at bottom-right opens a modal form with a profile name input.
- New profile is immediately set as active; selector in header updates.
- Empty state message: "No profiles yet — tap + to create one."

**Rename:**
- Clicking the edit icon replaces the profile name with an inline text input.
- Save on blur or Enter key. Updates IndexedDB and header selector.

**Delete:**
- Confirmation dialog warns about permanent deletion of all profile data.
- Cascade deletes: all categories, budget items, and transactions for the profile.
- Switches to next available profile or clears selection.

### Auto-Default Profile

On first launch (no profiles exist), `ensureDefaultProfile()` creates:
- A "Personal" profile (set as active)
- A "General" category within that profile (so items can be added immediately)
