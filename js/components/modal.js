// js/components/modal.js — Generic modal component

const modalContainer = document.getElementById('modalContainer');

function openModal(title, contentHTML, options = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal__handle"></div>
      <button class="modal__close" aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <h2 class="modal__title">${title}</h2>
      <div class="modal__body">${contentHTML}</div>
    </div>
  `;

  // Close handlers
  const close = () => {
    overlay.remove();
    if (options.onClose) options.onClose();
  };

  overlay.querySelector('.modal__close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  modalContainer.appendChild(overlay);

  return { overlay, close };
}

function showConfirm(title, message, options = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
      <div class="confirm-dialog__box">
        <div class="confirm-dialog__title">${title}</div>
        <div class="confirm-dialog__message">${message}</div>
        <div class="btn-group">
          <button class="btn btn--secondary btn--sm confirm-cancel">${options.cancelText || 'Cancel'}</button>
          <button class="btn ${options.danger ? 'btn--danger' : 'btn--primary'} btn--sm confirm-ok">${options.okText || 'Confirm'}</button>
        </div>
      </div>
    `;

    const close = (result) => {
      dialog.remove();
      resolve(result);
    };

    dialog.querySelector('.confirm-cancel').addEventListener('click', () => close(false));
    dialog.querySelector('.confirm-ok').addEventListener('click', () => close(true));
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close(false);
    });

    modalContainer.appendChild(dialog);
  });
}

export { openModal, showConfirm };
