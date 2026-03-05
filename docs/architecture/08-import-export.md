# 9. Import / Export Schema & Validation

## Export format (single profile — JSON Preview)

```json
{
  "profile": { "id": "uuid", "name": "string" },
  "categories": [ { "id": "uuid", "profileId": "uuid", "name": "string", "description": "string", "parentId": "uuid|null" } ],
  "budgetItems": [ { "id": "uuid", "profileId": "uuid", "categoryId": "uuid", "name": "string", "amount": 0.00, "description": "string", "frequency": "Monthly", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD|null" } ],
  "transactions": [ { "id": "uuid", "budgetItemId": "uuid", "profileId": "uuid", "date": "YYYY-MM-DD", "status": "Pending|Paid", "snapshotAmount": 0.00, "snapshotName": "string" } ]
}
```

## Export format (all data — Download JSON)

```json
{
  "profiles": [ ... ],
  "categories": [ ... ],
  "budgetItems": [ ... ],
  "transactions": [ ... ]
}
```

## Export format (CSV — current profile complete data)

One row per transaction, grouped by budget item. Items without transactions get a single row. Orphan transactions (deleted item) are appended.

```csv
Profile,Category,Item Name,Item Amount,Frequency,Start Date,End Date,Description,Transaction Date,Transaction Status,Transaction Amount
Personal,Subscriptions,Netflix,15.99,Monthly,2026-01-01,,Standard plan,2026-03-01,Paid,15.99
```

## Import validation rules (`importData()`)

The import function accepts both formats (single `profile` key or plural `profiles` key).

| Entity      | Required fields                                   | Validation                   |
|-------------|---------------------------------------------------|------------------------------|
| Profile     | `id`, `name`                                      | Both must be truthy          |
| Category    | `id`, `profileId`, `name`                         | All must be truthy           |
| Budget Item | `id`, `profileId`, `categoryId`, `name`, `amount` | All truthy; `amount != null` |
| Transaction | `id`, `budgetItemId`, `profileId`, `date`         | All must be truthy           |

### Profile name deduplication

Before writing, `importData()` loads all existing profiles and builds a `name → id` map (case-insensitive). If an imported profile’s name matches an existing profile’s name but has a different `id`, the imported `id` is **remapped** to the existing profile’s `id`. All categories, budget items, and transactions referencing the old `id` are remapped accordingly. The duplicate profile record is **not** written.

This prevents confusing duplicate profile names when importing data that was exported from another device or browser.

Import uses `dbPut()` (upsert) — existing records with the same `id` are overwritten.

On validation failure: throws `Error` with descriptive message → caught by caller → displayed as error toast.
