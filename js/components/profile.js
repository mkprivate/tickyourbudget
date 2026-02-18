// js/components/profile.js — Profile management (CRUD)

import { dbGetAll, dbAdd, dbPut, dbDelete, dbGetByIndex, STORES, dbClear } from '../db.js';
import { createProfile } from '../models.js';
import { openModal, showConfirm } from './modal.js';
import { showToast } from './toast.js';

const ACTIVE_PROFILE_KEY = 'tyb_active_profile';
let onProfileChange = null;

function setProfileChangeCallback(cb) {
  onProfileChange = cb;
}

function getActiveProfileId() {
  return localStorage.getItem(ACTIVE_PROFILE_KEY);
}

function setActiveProfileId(id) {
  localStorage.setItem(ACTIVE_PROFILE_KEY, id);
}

async function loadProfileSelector() {
  const profiles = await dbGetAll(STORES.PROFILES);
  const select = document.getElementById('profileSelect');
  const currentId = getActiveProfileId();

  select.innerHTML = '';

  if (profiles.length === 0) {
    select.innerHTML = '<option value="">No profiles</option>';
    return;
  }

  for (const p of profiles) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === currentId) opt.selected = true;
    select.appendChild(opt);
  }

  // Make sure active profile is valid
  if (!currentId || !profiles.find((p) => p.id === currentId)) {
    setActiveProfileId(profiles[0].id);
    select.value = profiles[0].id;
  }
}

function setupProfileSelector() {
  const select = document.getElementById('profileSelect');
  select.addEventListener('change', () => {
    setActiveProfileId(select.value);
    if (onProfileChange) onProfileChange();
  });
}

function setupProfileManager() {
  document.getElementById('btnManageProfiles').addEventListener('click', openProfileManager);
}

async function openProfileManager() {
  const profiles = await dbGetAll(STORES.PROFILES);

  const listHTML = profiles
    .map(
      (p) => `
    <li class="profile-list__item" data-id="${p.id}">
      <span class="profile-list__name">${escapeHTML(p.name)}</span>
      <button class="btn-icon" data-action="rename" title="Rename">
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
    </li>
  `
    )
    .join('');

  const contentHTML = `
    <ul class="profile-list">${listHTML || '<li class="empty-state__desc" style="padding:16px;text-align:center;">No profiles yet</li>'}</ul>
    <div class="form-group">
      <label for="newProfileName">New Profile Name</label>
      <div style="display:flex;gap:8px;">
        <input type="text" id="newProfileName" placeholder="e.g. Personal, Family" maxlength="50">
        <button class="btn btn--primary btn--sm" id="btnAddProfile" style="white-space:nowrap;width:auto;padding:8px 16px;">Add</button>
      </div>
    </div>
  `;

  const modal = openModal('Manage Profiles', contentHTML);
  const overlay = modal.overlay;

  // Add profile
  overlay.querySelector('#btnAddProfile').addEventListener('click', async () => {
    const input = overlay.querySelector('#newProfileName');
    const name = input.value.trim();
    if (!name) {
      showToast('Please enter a profile name', 'error');
      return;
    }
    const profile = createProfile(name);
    await dbAdd(STORES.PROFILES, profile);
    setActiveProfileId(profile.id);
    modal.close();
    await loadProfileSelector();
    if (onProfileChange) onProfileChange();
    showToast(`Profile "${name}" created`, 'success');
  });

  // Enter key for input
  overlay.querySelector('#newProfileName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') overlay.querySelector('#btnAddProfile').click();
  });

  // Rename & Delete handlers
  overlay.querySelectorAll('.profile-list__item').forEach((li) => {
    const id = li.dataset.id;

    li.querySelector('[data-action="rename"]').addEventListener('click', async () => {
      const nameEl = li.querySelector('.profile-list__name');
      const currentName = nameEl.textContent;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentName;
      input.className = 'profile-list__name';
      input.style.padding = '4px 8px';
      input.style.fontWeight = '600';
      nameEl.replaceWith(input);
      input.focus();
      input.select();

      const save = async () => {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
          const profile = { id, name: newName };
          await dbPut(STORES.PROFILES, profile);
          await loadProfileSelector();
          showToast(`Renamed to "${newName}"`, 'success');
        }
        const span = document.createElement('span');
        span.className = 'profile-list__name';
        span.textContent = newName || currentName;
        input.replaceWith(span);
      };

      input.addEventListener('blur', save);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
      });
    });

    li.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      const confirmed = await showConfirm(
        'Delete Profile',
        'This will permanently delete this profile and ALL its categories, items, and transactions. This cannot be undone.',
        { danger: true, okText: 'Delete' }
      );
      if (!confirmed) return;

      // Delete all related data
      const categories = await dbGetByIndex(STORES.CATEGORIES, 'profileId', id);
      const items = await dbGetByIndex(STORES.BUDGET_ITEMS, 'profileId', id);
      const txns = await dbGetByIndex(STORES.TRANSACTIONS, 'profileId', id);

      for (const c of categories) await dbDelete(STORES.CATEGORIES, c.id);
      for (const i of items) await dbDelete(STORES.BUDGET_ITEMS, i.id);
      for (const t of txns) await dbDelete(STORES.TRANSACTIONS, t.id);
      await dbDelete(STORES.PROFILES, id);

      // Select another profile or clear
      const remaining = await dbGetAll(STORES.PROFILES);
      if (remaining.length > 0) {
        setActiveProfileId(remaining[0].id);
      } else {
        localStorage.removeItem(ACTIVE_PROFILE_KEY);
      }

      modal.close();
      await loadProfileSelector();
      if (onProfileChange) onProfileChange();
      showToast('Profile deleted', 'success');
    });
  });
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Ensure at least one default profile exists
async function ensureDefaultProfile() {
  const profiles = await dbGetAll(STORES.PROFILES);
  if (profiles.length === 0) {
    const profile = createProfile('Personal');
    await dbAdd(STORES.PROFILES, profile);
    setActiveProfileId(profile.id);
  }
}

export {
  loadProfileSelector,
  setupProfileSelector,
  setupProfileManager,
  getActiveProfileId,
  setActiveProfileId,
  setProfileChangeCallback,
  ensureDefaultProfile,
};
