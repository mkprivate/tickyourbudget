# 8. Business Rules & Logic

## 8.1 Transaction Generation (`transaction-engine.js`)

**Function:** `generateTransactionsForMonth(profileId, year, month)`

**Flow:**
1. Fetch all budget items for the profile.
2. Fetch existing transactions for the target month (via compound index range query on `[profileId, startOfMonth]` to `[profileId, endOfMonth]`).
3. Count existing transactions per `budgetItemId` for this month, and build a date-key set of `"budgetItemId|date"`.
4. For each budget item, calculate expected occurrences in the month via `getOccurrencesInMonth()`.
5. Compare existing count vs expected count. Only create new transactions if `existingCount < expectedOccurrences`. For each new occurrence date not already in the key set, create a transaction. This **count-based dedup** prevents duplicates when a budget item's start date is changed (the old transaction remains, and no new one is added since the count already satisfies the expected occurrences).
6. Persist new transactions via `dbAdd()`.
7. Return all transactions (existing + new) sorted by date ascending.

**Critical rule:** Existing transactions are NEVER modified or deleted by this function. Only new ones are added.

## 8.2 Occurrence Calculation (`getOccurrencesInMonth`)

Given a budget item, a year, and a month (0-indexed), returns an array of `YYYY-MM-DD` date strings.

**Pre-checks:**
- If `startDate > endOfMonth`, returns `[]`.
- If `endDate` is set and `endDate < startOfMonth`, returns `[]`.

| Frequency     | Algorithm                                                                                                                                                                     |
|---------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **One Time**  | If `startDate` year+month matches target year+month → `[startDate]`, else `[]`                                                                                                |
| **Monthly**   | Day = `min(startDate.day, lastDayOfMonth)`. If resulting date ≥ startDate → include. Handles months with fewer days (e.g., Feb 28).                                           |
| **Weekly**    | Fast-forward cursor from `startDate` by full weeks to reach ≥ monthStart. Then iterate +7 days, collecting dates within `[monthStart, monthEnd]` that are also ≥ `startDate`. |
| **Bi-Weekly** | Same as weekly but with 14-day intervals.                                                                                                                                     |
| **Quarterly** | Convert months to absolute (year×12 + month). If `(targetAbsMonth - startAbsMonth) % 3 === 0` and diff ≥ 0 → include. Day clamped to month length.                            |
| **Yearly**    | If target month matches startDate month and target year ≥ startDate year → include. Day clamped to month length.                                                              |

**Post-filter:** If `endDate` is set, all computed occurrence dates after `endDate` are filtered out.

## 8.3 Snapshot Immutability

When a transaction is created, it captures:
- `snapshotName` ← current `budgetItem.name`
- `snapshotAmount` ← current `budgetItem.amount`

After creation, editing the budget item does **NOT** retroactively change existing transactions. Only newly generated transactions will use the updated name/amount.

However, users **can** directly edit a transaction's `snapshotAmount` (see §8.4a). This only changes the individual transaction — the source budget item is never modified.

## 8.4 Transaction Status Toggle

**Function:** `toggleTransactionStatus(transaction)`

Flips `status` between `"Pending"` ↔ `"Paid"` and persists via `dbPut()`. Returns the updated transaction object.

## 8.4a Transaction Amount Edit

**Function:** `updateTransactionAmount(transaction, newAmount)`

Sets `transaction.snapshotAmount` to the new value and persists via `dbPut()`. The source budget item is **NOT** touched — only this specific transaction's snapshot is changed.

## 8.4b Transaction Deletion

**Function:** `deleteTransaction(transactionId)`

Deletes a single transaction from IndexedDB via `dbDelete()`. Does **NOT** affect the source budget item or other transactions.

**UI flow:**
1. User taps the amount area on a checklist item → edit modal opens.
2. Modal includes a “Delete Transaction” danger button at the bottom.
3. Clicking it shows a confirm dialog.
4. On confirm, the transaction is deleted and `renderHome()` re-renders.

## 8.5 Profile Isolation

All data queries are scoped by `profileId`. Changing the profile dropdown:
1. Updates `localStorage` key `tyb_active_profile`.
2. Calls `onProfileChange` callback.
3. Current view re-renders with data from the new profile.

No data from other profiles is ever visible.

## 8.6 Delete Cascading

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

## 8.7 Month Query Range

Transactions for a month are queried using the compound index `profileId_date`:
- Lower bound: `[profileId, "YYYY-MM-01"]`
- Upper bound: `[profileId, "YYYY-MM-DD"]` where DD is last day of month

Uses `IDBKeyRange.bound()` for inclusive range scan.

## 8.8 Auto-Default Profile & Category

On first launch, `ensureDefaultProfile()`:
1. Checks if any profiles exist.
2. If none, creates a "Personal" profile.
3. Sets it as the active profile.
4. Creates a "General" category for that profile (so the user can immediately add budget items without first creating a category).
