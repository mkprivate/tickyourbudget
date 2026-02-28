// js/views/data.js — Data View (Export, Import, Sample, Clear)

import {
  exportProfileData,
  exportAllData,
  importData,
  dbClearAll,
  dbAdd,
  getProfileBudgetItems,
  getProfileCategories,
  getTransactionsForMonth,
  STORES,
} from '../db.js';
import {
  getActiveProfileId,
  loadProfileSelector,
  setActiveProfileId,
} from '../components/profile.js';
import { openModal, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { generateId, FREQUENCY, formatCurrency, formatDate } from '../models.js';

let onDataChange = null;

function setDataChangeCallback(cb) {
  onDataChange = cb;
}

function initDataView() {
  document.getElementById('btnCopyJson').addEventListener('click', handleCopyJson);
  document.getElementById('btnDownloadJson').addEventListener('click', handleDownloadJson);
  document.getElementById('btnDownloadCsv').addEventListener('click', handleDownloadCsv);
  document.getElementById('btnImportFile').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', handleImportFile);
  document.getElementById('btnImportPaste').addEventListener('click', handleImportPaste);
  document.getElementById('btnLoadSample').addEventListener('click', handleLoadSample);
  document.getElementById('btnClearData').addEventListener('click', handleClearData);
}

async function renderData() {
  const preview = document.getElementById('jsonPreview');
  const profileId = getActiveProfileId();

  if (!profileId) {
    preview.value = JSON.stringify({ message: 'No profile selected' }, null, 2);
    return;
  }

  try {
    const data = await exportProfileData(profileId);
    preview.value = JSON.stringify(data, null, 2);
  } catch (err) {
    preview.value = `Error: ${err.message}`;
  }
}

async function handleCopyJson() {
  const preview = document.getElementById('jsonPreview');
  try {
    await navigator.clipboard.writeText(preview.value);
    showToast('Copied to clipboard!', 'success');
  } catch {
    // Fallback
    preview.select();
    document.execCommand('copy');
    showToast('Copied to clipboard!', 'success');
  }
}

async function handleDownloadJson() {
  const profileId = getActiveProfileId();
  const data = await exportAllData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tickyourbudget-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Download started', 'success');
}

async function handleDownloadCsv() {
  const profileId = getActiveProfileId();
  if (!profileId) {
    showToast('No profile selected', 'error');
    return;
  }

  try {
    const items = await getProfileBudgetItems(profileId);
    const categories = await getProfileCategories(profileId);
    const catMap = new Map(categories.map((c) => [c.id, c]));

    // Build CSV
    const headers = ['Name', 'Amount', 'Category', 'Frequency', 'Start Date', 'End Date', 'Description'];
    const rows = items.map((item) => {
      const catName = catMap.has(item.categoryId) ? catMap.get(item.categoryId).name : 'Uncategorized';
      return [
        csvEscape(item.name),
        item.amount,
        csvEscape(catName),
        item.frequency,
        item.startDate,
        item.endDate || '',
        csvEscape(item.description || ''),
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickyourbudget-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV download started', 'success');
  } catch (err) {
    showToast(`CSV export failed: ${err.message}`, 'error');
  }
}

function csvEscape(str) {
  if (!str) return '';
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

async function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await importData(data);
    await loadProfileSelector();
    if (onDataChange) onDataChange();
    renderData();
    showToast('Data imported successfully!', 'success');
  } catch (err) {
    showToast(`Import failed: ${err.message}`, 'error');
  }

  // Reset input
  e.target.value = '';
}

function handleImportPaste() {
  const contentHTML = `
    <form id="pasteForm">
      <div class="form-group">
        <label for="pasteInput">Paste JSON data</label>
        <textarea id="pasteInput" class="json-preview" placeholder='{"profiles": [...], ...}'></textarea>
      </div>
      <button type="submit" class="btn btn--primary">Import</button>
    </form>
  `;

  const modal = openModal('Import JSON', contentHTML);

  modal.overlay.querySelector('#pasteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = modal.overlay.querySelector('#pasteInput').value.trim();

    try {
      const data = JSON.parse(text);
      await importData(data);
      await loadProfileSelector();
      if (onDataChange) onDataChange();
      renderData();
      modal.close();
      showToast('Data imported successfully!', 'success');
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'error');
    }
  });
}

async function handleLoadSample() {
  const confirmed = await showConfirm(
    'Load Sample Data',
    'This will add sample profiles, categories, and budget items to your database. Existing data will not be affected.',
    { okText: 'Load Sample' }
  );

  if (!confirmed) return;

  try {
    const sampleData = generateSampleData();
    await importData(sampleData);
    setActiveProfileId(sampleData.profiles[0].id);
    await loadProfileSelector();
    if (onDataChange) onDataChange();
    renderData();
    showToast('Sample data loaded!', 'success');
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  }
}

async function handleClearData() {
  const confirmed = await showConfirm(
    'Clear All Data',
    'This will permanently delete ALL profiles, categories, items, and transactions. This cannot be undone.',
    { danger: true, okText: 'Clear Everything' }
  );

  if (!confirmed) return;

  await dbClearAll();
  localStorage.removeItem('tyb_active_profile');
  await loadProfileSelector();
  if (onDataChange) onDataChange();
  renderData();
  showToast('All data cleared', 'success');
}

function generateSampleData() {
  const profileId = generateId();
  const catHousing = generateId();
  const catUtils = generateId();
  const catTransport = generateId();
  const catFood = generateId();
  const catEnt = generateId();
  const catSub = generateId();
  const catInsurance = generateId();

  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.substring(0, 8) + '01';

  return {
    profiles: [{ id: profileId, name: 'Sample Budget' }],
    categories: [
      { id: catHousing, profileId, name: 'Housing', description: 'Rent, mortgage, and housing costs', parentId: null },
      { id: catUtils, profileId, name: 'Utilities', description: 'Electric, water, gas, internet', parentId: catHousing },
      { id: catTransport, profileId, name: 'Transportation', description: 'Car, gas, public transit', parentId: null },
      { id: catFood, profileId, name: 'Food & Dining', description: 'Groceries and restaurants', parentId: null },
      { id: catEnt, profileId, name: 'Entertainment', description: 'Movies, games, hobbies', parentId: null },
      { id: catSub, profileId, name: 'Subscriptions', description: 'Digital subscriptions', parentId: catEnt },
      { id: catInsurance, profileId, name: 'Insurance', description: 'Health, auto, life', parentId: null },
    ],
    budgetItems: [
      { id: generateId(), profileId, categoryId: catHousing, name: 'Rent', amount: 1500, description: 'Monthly apartment rent', frequency: FREQUENCY.MONTHLY, startDate: firstOfMonth },
      { id: generateId(), profileId, categoryId: catUtils, name: 'Electric Bill', amount: 85, description: '', frequency: FREQUENCY.MONTHLY, startDate: firstOfMonth },
      { id: generateId(), profileId, categoryId: catUtils, name: 'Internet', amount: 65, description: 'Fiber internet', frequency: FREQUENCY.MONTHLY, startDate: firstOfMonth },
      { id: generateId(), profileId, categoryId: catUtils, name: 'Water Bill', amount: 40, description: '', frequency: FREQUENCY.MONTHLY, startDate: firstOfMonth },
      { id: generateId(), profileId, categoryId: catTransport, name: 'Car Payment', amount: 350, description: '', frequency: FREQUENCY.MONTHLY, startDate: firstOfMonth },
      { id: generateId(), profileId, categoryId: catTransport, name: 'Gas', amount: 50, description: 'Weekly fill-up', frequency: FREQUENCY.WEEKLY, startDate: firstOfMonth },
      { id: generateId(), profileId, categoryId: catFood, name: 'Grocery Run', amount: 120, description: 'Weekly groceries', frequency: FREQUENCY.WEEKLY, startDate: firstOfMonth },
      { id: generateId(), profileId, categoryId: catSub, name: 'Netflix', amount: 15.99, description: 'Standard plan', frequency: FREQUENCY.MONTHLY, startDate: firstOfMonth },
      { id: generateId(), profileId, categoryId: catSub, name: 'Spotify', amount: 9.99, description: 'Premium individual', frequency: FREQUENCY.MONTHLY, startDate: firstOfMonth },
      { id: generateId(), profileId, categoryId: catInsurance, name: 'Health Insurance', amount: 320, description: 'Monthly premium', frequency: FREQUENCY.MONTHLY, startDate: firstOfMonth },
      { id: generateId(), profileId, categoryId: catInsurance, name: 'Car Insurance', amount: 180, description: '', frequency: FREQUENCY.QUARTERLY, startDate: firstOfMonth },
    ],
    transactions: [],
  };
}

export { initDataView, renderData, setDataChangeCallback };
