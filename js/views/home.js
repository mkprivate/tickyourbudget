// js/views/home.js — Home View (Transactions checklist with chart + progress)

import { getTransactionsForMonth, getProfileCategories, getProfileBudgetItems } from '../db.js';
import { generateTransactionsForMonth, toggleTransactionStatus } from '../transaction-engine.js';
import { formatCurrency, formatDate, getMonthLabel, TX_STATUS } from '../models.js';
import { getActiveProfileId } from '../components/profile.js';

let currentYear, currentMonth;
let chartVisible = false;

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

  // Chart toggle
  document.getElementById('btnToggleChart').addEventListener('click', () => {
    chartVisible = !chartVisible;
    const container = document.getElementById('chartContainer');
    const btn = document.getElementById('btnToggleChart');
    container.classList.toggle('hidden', !chartVisible);
    btn.innerHTML = chartVisible
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg> Hide Chart`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg> ${chartVisible ? 'Hide' : 'Show'} Chart`;
    // Fix: just set the right text
    btn.lastChild.textContent = chartVisible ? ' Hide Chart' : ' Show Chart';
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
  const chartSection = document.getElementById('chartSection');
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
    chartSection.classList.add('hidden');
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

  if (transactions.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    chartSection.classList.add('hidden');
    comparisonEl.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  chartSection.classList.remove('hidden');

  // Render donut chart
  renderDonutChart(categoryTotals, total);

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

      // Update progress bar
      const newPct = newTotal > 0 ? Math.round((newPaid / newTotal) * 100) : 0;
      progressFill.style.width = newPct + '%';
      progressLabel.textContent = newPct + '% paid';
    });
  });
}

function renderDonutChart(categoryTotals, total) {
  const svg = document.getElementById('donutChart');
  const legend = document.getElementById('chartLegend');
  if (!svg || !legend) return;

  const entries = [...categoryTotals.entries()].sort((a, b) => b[1].total - a[1].total);
  const cx = 100, cy = 100, r = 70;
  const circumference = 2 * Math.PI * r;

  let pathsHTML = '';
  let legendHTML = '';
  let cumulativeOffset = 0;

  entries.forEach(([catId, data], i) => {
    const pct = total > 0 ? data.total / total : 0;
    const dashLength = pct * circumference;
    const color = CHART_COLORS[i % CHART_COLORS.length];

    pathsHTML += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${color}" stroke-width="28"
      stroke-dasharray="${dashLength} ${circumference - dashLength}"
      stroke-dashoffset="${-cumulativeOffset}"
      transform="rotate(-90 ${cx} ${cy})" />`;

    legendHTML += `<div class="chart-legend__item">
      <span class="chart-legend__dot" style="background:${color}"></span>
      ${escapeHTML(data.name)} (${Math.round(pct * 100)}%)
    </div>`;

    cumulativeOffset += dashLength;
  });

  // Center text
  pathsHTML += `<text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="var(--text-primary)" font-size="14" font-weight="700">${formatCurrency(total)}</text>`;
  pathsHTML += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="var(--text-muted)" font-size="10">Total</text>`;

  svg.innerHTML = pathsHTML;
  legend.innerHTML = legendHTML;
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
