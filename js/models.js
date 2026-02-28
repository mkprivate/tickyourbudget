// js/models.js — Data model helpers & UUID generation

function generateId() {
  // crypto.randomUUID is available in secure contexts (HTTPS / localhost)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const FREQUENCY = {
  ONE_TIME: 'One Time',
  WEEKLY: 'Weekly',
  BI_WEEKLY: 'Bi-Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
};

const FREQUENCY_LIST = Object.values(FREQUENCY);

const TX_STATUS = {
  PENDING: 'Pending',
  PAID: 'Paid',
};

function createProfile(name) {
  return {
    id: generateId(),
    name: name.trim(),
  };
}

function createCategory({ profileId, name, description = '', parentId = null }) {
  return {
    id: generateId(),
    profileId,
    name: name.trim(),
    description: description.trim(),
    parentId,
  };
}

function createBudgetItem({
  profileId,
  categoryId,
  name,
  amount,
  description = '',
  frequency = FREQUENCY.MONTHLY,
  startDate,
  endDate = null,
}) {
  return {
    id: generateId(),
    profileId,
    categoryId,
    name: name.trim(),
    amount: parseFloat(amount),
    description: description.trim(),
    frequency,
    startDate: startDate || new Date().toISOString().split('T')[0],
    endDate: endDate || null,
  };
}

function createTransaction({ budgetItemId, profileId, date, amount, name }) {
  return {
    id: generateId(),
    budgetItemId,
    profileId,
    date,
    status: TX_STATUS.PENDING,
    snapshotAmount: parseFloat(amount),
    snapshotName: name,
  };
}

// Formatting helpers

function formatCurrency(amount) {
  // Read currency from localStorage (avoids circular import with profile.js)
  const currencyCode = localStorage.getItem('tyb_currency') || 'INR';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (e) {
    // Fallback if currency code is invalid
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getMonthLabel(year, month) {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export {
  generateId,
  FREQUENCY,
  FREQUENCY_LIST,
  TX_STATUS,
  createProfile,
  createCategory,
  createBudgetItem,
  createTransaction,
  formatCurrency,
  formatDate,
  getMonthLabel,
};
