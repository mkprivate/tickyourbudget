// js/views/home.js — Home View (Transactions checklist)

import { getTransactionsForMonth, getProfileCategories, getProfileBudgetItems } from '../db.js';
import { generateTransactionsForMonth, toggleTransactionStatus } from '../transaction-engine.js';
import { formatCurrency, formatDate, getMonthLabel, TX_STATUS } from '../models.js';
import { getActiveProfileId } from '../components/profile.js';

let currentYear, currentMonth;

function initHomeView() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  document.getElementById('btnPrevMonth').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderHome();
  });

  document.getElementById('btnNextMonth').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderHome();
  });

  document.getElementById('btnToday').addEventListener('click', () => {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    renderHome();
  });
}

async function renderHome() {
  const profileId = getActiveProfileId();
  const monthLabel = document.getElementById('monthLabel');
  const container = document.getElementById('checklistContainer');
  const emptyState = document.getElementById('emptyHome');
  const summaryTotal = document.getElementById('summaryTotal');
  const summaryPaid = document.getElementById('summaryPaid');
  const summaryPending = document.getElementById('summaryPending');

  monthLabel.textContent = getMonthLabel(currentYear, currentMonth);

  if (!profileId) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    summaryTotal.textContent = formatCurrency(0);
    summaryPaid.textContent = formatCurrency(0);
    summaryPending.textContent = formatCurrency(0);
    return;
  }

  // Generate/reconcile transactions for this month
  const transactions = await generateTransactionsForMonth(profileId, currentYear, currentMonth);

  // Get budget items and categories for grouping
  const budgetItems = await getProfileBudgetItems(profileId);
  const categories = await getProfileCategories(profileId);

  const itemMap = new Map(budgetItems.map((i) => [i.id, i]));
  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Calculate summary
  let total = 0, paid = 0, pending = 0;
  for (const txn of transactions) {
    total += txn.snapshotAmount;
    if (txn.status === TX_STATUS.PAID) {
      paid += txn.snapshotAmount;
    } else {
      pending += txn.snapshotAmount;
    }
  }

  summaryTotal.textContent = formatCurrency(total);
  summaryPaid.textContent = formatCurrency(paid);
  summaryPending.textContent = formatCurrency(pending);

  if (transactions.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  // Group by category
  const groups = new Map();
  for (const txn of transactions) {
    const item = itemMap.get(txn.budgetItemId);
    const catId = item ? item.categoryId : '_uncategorized';
    const catName = catMap.has(catId) ? catMap.get(catId).name : 'Uncategorized';
    if (!groups.has(catId)) {
      groups.set(catId, { name: catName, transactions: [] });
    }
    groups.get(catId).transactions.push(txn);
  }

  // Render grouped checklist
  let html = '';
  for (const [catId, group] of groups) {
    html += `<li class="checklist-group">`;
    html += `<div class="checklist-group__title">${escapeHTML(group.name)}</div>`;
    for (const txn of group.transactions) {
      const checked = txn.status === TX_STATUS.PAID ? 'checked' : '';
      html += `
        <div class="checklist-item ${checked}" data-txn-id="${txn.id}">
          <div class="checklist-item__check">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div class="checklist-item__info">
            <div class="checklist-item__name">${escapeHTML(txn.snapshotName)}</div>
            <div class="checklist-item__date">${formatDate(txn.date)}</div>
          </div>
          <div class="checklist-item__amount">${formatCurrency(txn.snapshotAmount)}</div>
        </div>
      `;
    }
    html += `</li>`;
  }

  container.innerHTML = html;

  // Attach click handlers for toggling
  container.querySelectorAll('.checklist-item').forEach((el) => {
    el.addEventListener('click', async () => {
      const txnId = el.dataset.txnId;
      const txn = transactions.find((t) => t.id === txnId);
      if (!txn) return;

      await toggleTransactionStatus(txn);

      // Toggle visual state
      el.classList.toggle('checked');

      // Recalculate summary
      let newTotal = 0, newPaid = 0, newPending = 0;
      for (const t of transactions) {
        newTotal += t.snapshotAmount;
        if (t.status === TX_STATUS.PAID) {
          newPaid += t.snapshotAmount;
        } else {
          newPending += t.snapshotAmount;
        }
      }
      summaryTotal.textContent = formatCurrency(newTotal);
      summaryPaid.textContent = formatCurrency(newPaid);
      summaryPending.textContent = formatCurrency(newPending);
    });
  });
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export { initHomeView, renderHome };
