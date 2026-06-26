/**
 * Shared UI utilities: theme, toasts, validation, formatting
 */

const THEME_KEY = 'tms-theme';

/** Initialize dark/light theme from localStorage or system preference */
export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
  bindThemeToggle();
}

/** Apply theme class to document root */
export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(THEME_KEY, theme);
  updateThemeToggleIcons(theme);
}

function bindThemeToggle() {
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      applyTheme(isDark ? 'light' : 'dark');
    });
  });
}

function updateThemeToggleIcons(theme) {
  document.querySelectorAll('[data-theme-icon-light]').forEach((el) => {
    el.classList.toggle('hidden', theme === 'dark');
  });
  document.querySelectorAll('[data-theme-icon-dark]').forEach((el) => {
    el.classList.toggle('hidden', theme === 'light');
  });
}

/**
 * Show a toast notification
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration ms
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const colors = {
    success: 'bg-emerald-600 border-emerald-500',
    error: 'bg-red-600 border-red-500',
    info: 'bg-blue-600 border-blue-500',
  };

  const toast = document.createElement('div');
  toast.className = `toast-enter pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-white text-sm font-medium ${colors[type] || colors.info}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button type="button" class="ml-2 opacity-80 hover:opacity-100" aria-label="Dismiss">&times;</button>
  `;

  const dismiss = () => {
    toast.classList.replace('toast-enter', 'toast-exit');
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector('button')?.addEventListener('click', dismiss);
  container.appendChild(toast);
  setTimeout(dismiss, duration);
}

/** Escape HTML to prevent XSS when inserting user content */
export function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/** Format Firestore Timestamp or Date to locale date string */
export function formatDate(value) {
  if (!value) return '—';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Current month key for evaluations, e.g. "2026-06" */
export function getCurrentMonthKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

/** Human-readable month label */
export function getCurrentMonthLabel() {
  return new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Validate Egyptian National ID (14 digits) */
export function isValidNationalId(id) {
  return /^\d{14}$/.test(String(id).trim());
}

/** Validate email format */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

/** Validate member registration form fields */
export function validateMemberForm(data, { requireContact = false } = {}) {
  const errors = {};

  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.fullName = 'Full name must be at least 2 characters.';
  }
  if (!isValidNationalId(data.nationalId)) {
    errors.nationalId = 'National ID must be exactly 14 digits.';
  }
  const age = Number(data.age);
  if (!Number.isInteger(age) || age < 16 || age > 100) {
    errors.age = 'Age must be between 16 and 100.';
  }
  if (!data.studentId || data.studentId.trim().length < 3) {
    errors.studentId = 'Student ID must be at least 3 characters.';
  }

  if (requireContact || data.email !== undefined) {
    if (!data.email || !isValidEmail(data.email)) {
      errors.email = 'A valid email address is required.';
    }
    if (!data.phone || data.phone.trim().length < 8) {
      errors.phone = 'Phone number must be at least 8 digits.';
    }
    if (!data.address || data.address.trim().length < 5) {
      errors.address = 'Address must be at least 5 characters.';
    }
  }

  return errors;
}

/** Format currency (EGP) */
export function formatCurrency(amount) {
  const num = Number(amount);
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EGP' }).format(num);
}

/** Sum component prices */
export function sumComponentPrices(components = []) {
  return components.reduce((sum, c) => sum + (Number(c.price) || 0) * (Number(c.qty) || 1), 0);
}

/** Show inline field errors on a form */
export function displayFormErrors(form, errors) {
  form.querySelectorAll('[data-error-for]').forEach((el) => {
    const field = el.getAttribute('data-error-for');
    const message = errors[field];
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
    const input = form.querySelector(`[name="${field}"]`);
    if (input) {
      input.classList.toggle('input-error', Boolean(message));
    }
  });
}

/** Clear all form errors */
export function clearFormErrors(form) {
  displayFormErrors(form, {});
}

/** Debounce helper for search inputs */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Compute countdown parts from a deadline date */
export function getCountdown(deadline) {
  const target = deadline?.toDate ? deadline.toDate() : new Date(deadline);
  const now = new Date();
  const diff = target.getTime() - now.getTime();

  if (Number.isNaN(target.getTime())) {
    return { expired: true, days: 0, hours: 0, minutes: 0, totalMs: 0 };
  }
  if (diff <= 0) {
    return { expired: true, days: 0, hours: 0, minutes: 0, totalMs: diff };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { expired: false, days, hours, minutes, totalMs: diff };
}

/** Set button loading state */
export function setButtonLoading(button, loading, loadingText = 'Please wait…') {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="inline-flex items-center gap-2">${loadingText}</span>`;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
    }
  }
}
