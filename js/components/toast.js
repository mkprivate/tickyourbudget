// js/components/toast.js — Toast notification system

const toastContainer = document.getElementById('toastContainer');

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  // Auto-remove after animation ends
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

export { showToast };
