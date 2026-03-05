// js/views/home.js — Home View (Transactions checklist with chart + progress)

import { getTransactionsForMonth, getProfileCategories, getProfileBudgetItems } from '../db.js';
import { generateTransactionsForMonth, toggleTransactionStatus, updateTransactionAmount, deleteTransaction } from '../transaction-engine.js';
import { formatCurrency, formatDate, getMonthLabel, TX_STATUS } from '../models.js';
import { getActiveProfileId } from '../components/profile.js';
import { openModal, showConfirm } from '../components/modal.js';

let currentYear, currentMonth;
let lastCategoryTotals = null, lastTotal = 0;

const CHART_COLORS = [
  '#a78bfa', '#f472b6', '#60a5fa', '#34d399', '#fbbf24',
  '#fb923c', '#f87171', '#a3e635', '#22d3ee', '#c084fc',
  '#e879f9', '#818cf8',
];

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

  // Chart modal
  document.getElementById('btnShowChart').addEventListener('click', () => {
    showChartModal();
  });

  // Search filter
  document.getElementById('homeSearch').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const items = document.querySelectorAll('#checklistContainer .checklist-item');
    const groups = document.querySelectorAll('#checklistContainer .checklist-group');

    items.forEach((item) => {
      const name = item.querySelector('.checklist-item__name')?.textContent.toLowerCase() || '';
      const amount = item.querySelector('.checklist-item__amount')?.textContent.toLowerCase() || '';
      item.style.display = (!query || name.includes(query) || amount.includes(query)) ? '' : 'none';
    });

    // Hide group titles if all items in the group are hidden
    groups.forEach((group) => {
      const visibleItems = group.querySelectorAll('.checklist-item:not([style*="display: none"])');
      const title = group.querySelector('.checklist-group__title');
      if (title) title.style.display = visibleItems.length === 0 ? 'none' : '';
    });
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
  const progressFill = document.getElementById('progressFill');
  const progressLabel = document.getElementById('progressLabel');
  const progressWrapper = document.getElementById('progressWrapper');
  const chartBtn = document.getElementById('btnShowChart');
  const comparisonEl = document.getElementById('monthComparison');

  monthLabel.textContent = getMonthLabel(currentYear, currentMonth);

  // Clear search
  const searchInput = document.getElementById('homeSearch');
  if (searchInput) searchInput.value = '';

  if (!profileId) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    summaryTotal.textContent = formatCurrency(0);
    summaryPaid.textContent = formatCurrency(0);
    summaryPending.textContent = formatCurrency(0);
    progressFill.style.width = '0%';
    progressLabel.textContent = '0% paid';
    progressWrapper.style.display = 'none';
    chartBtn.classList.add('hidden');
    comparisonEl.classList.add('hidden');
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
  const categoryTotals = new Map();

  for (const txn of transactions) {
    total += txn.snapshotAmount;
    if (txn.status === TX_STATUS.PAID) {
      paid += txn.snapshotAmount;
    } else {
      pending += txn.snapshotAmount;
    }

    // Track category totals for chart
    const item = itemMap.get(txn.budgetItemId);
    const catId = item ? item.categoryId : '_uncategorized';
    const catName = catMap.has(catId) ? catMap.get(catId).name : 'Uncategorized';
    if (!categoryTotals.has(catId)) {
      categoryTotals.set(catId, { name: catName, total: 0 });
    }
    categoryTotals.get(catId).total += txn.snapshotAmount;
  }

  summaryTotal.textContent = formatCurrency(total);
  summaryPaid.textContent = formatCurrency(paid);
  summaryPending.textContent = formatCurrency(pending);

  // Update progress bar
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  progressFill.style.width = pct + '%';
  progressLabel.textContent = pct + '% paid';
  progressWrapper.style.display = '';

  // Store chart data for modal
  lastCategoryTotals = categoryTotals;
  lastTotal = total;

  if (transactions.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    chartBtn.classList.add('hidden');
    comparisonEl.classList.add('hidden');
    progressWrapper.style.display = 'none';
    return;
  }

  emptyState.classList.add('hidden');
  chartBtn.classList.remove('hidden');

  // Month-over-month comparison
  renderMonthComparison(profileId, total, comparisonEl);

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
          <div class="checklist-item__amount" data-edit-txn="${txn.id}">
            <span>${formatCurrency(txn.snapshotAmount)}</span>
            <svg class="edit-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </div>
        </div>
      `;
    }
    html += `</li>`;
  }

  container.innerHTML = html;

  // Attach click handlers for toggling & editing
  container.querySelectorAll('.checklist-item').forEach((el) => {
    el.addEventListener('click', async (e) => {
      // If the amount area was clicked, open edit modal instead of toggling
      const amountEl = e.target.closest('[data-edit-txn]');
      if (amountEl) {
        const txnId = amountEl.dataset.editTxn;
        const txn = transactions.find((t) => t.id === txnId);
        if (txn) openEditAmountModal(txn);
        return;
      }

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

      // Update progress bar
      const newPct = newTotal > 0 ? Math.round((newPaid / newTotal) * 100) : 0;
      progressFill.style.width = newPct + '%';
      progressLabel.textContent = newPct + '% paid';
    });
  });
}

function openEditAmountModal(txn) {
  const html = `
    <form id="editAmountForm" class="form-group" style="margin-bottom:0">
      <label for="editAmountInput">Amount</label>
      <input type="number" id="editAmountInput" step="0.01" min="0" value="${txn.snapshotAmount}" required>
      <button type="submit" class="btn btn--primary" style="margin-top:16px">Save</button>
    </form>
    <button type="button" id="btnDeleteTxn" class="btn btn--danger btn--sm" style="margin-top:12px;width:100%">Delete Transaction</button>
  `;

  const { overlay, close } = openModal('Edit Transaction', html);
  const input = overlay.querySelector('#editAmountInput');
  setTimeout(() => { input.focus(); input.select(); }, 100);

  overlay.querySelector('#editAmountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newAmount = parseFloat(input.value);
    if (isNaN(newAmount) || newAmount < 0) return;
    await updateTransactionAmount(txn, newAmount);
    close();
    renderHome();
  });

  overlay.querySelector('#btnDeleteTxn').addEventListener('click', async () => {
    close();
    const confirmed = await showConfirm(
      'Delete Transaction',
      `Delete "${escapeHTML(txn.snapshotName)}"? This won\u2019t affect the budget item.`,
      { danger: true, okText: 'Delete' }
    );
    if (!confirmed) return;
    await deleteTransaction(txn.id);
    renderHome();
  });
}

function showChartModal() {
  if (!lastCategoryTotals || lastTotal === 0) return;

  const entries = [...lastCategoryTotals.entries()].sort((a, b) => b[1].total - a[1].total);
  const cx = 100, cy = 100, r = 70;
  const circumference = 2 * Math.PI * r;

  let svgHTML = '';
  let legendHTML = '';
  let cumulativeOffset = 0;

  entries.forEach(([catId, data], i) => {
    const pct = data.total / lastTotal;
    const dashLength = pct * circumference;
    const color = CHART_COLORS[i % CHART_COLORS.length];

    svgHTML += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${color}" stroke-width="28"
      stroke-dasharray="${dashLength} ${circumference - dashLength}"
      stroke-dashoffset="${-cumulativeOffset}"
      transform="rotate(-90 ${cx} ${cy})" />`;

    legendHTML += `<div class="chart-legend__item">
      <span class="chart-legend__dot" style="background:${color}"></span>
      ${escapeHTML(data.name)} — ${formatCurrency(data.total)} (${Math.round(pct * 100)}%)
    </div>`;

    cumulativeOffset += dashLength;
  });

  svgHTML += `<text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="var(--text-primary)" font-size="14" font-weight="700">${formatCurrency(lastTotal)}</text>`;
  svgHTML += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="var(--text-muted)" font-size="10">Total</text>`;

  const html = `<div class="modal-chart">
    <svg class="donut-chart" viewBox="0 0 200 200">${svgHTML}</svg>
    <div class="chart-legend">${legendHTML}</div>
  </div>`;

  openModal('Category Breakdown', html);
}

async function renderMonthComparison(profileId, currentTotal, el) {
  try {
    // Get previous month
    let prevYear = currentYear;
    let prevMonth = currentMonth - 1;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }

    const prevTransactions = await generateTransactionsForMonth(profileId, prevYear, prevMonth);
    let prevTotal = 0;
    for (const txn of prevTransactions) {
      prevTotal += txn.snapshotAmount;
    }

    if (prevTotal === 0 && currentTotal === 0) {
      el.classList.add('hidden');
      return;
    }

    const diff = currentTotal - prevTotal;
    const pctChange = prevTotal > 0 ? Math.round((diff / prevTotal) * 100) : (currentTotal > 0 ? 100 : 0);

    let arrowClass, arrowSymbol;
    if (diff > 0) {
      arrowClass = 'month-comparison__arrow--up';
      arrowSymbol = '↑';
    } else if (diff < 0) {
      arrowClass = 'month-comparison__arrow--down';
      arrowSymbol = '↓';
    } else {
      arrowClass = 'month-comparison__arrow--same';
      arrowSymbol = '→';
    }

    const prevLabel = getMonthLabel(prevYear, prevMonth);
    el.innerHTML = `
      <span class="month-comparison__arrow ${arrowClass}">${arrowSymbol}</span>
      <span>${Math.abs(pctChange)}% ${diff >= 0 ? 'more' : 'less'} than ${prevLabel} (${formatCurrency(prevTotal)})</span>
    `;
    el.classList.remove('hidden');
  } catch (e) {
    el.classList.add('hidden');
  }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export { initHomeView, renderHome };
