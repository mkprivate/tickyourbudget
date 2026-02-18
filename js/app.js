// js/app.js — Main application entry point

import { openDB } from './db.js';
import { initTheme, setupThemeToggle } from './components/theme.js';
import {
  loadProfileSelector,
  setupProfileSelector,
  setupProfileManager,
  setProfileChangeCallback,
  ensureDefaultProfile,
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

    console.log('tickyourbudget initialized');
  } catch (err) {
    console.error('Failed to initialize app:', err);
  }
}

// Start the app
init();
