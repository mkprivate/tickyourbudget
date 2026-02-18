// js/views/categories.js — Categories management view

import { getProfileCategories, dbAdd, dbPut, dbDelete, dbGetByIndex, STORES } from '../db.js';
import { createCategory } from '../models.js';
import { getActiveProfileId } from '../components/profile.js';
import { openModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';

function initCategoriesView() {
  document.getElementById('fabAddCategory').addEventListener('click', () => {
    openCategoryForm();
  });
}

async function renderCategories() {
  const profileId = getActiveProfileId();
  const container = document.getElementById('categoriesContainer');
  const emptyState = document.getElementById('emptyCategories');

  if (!profileId) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  const categories = await getProfileCategories(profileId);

  if (categories.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  // Build parent-child structure
  const parents = categories.filter((c) => !c.parentId);
  const childMap = new Map();
  for (const c of categories) {
    if (c.parentId) {
      if (!childMap.has(c.parentId)) childMap.set(c.parentId, []);
      childMap.get(c.parentId).push(c);
    }
  }

  let html = '';
  for (const parent of parents) {
    const children = childMap.get(parent.id) || [];
    html += renderCategoryNode(parent, children);
  }

  // Orphan sub-categories (parent was deleted)
  const parentIds = new Set(parents.map((p) => p.id));
  const orphans = categories.filter((c) => c.parentId && !parentIds.has(c.parentId));
  for (const orphan of orphans) {
    html += renderCategoryNode(orphan, []);
  }

  container.innerHTML = html;

  // Attach handlers
  container.querySelectorAll('[data-action]').forEach((btn) => {
    const action = btn.dataset.action;
    const id = btn.closest('[data-cat-id]').dataset.catId;
    const cat = categories.find((c) => c.id === id);

    if (action === 'add-sub') {
      btn.addEventListener('click', () => openCategoryForm(null, id));
    } else if (action === 'edit') {
      btn.addEventListener('click', () => openCategoryForm(cat));
    } else if (action === 'delete') {
      btn.addEventListener('click', () => handleDeleteCategory(cat, categories));
    }
  });
}

function renderCategoryNode(category, children) {
  let childrenHTML = '';
  if (children.length > 0) {
    childrenHTML = `<ul class="category-children">`;
    for (const child of children) {
      childrenHTML += `
        <li class="category-node" data-cat-id="${child.id}">
          <div class="category-node__header">
            <span class="category-node__name">${escapeHTML(child.name)}</span>
            ${child.description ? `<span class="category-node__desc" title="${escapeAttr(child.description)}">${escapeHTML(child.description)}</span>` : ''}
            <div class="category-node__actions">
              <button class="btn-icon" data-action="edit" title="Edit">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="btn-icon btn-icon--danger" data-action="delete" title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        </li>
      `;
    }
    childrenHTML += `</ul>`;
  }

  return `
    <li class="category-node" data-cat-id="${category.id}">
      <div class="category-node__header">
        <span class="category-node__name">${escapeHTML(category.name)}</span>
        ${category.description ? `<span class="category-node__desc" title="${escapeAttr(category.description)}">${escapeHTML(category.description)}</span>` : ''}
        <div class="category-node__actions">
          ${!category.parentId ? `
          <button class="btn-icon" data-action="add-sub" title="Add sub-category">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          ` : ''}
          <button class="btn-icon" data-action="edit" title="Edit">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-icon btn-icon--danger" data-action="delete" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
      ${childrenHTML}
    </li>
  `;
}

async function handleDeleteCategory(category, allCategories) {
  // Check if any budget items use this category
  const items = await dbGetByIndex(STORES.BUDGET_ITEMS, 'categoryId', category.id);
  const children = allCategories.filter((c) => c.parentId === category.id);

  let message = `Delete category "${category.name}"?`;
  if (children.length > 0) {
    message += ` This will also delete ${children.length} sub-categor${children.length === 1 ? 'y' : 'ies'}.`;
  }
  if (items.length > 0) {
    message += ` ${items.length} budget item(s) use this category and will become uncategorized.`;
  }

  const confirmed = await showConfirm('Delete Category', message, {
    danger: true,
    okText: 'Delete',
  });

  if (!confirmed) return;

  // Delete children first
  for (const child of children) {
    await dbDelete(STORES.CATEGORIES, child.id);
  }
  await dbDelete(STORES.CATEGORIES, category.id);

  showToast(`"${category.name}" deleted`, 'success');
  renderCategories();
}

async function openCategoryForm(existingCategory = null, parentId = null) {
  const profileId = getActiveProfileId();
  if (!profileId) {
    showToast('Please create a profile first', 'error');
    return;
  }

  const isEdit = !!existingCategory;
  const title = isEdit
    ? 'Edit Category'
    : parentId
      ? 'Add Sub-category'
      : 'Add Category';

  const contentHTML = `
    <form id="categoryForm">
      <div class="form-group">
        <label for="catName">Name *</label>
        <input type="text" id="catName" required maxlength="50" value="${existingCategory ? escapeAttr(existingCategory.name) : ''}" placeholder="e.g. Housing, Transportation">
      </div>
      <div class="form-group">
        <label for="catDesc">Description</label>
        <input type="text" id="catDesc" maxlength="200" value="${existingCategory ? escapeAttr(existingCategory.description || '') : ''}" placeholder="Optional description">
      </div>
      <button type="submit" class="btn btn--primary">${isEdit ? 'Update Category' : 'Add Category'}</button>
    </form>
  `;

  const modal = openModal(title, contentHTML);

  modal.overlay.querySelector('#categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = modal.overlay.querySelector('#catName').value.trim();
    const description = modal.overlay.querySelector('#catDesc').value.trim();

    if (!name) {
      showToast('Category name is required', 'error');
      return;
    }

    if (isEdit) {
      const updated = { ...existingCategory, name, description };
      await dbPut(STORES.CATEGORIES, updated);
      showToast(`"${name}" updated`, 'success');
    } else {
      const category = createCategory({
        profileId,
        name,
        description,
        parentId: parentId || null,
      });
      await dbAdd(STORES.CATEGORIES, category);
      showToast(`"${name}" added`, 'success');
    }

    modal.close();
    renderCategories();
  });

  setTimeout(() => modal.overlay.querySelector('#catName').focus(), 100);
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export { initCategoriesView, renderCategories };
