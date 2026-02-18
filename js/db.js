// js/db.js — IndexedDB wrapper for tickyourbudget

const DB_NAME = 'tickyourbudget';
const DB_VERSION = 1;

const STORES = {
  PROFILES: 'profiles',
  CATEGORIES: 'categories',
  BUDGET_ITEMS: 'budgetItems',
  TRANSACTIONS: 'transactions',
};

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Profiles
      if (!db.objectStoreNames.contains(STORES.PROFILES)) {
        db.createObjectStore(STORES.PROFILES, { keyPath: 'id' });
      }

      // Categories
      if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
        const catStore = db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
        catStore.createIndex('profileId', 'profileId', { unique: false });
        catStore.createIndex('parentId', 'parentId', { unique: false });
      }

      // Budget Items
      if (!db.objectStoreNames.contains(STORES.BUDGET_ITEMS)) {
        const itemStore = db.createObjectStore(STORES.BUDGET_ITEMS, { keyPath: 'id' });
        itemStore.createIndex('profileId', 'profileId', { unique: false });
        itemStore.createIndex('categoryId', 'categoryId', { unique: false });
      }

      // Transactions
      if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
        const txStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' });
        txStore.createIndex('profileId', 'profileId', { unique: false });
        txStore.createIndex('budgetItemId', 'budgetItemId', { unique: false });
        txStore.createIndex('date', 'date', { unique: false });
        txStore.createIndex('profileId_date', ['profileId', 'date'], { unique: false });
      }
    };

    request.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

// Generic CRUD helpers

async function dbAdd(storeName, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.add(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(storeName, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(value);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetByIndexRange(storeName, indexName, lower, upper) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const range = IDBKeyRange.bound(lower, upper);
    const req = index.getAll(range);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbClear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbClearAll() {
  for (const name of Object.values(STORES)) {
    await dbClear(name);
  }
}

// Profile-scoped helpers

async function getProfileCategories(profileId) {
  return dbGetByIndex(STORES.CATEGORIES, 'profileId', profileId);
}

async function getProfileBudgetItems(profileId) {
  return dbGetByIndex(STORES.BUDGET_ITEMS, 'profileId', profileId);
}

async function getProfileTransactions(profileId) {
  return dbGetByIndex(STORES.TRANSACTIONS, 'profileId', profileId);
}

async function getTransactionsForMonth(profileId, year, month) {
  // month is 0-indexed (JS Date style)
  const startDate = new Date(year, month, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
  return dbGetByIndexRange(
    STORES.TRANSACTIONS,
    'profileId_date',
    [profileId, startDate],
    [profileId, endDate]
  );
}

async function deleteTransactionsByBudgetItem(budgetItemId) {
  const txns = await dbGetByIndex(STORES.TRANSACTIONS, 'budgetItemId', budgetItemId);
  for (const txn of txns) {
    await dbDelete(STORES.TRANSACTIONS, txn.id);
  }
}

// Export full profile data
async function exportProfileData(profileId) {
  const profiles = await dbGetAll(STORES.PROFILES);
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) return null;
  const categories = await getProfileCategories(profileId);
  const budgetItems = await getProfileBudgetItems(profileId);
  const transactions = await getProfileTransactions(profileId);
  return { profile, categories, budgetItems, transactions };
}

// Export ALL data
async function exportAllData() {
  const profiles = await dbGetAll(STORES.PROFILES);
  const categories = await dbGetAll(STORES.CATEGORIES);
  const budgetItems = await dbGetAll(STORES.BUDGET_ITEMS);
  const transactions = await dbGetAll(STORES.TRANSACTIONS);
  return { profiles, categories, budgetItems, transactions };
}

// Import data (validates & merges)
async function importData(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid data format');

  // Support both single-profile and multi-profile exports
  const profiles = data.profiles || (data.profile ? [data.profile] : []);
  const categories = data.categories || [];
  const budgetItems = data.budgetItems || [];
  const transactions = data.transactions || [];

  // Validate required fields
  for (const p of profiles) {
    if (!p.id || !p.name) throw new Error('Invalid profile: missing id or name');
  }
  for (const c of categories) {
    if (!c.id || !c.profileId || !c.name) throw new Error('Invalid category: missing id, profileId, or name');
  }
  for (const b of budgetItems) {
    if (!b.id || !b.profileId || !b.categoryId || !b.name || b.amount == null)
      throw new Error('Invalid budget item: missing required fields');
  }
  for (const t of transactions) {
    if (!t.id || !t.budgetItemId || !t.profileId || !t.date)
      throw new Error('Invalid transaction: missing required fields');
  }

  // Write to DB (put = upsert)
  for (const p of profiles) await dbPut(STORES.PROFILES, p);
  for (const c of categories) await dbPut(STORES.CATEGORIES, c);
  for (const b of budgetItems) await dbPut(STORES.BUDGET_ITEMS, b);
  for (const t of transactions) await dbPut(STORES.TRANSACTIONS, t);
}

export {
  STORES,
  openDB,
  dbAdd,
  dbPut,
  dbGet,
  dbDelete,
  dbGetAll,
  dbGetByIndex,
  dbGetByIndexRange,
  dbClear,
  dbClearAll,
  getProfileCategories,
  getProfileBudgetItems,
  getProfileTransactions,
  getTransactionsForMonth,
  deleteTransactionsByBudgetItem,
  exportProfileData,
  exportAllData,
  importData,
};
