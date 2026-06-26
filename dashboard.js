/**
 * Admin Dashboard — tab navigation and module orchestration
 */

import { requireAuth, initLogout, auth, onAuthStateChanged } from './auth.js';
import { initMembersTab, refreshMembers, getMembersCache } from './members.js';
import { initCompetitionsTab, refreshCompetitions, stopCountdownTimers, getCompetitionsCache } from './competitions.js';
import { initEvaluationsTab, refreshEvaluations } from './evaluations.js';
import { initTasksTab, refreshTasks, getTasksCache } from './tasks.js';
import { showToast, getCurrentMonthLabel } from './utils.js';

function switchTab(tabId) {
  document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.tabPanel !== tabId);
  });
  document.querySelectorAll('[data-tab-btn]').forEach((btn) => {
    const isActive = btn.dataset.tabBtn === tabId;
    btn.classList.toggle('sidebar-link-active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  if (tabId !== 'competitions') stopCountdownTimers();

  if (tabId === 'competitions') refreshCompetitions();
  if (tabId === 'evaluations') refreshEvaluations(getMembersCache());
  if (tabId === 'tasks') refreshTasks();
}

function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const close = () => {
    sidebar?.classList.add('-translate-x-full');
    overlay?.classList.add('hidden');
  };
  const open = () => {
    sidebar?.classList.remove('-translate-x-full');
    overlay?.classList.remove('hidden');
  };

  document.getElementById('sidebar-open')?.addEventListener('click', open);
  document.getElementById('sidebar-close')?.addEventListener('click', close);
  overlay?.addEventListener('click', close);

  document.querySelectorAll('[data-tab-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tabBtn);
      close();
    });
  });
}

async function loadDashboardData() {
  const loading = document.getElementById('dashboard-loading');
  loading?.classList.remove('hidden');
  try {
    const members = await refreshMembers();
    await refreshCompetitions();
    initEvaluationsTab(members);
    await refreshTasks();

    document.getElementById('eval-month-label').textContent = getCurrentMonthLabel();
    document.getElementById('stat-members').textContent = members.length;
    document.getElementById('stat-competitions').textContent = getCompetitionsCache().length;
    document.getElementById('stat-tasks').textContent = getTasksCache().length;
  } catch (err) {
    console.error(err);
    showToast('Failed to load dashboard.', 'error');
  } finally {
    loading?.classList.add('hidden');
  }
}

async function initDashboard() {
  try {
    const user = await requireAuth();
    document.getElementById('admin-email').textContent = user.email ?? '';
    initLogout();
    initSidebar();
    initMembersTab();
    initCompetitionsTab();
    initTasksTab();
    switchTab('members');
    await loadDashboardData();
    onAuthStateChanged(auth, (u) => { if (!u) window.location.href = 'login.html'; });
  } catch (err) {
    console.error(err);
  }
}

initDashboard();
