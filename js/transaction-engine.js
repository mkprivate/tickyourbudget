// js/transaction-engine.js — Generates transactions from budget items for a given month

import {
  FREQUENCY,
  TX_STATUS,
  createTransaction,
} from './models.js';
import {
  getProfileBudgetItems,
  getTransactionsForMonth,
  dbAdd,
  dbPut,
  STORES,
} from './db.js';

/**
 * Determines if a budget item should produce an occurrence in the given month.
 * Returns an array of dates (YYYY-MM-DD strings) on which it occurs.
 */
function getOccurrencesInMonth(item, year, month) {
  const startDate = new Date(item.startDate + 'T00:00:00');
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0); // last day of month

  // If startDate is after the end of the target month, no occurrences
  if (startDate > monthEnd) return [];

  // If item has an endDate and it's before the start of the target month, no occurrences
  const endDate = item.endDate ? new Date(item.endDate + 'T00:00:00') : null;
  if (endDate && endDate < monthStart) return [];

  const dates = [];

  switch (item.frequency) {
    case FREQUENCY.ONE_TIME: {
      // Only occurs if the start date falls within this month
      if (
        startDate.getFullYear() === year &&
        startDate.getMonth() === month
      ) {
        dates.push(item.startDate);
      }
      break;
    }

    case FREQUENCY.MONTHLY: {
      // Occurs on the same day each month
      const day = Math.min(startDate.getDate(), monthEnd.getDate());
      const occDate = new Date(year, month, day);
      if (occDate >= startDate) {
        dates.push(formatDateISO(occDate));
      }
      break;
    }

    case FREQUENCY.WEEKLY: {
      // Every 7 days from start
      let cursor = new Date(startDate);
      // Fast-forward to the beginning of the target month or just before
      if (cursor < monthStart) {
        const daysDiff = Math.floor((monthStart - cursor) / 86400000);
        const weeksBehind = Math.floor(daysDiff / 7);
        cursor = new Date(cursor.getTime() + weeksBehind * 7 * 86400000);
      }
      while (cursor <= monthEnd) {
        if (cursor >= monthStart && cursor >= startDate) {
          dates.push(formatDateISO(cursor));
        }
        cursor = new Date(cursor.getTime() + 7 * 86400000);
      }
      break;
    }

    case FREQUENCY.BI_WEEKLY: {
      let cursor = new Date(startDate);
      if (cursor < monthStart) {
        const daysDiff = Math.floor((monthStart - cursor) / 86400000);
        const periodsBehind = Math.floor(daysDiff / 14);
        cursor = new Date(cursor.getTime() + periodsBehind * 14 * 86400000);
      }
      while (cursor <= monthEnd) {
        if (cursor >= monthStart && cursor >= startDate) {
          dates.push(formatDateISO(cursor));
        }
        cursor = new Date(cursor.getTime() + 14 * 86400000);
      }
      break;
    }

    case FREQUENCY.QUARTERLY: {
      // Every 3 months from start date
      const startMonth = startDate.getFullYear() * 12 + startDate.getMonth();
      const targetMonth = year * 12 + month;
      const diff = targetMonth - startMonth;
      if (diff >= 0 && diff % 3 === 0) {
        const day = Math.min(startDate.getDate(), monthEnd.getDate());
        dates.push(formatDateISO(new Date(year, month, day)));
      }
      break;
    }

    case FREQUENCY.YEARLY: {
      // Same month and day each year
      if (startDate.getMonth() === month && year >= startDate.getFullYear()) {
        const day = Math.min(startDate.getDate(), monthEnd.getDate());
        dates.push(formatDateISO(new Date(year, month, day)));
      }
      break;
    }
  }

  // Filter out occurrences after endDate
  if (endDate) {
    return dates.filter(d => new Date(d + 'T00:00:00') <= endDate);
  }

  return dates;
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generate (or reconcile) transactions for a given month.
 * - Creates new transactions for budget items that don't have one yet.
 * - Does NOT delete transactions for removed budget items (orphan preservation).
 * Returns the full list of transactions for the month.
 */
async function generateTransactionsForMonth(profileId, year, month) {
  const budgetItems = await getProfileBudgetItems(profileId);
  const existingTxns = await getTransactionsForMonth(profileId, year, month);

  // Build a set of existing (budgetItemId + date) for dedup
  const existingKeys = new Set(
    existingTxns.map((t) => `${t.budgetItemId}|${t.date}`)
  );

  const newTxns = [];

  for (const item of budgetItems) {
    const occurrences = getOccurrencesInMonth(item, year, month);
    for (const date of occurrences) {
      const key = `${item.id}|${date}`;
      if (!existingKeys.has(key)) {
        const txn = createTransaction({
          budgetItemId: item.id,
          profileId,
          date,
          amount: item.amount,
          name: item.name,
        });
        await dbAdd(STORES.TRANSACTIONS, txn);
        newTxns.push(txn);
      }
    }
  }

  // Return all transactions for the month (existing + newly created)
  return [...existingTxns, ...newTxns].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Toggle a transaction's status between Pending and Paid.
 */
async function toggleTransactionStatus(transaction) {
  transaction.status =
    transaction.status === TX_STATUS.PAID ? TX_STATUS.PENDING : TX_STATUS.PAID;
  await dbPut(STORES.TRANSACTIONS, transaction);
  return transaction;
}

export {
  getOccurrencesInMonth,
  generateTransactionsForMonth,
  toggleTransactionStatus,
};
