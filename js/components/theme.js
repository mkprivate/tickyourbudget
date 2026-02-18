// js/components/theme.js — Dark/Light theme toggle

const THEME_KEY = 'tyb_theme';

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);

  const iconSun = document.querySelector('.icon-sun');
  const iconMoon = document.querySelector('.icon-moon');

  if (theme === 'dark') {
    iconSun.classList.add('hidden');
    iconMoon.classList.remove('hidden');
  } else {
    iconSun.classList.remove('hidden');
    iconMoon.classList.add('hidden');
  }

  // Update meta theme-color
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = theme === 'dark' ? '#1a1625' : '#a78bfa';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

function setupThemeToggle() {
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
}

export { initTheme, setupThemeToggle };
