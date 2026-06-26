/**
 * Firebase Authentication — admin login, logout, and route guards
 */

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { auth } from './firebase-config.js';
import { showToast, setButtonLoading } from './utils.js';

const SESSION_KEY = 'tms-admin-session';

/** Persist lightweight session flag (Auth state is source of truth) */
export function setSession(active) {
  if (active) {
    sessionStorage.setItem(SESSION_KEY, 'true');
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

/** Redirect unauthenticated users away from protected pages */
export function requireAuth(redirectTo = 'login.html') {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        if (user) {
          setSession(true);
          resolve(user);
        } else {
          setSession(false);
          window.location.href = redirectTo;
          reject(new Error('Not authenticated'));
        }
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );
  });
}

/** Redirect already-authenticated users away from login page */
export function redirectIfAuthenticated(redirectTo = 'dashboard.html') {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      setSession(true);
      window.location.href = redirectTo;
    }
  });
}

/** Initialize admin login form */
function initLoginForm() {
  const form = document.getElementById('login-form');
  const submitBtn = document.getElementById('login-btn');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      showToast('Email and password are required.', 'error');
      return;
    }

    setButtonLoading(submitBtn, true, 'Signing in…');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setSession(true);
      showToast('Login successful. Redirecting…', 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 800);
    } catch (err) {
      console.error('Login error:', err);
      const message =
        err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
          ? 'Invalid email or password.'
          : 'Login failed. Please try again.';
      showToast(message, 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

/** Wire logout buttons */
export function initLogout() {
  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await signOut(auth);
        setSession(false);
        window.location.href = 'login.html';
      } catch (err) {
        console.error('Logout error:', err);
        showToast('Logout failed.', 'error');
      }
    });
  });
}

const page = document.body.dataset.page;

if (page === 'admin-login') {
  redirectIfAuthenticated();
  initLoginForm();
}

export { auth, onAuthStateChanged };
