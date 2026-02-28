// js/app.js — Main application entry point

import { openDB } from './db.js';
import { initTheme, setupThemeToggle } from './components/theme.js';
import {
  loadProfileSelector,
  setupProfileSelector,
  setupProfileManager,
  setProfileChangeCallback,
  ensureDefaultProfile,
  renderProfiles,
} from './components/profile.js';
import { initHomeView, renderHome } from './views/home.js';
import { initItemsView, renderItems } from './views/items.js';
import { initCategoriesView, renderCategories } from './views/categories.js';
import { initDataView, renderData, setDataChangeCallback } from './views/data.js';

// Current active view
let currentView = 'viewHome';

// View render map
const viewRenderers = {
  viewHome: renderHome,
  viewItems: renderItems,
  viewCategories: renderCategories,
  viewData: renderData,
  viewProfiles: renderProfiles,
};

// Navigation
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const viewId = item.dataset.view;

      // Update active nav
      navItems.forEach((n) => n.classList.remove('active'));
      item.classList.add('active');

      // Update active view
      views.forEach((v) => v.classList.remove('active'));
      document.getElementById(viewId).classList.add('active');

      // Show/hide FABs
      document.querySelectorAll('.fab').forEach((f) => (f.style.display = 'none'));
      if (viewId === 'viewItems') {
        document.getElementById('fabAddItem').style.display = 'flex';
      } else if (viewId === 'viewCategories') {
        document.getElementById('fabAddCategory').style.display = 'flex';
      }

      currentView = viewId;

      // Render the new view
      const renderer = viewRenderers[viewId];
      if (renderer) renderer();
    });
  });
}

// Render current view
function renderCurrentView() {
  const renderer = viewRenderers[currentView];
  if (renderer) renderer();
}

// On profile change, re-render current view
function handleProfileChange() {
  renderCurrentView();
}

// Initialize app
async function init() {
  try {
    // Init theme first (instant, no DB needed)
    initTheme();
    setupThemeToggle();

    // Open database
    await openDB();

    // Ensure at least one profile
    await ensureDefaultProfile();

    // Load profiles into selector
    await loadProfileSelector();
    setupProfileSelector();
    setupProfileManager();

    // Set callbacks
    setProfileChangeCallback(handleProfileChange);
    setDataChangeCallback(renderCurrentView);

    // Init views
    initHomeView();
    initItemsView();
    initCategoriesView();
    initDataView();

    // Setup navigation
    setupNavigation();

    // Initial FAB visibility
    document.getElementById('fabAddItem').style.display = 'none';
    document.getElementById('fabAddCategory').style.display = 'none';

    // Render home view
    renderHome();

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });
    }

    // Fix mobile keyboard overlap: scroll focused inputs into view
    document.addEventListener('focusin', (e) => {
      if (e.target.matches('input, select, textarea')) {
        setTimeout(() => {
          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 350);
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Skip if user is typing in an input/textarea/select
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      // Skip if modal is open
      if (document.querySelector('.modal-overlay') || document.querySelector('.confirm-dialog')) {
        return;
      }

      const shortcutsOverlay = document.getElementById('shortcutsOverlay');

      // Dismiss shortcuts overlay
      if (e.key === 'Escape') {
        if (!shortcutsOverlay.classList.contains('hidden')) {
          shortcutsOverlay.classList.add('hidden');
          return;
        }
      }

      // Tab navigation: 1-5
      const navKeys = { '1': 'viewHome', '2': 'viewItems', '3': 'viewCategories', '4': 'viewData', '5': 'viewProfiles' };
      if (navKeys[e.key]) {
        e.preventDefault();
        const navItem = document.querySelector(`.nav-item[data-view="${navKeys[e.key]}"]`);
        if (navItem) navItem.click();
        return;
      }

      // Arrow keys for month navigation (Home view only)
      if (e.key === 'ArrowLeft' && currentView === 'viewHome') {
        e.preventDefault();
        document.getElementById('btnPrevMonth').click();
        return;
      }
      if (e.key === 'ArrowRight' && currentView === 'viewHome') {
        e.preventDefault();
        document.getElementById('btnNextMonth').click();
        return;
      }

      // T = Today
      if (e.key === 't' || e.key === 'T') {
        if (currentView === 'viewHome') {
          e.preventDefault();
          document.getElementById('btnToday').click();
        }
        return;
      }

      // N = New item or category
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (currentView === 'viewItems') {
          document.getElementById('fabAddItem').click();
        } else if (currentView === 'viewCategories') {
          document.getElementById('fabAddCategory').click();
        }
        return;
      }

      // / = Focus search
      if (e.key === '/') {
        e.preventDefault();
        let searchInput = null;
        if (currentView === 'viewHome') {
          searchInput = document.getElementById('homeSearch');
        } else if (currentView === 'viewItems') {
          searchInput = document.getElementById('itemsSearch');
        }
        if (searchInput) searchInput.focus();
        return;
      }

      // ? = Show keyboard shortcuts
      if (e.key === '?') {
        e.preventDefault();
        shortcutsOverlay.classList.toggle('hidden');
        return;
      }
    });

    // Click outside shortcuts overlay to dismiss
    document.getElementById('shortcutsOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        e.currentTarget.classList.add('hidden');
      }
    });

    console.log('tickyourbudget initialized');
  } catch (err) {
    console.error('Failed to initialize app:', err);
  }
}

// Start the app
init();
