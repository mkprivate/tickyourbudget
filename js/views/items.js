// js/views/items.js — Budget Items management view

import {
  getProfileBudgetItems,
  getProfileCategories,
  dbAdd,
  dbPut,
  dbDelete,
  STORES,
} from '../db.js';
import { deleteTransactionsByBudgetItem } from '../db.js';
import {
  createBudgetItem,
  FREQUENCY_LIST,
  formatCurrency,
  formatDate,
} from '../models.js';
import { getActiveProfileId } from '../components/profile.js';
import { openModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';

function initItemsView() {
  document.getElementById('fabAddItem').addEventListener('click', () => {
    openItemForm();
  });

  // Search filter
  document.getElementById('itemsSearch').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const cards = document.querySelectorAll('#itemsContainer .card');
    cards.forEach((card) => {
      const title = card.querySelector('.card__title')?.textContent.toLowerCase() || '';
      const amount = card.querySelector('.card__amount')?.textContent.toLowerCase() || '';
      const badges = card.querySelector('.card__meta')?.textContent.toLowerCase() || '';
      card.style.display = (!query || title.includes(query) || amount.includes(query) || badges.includes(query)) ? '' : 'none';
    });
  });
}

async function renderItems() {
  const profileId = getActiveProfileId();
  const container = document.getElementById('itemsContainer');
  const emptyState = document.getElementById('emptyItems');

  // Clear search
  const searchInput = document.getElementById('itemsSearch');
  if (searchInput) searchInput.value = '';

  if (!profileId) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  const items = await getProfileBudgetItems(profileId);
  const categories = await getProfileCategories(profileId);
  const catMap = new Map(categories.map((c) => [c.id, c]));

  if (items.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  let html = '';
  for (const item of items) {
    const catName = catMap.has(item.categoryId)
      ? catMap.get(item.categoryId).name
      : 'Uncategorized';

    html += `
      <div class="card" data-item-id="${item.id}">
        <div class="card__header">
          <div class="card__title">${escapeHTML(item.name)}</div>
          <div class="card__amount">${formatCurrency(item.amount)}</div>
        </div>
        ${item.description ? `<div class="card__description">${escapeHTML(item.description)}</div>` : ''}
        <div class="card__meta">
          <span class="badge badge--category">${escapeHTML(catName)}</span>
          <span class="badge badge--frequency">${item.frequency}</span>
          <span class="badge">From ${formatDate(item.startDate)}</span>
          ${item.endDate ? `<span class="badge badge--end-date">Until ${formatDate(item.endDate)}</span>` : ''}
        </div>
        <div class="card__actions">
          <button class="btn-card-action btn-card-action--edit" data-action="edit">Edit</button>
          <button class="btn-card-action btn-card-action--delete" data-action="delete">Delete</button>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  // Attach action handlers
  container.querySelectorAll('.card').forEach((card) => {
    const id = card.dataset.itemId;
    const item = items.find((i) => i.id === id);

    card.querySelector('[data-action="edit"]').addEventListener('click', () => {
      openItemForm(item);
    });

    card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      const confirmed = await showConfirm(
        'Delete Budget Item',
        `Delete "${item.name}"? You can choose to also remove all related transactions.`,
        { danger: true, okText: 'Delete Item Only' }
      );

      if (confirmed) {
        // Ask about cascade
        const cascadeDelete = await showConfirm(
          'Delete Transactions?',
          'Also delete all past transactions linked to this item?',
          { danger: true, okText: 'Yes, delete transactions', cancelText: 'No, keep them' }
        );

        if (cascadeDelete) {
          await deleteTransactionsByBudgetItem(id);
        }

        await dbDelete(STORES.BUDGET_ITEMS, id);
        showToast(`"${item.name}" deleted`, 'success');
        renderItems();
      }
    });
  });
}

async function openItemForm(existingItem = null) {
  const profileId = getActiveProfileId();
  if (!profileId) {
    showToast('Please create a profile first', 'error');
    return;
  }

  const categories = await getProfileCategories(profileId);

  if (categories.length === 0) {
    showToast('Please create a category first', 'error');
    return;
  }

  const isEdit = !!existingItem;
  const title = isEdit ? 'Edit Budget Item' : 'Add Budget Item';

  const catOptions = categories
    .map(
      (c) =>
        `<option value="${c.id}" ${existingItem && existingItem.categoryId === c.id ? 'selected' : ''}>${escapeHTML(c.name)}${c.parentId ? ' (sub)' : ''}</option>`
    )
    .join('');

  const freqOptions = FREQUENCY_LIST.map(
    (f) =>
      `<option value="${f}" ${existingItem && existingItem.frequency === f ? 'selected' : ''}>${f}</option>`
  ).join('');

  const contentHTML = `
    <form id="itemForm">
      <div class="form-group">
        <label for="itemName">Name *</label>
        <input type="text" id="itemName" required maxlength="100" value="${existingItem ? escapeAttr(existingItem.name) : ''}" placeholder="e.g. Netflix, Rent">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="itemAmount">Amount *</label>
          <input type="number" id="itemAmount" required min="0" step="0.01" value="${existingItem ? existingItem.amount : ''}" placeholder="0.00">
        </div>
        <div class="form-group">
          <label for="itemCategory">Category *</label>
          <select id="itemCategory" required>${catOptions}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="itemFrequency">Frequency</label>
          <select id="itemFrequency">${freqOptions}</select>
        </div>
        <div class="form-group">
          <label for="itemStartDate">Start Date</label>
          <input type="date" id="itemStartDate" value="${existingItem ? existingItem.startDate : new Date().toISOString().split('T')[0]}">
        </div>
      </div>
      <div class="form-group">
        <label for="itemEndDate">End Date <small style="color:var(--text-muted);font-weight:400;">(optional)</small></label>
        <input type="date" id="itemEndDate" value="${existingItem && existingItem.endDate ? existingItem.endDate : ''}">
      </div>
      <div class="form-group">
        <label for="itemDesc">Description</label>
        <input type="text" id="itemDesc" maxlength="200" value="${existingItem ? escapeAttr(existingItem.description || '') : ''}" placeholder="Optional notes">
      </div>
      <button type="submit" class="btn btn--primary">${isEdit ? 'Update Item' : 'Add Item'}</button>
    </form>
  `;

  const modal = openModal(title, contentHTML);

  modal.overlay.querySelector('#itemForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = modal.overlay.querySelector('#itemName').value.trim();
    const amount = modal.overlay.querySelector('#itemAmount').value;
    const categoryId = modal.overlay.querySelector('#itemCategory').value;
    const frequency = modal.overlay.querySelector('#itemFrequency').value;
    const startDate = modal.overlay.querySelector('#itemStartDate').value;
    const endDate = modal.overlay.querySelector('#itemEndDate').value || null;
    const description = modal.overlay.querySelector('#itemDesc').value.trim();

    if (!name || !amount) {
      showToast('Name and amount are required', 'error');
      return;
    }

    if (isEdit) {
      const updated = {
        ...existingItem,
        name,
        amount: parseFloat(amount),
        categoryId,
        frequency,
        startDate,
        endDate,
        description,
      };
      await dbPut(STORES.BUDGET_ITEMS, updated);
      showToast(`"${name}" updated`, 'success');
    } else {
      const item = createBudgetItem({
        profileId,
        categoryId,
        name,
        amount,
        description,
        frequency,
        startDate,
        endDate,
      });
      await dbAdd(STORES.BUDGET_ITEMS, item);
      showToast(`"${name}" added`, 'success');
    }

    modal.close();
    renderItems();
  });

  // Focus first input
  setTimeout(() => modal.overlay.querySelector('#itemName').focus(), 100);
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export { initItemsView, renderItems };
