/**
 * Evaluations & Monthly MVP — score tracking and hero section
 */

import {
  collection,
  getDocs,
  doc,
  setDoc,
  query,
  where,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import {
  escapeHtml,
  showToast,
  getCurrentMonthKey,
  getCurrentMonthLabel,
  setButtonLoading,
} from './utils.js';

let evaluationsCache = [];
let membersRef = [];

function evaluationDocId(memberId, month) {
  return `${memberId}_${month}`;
}

export function setEvaluationsMembers(members) {
  membersRef = members ?? [];
}

export async function fetchEvaluations(month = getCurrentMonthKey()) {
  const q = query(collection(db, 'evaluations'), where('month', '==', month));
  const snapshot = await getDocs(q);
  evaluationsCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return evaluationsCache;
}

function getMemberEvaluation(memberId) {
  return evaluationsCache.find((e) => e.memberId === memberId);
}

export function calculateMVP(members, evaluations) {
  if (!members?.length) return null;

  const scored = members
    .map((m) => {
      const ev = evaluations.find((e) => e.memberId === m.id);
      return { member: m, score: ev?.score ?? null, notes: ev?.notes ?? '' };
    })
    .filter((item) => item.score != null && !Number.isNaN(item.score) && item.score > 0);

  if (!scored.length) return null;

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.member.fullName || '').localeCompare(b.member.fullName || '');
  });

  return scored[0];
}

export function renderMVPHero(mvp) {
  const hero = document.getElementById('mvp-hero');
  if (!hero) return;

  const monthLabel = getCurrentMonthLabel();

  if (!mvp) {
    hero.innerHTML = `
      <div class="mvp-hero-inner mvp-empty">
        <div class="mvp-badge-icon">🏆</div>
        <div>
          <p class="text-sm uppercase tracking-widest text-amber-200/80 font-semibold">Monthly MVP — ${escapeHtml(monthLabel)}</p>
          <h2 class="text-2xl font-bold mt-1">No scores yet this month</h2>
          <p class="text-amber-100/70 mt-2 text-sm">Submit evaluation scores below to crown this month's MVP.</p>
        </div>
      </div>`;
    return;
  }

  const { member, score } = mvp;
  hero.innerHTML = `
    <div class="mvp-hero-inner">
      <div class="mvp-badge-icon animate-pulse">🏆</div>
      <div class="flex-1">
        <p class="text-sm uppercase tracking-widest text-amber-200/80 font-semibold">Monthly MVP — ${escapeHtml(monthLabel)}</p>
        <h2 class="text-3xl font-bold mt-1">${escapeHtml(member.fullName)}</h2>
        <p class="text-amber-100/80 mt-1">Student ID: <span class="font-mono font-semibold">${escapeHtml(member.studentId)}</span></p>
      </div>
      <div class="mvp-score-badge">
        <span class="text-4xl font-black">${escapeHtml(score)}</span>
        <span class="text-sm opacity-80">/ 10</span>
      </div>
    </div>`;
}

export function renderEvaluationList(members) {
  const list = document.getElementById('evaluations-list');
  const emptyState = document.getElementById('evaluations-empty');
  if (!list) return;

  if (!members?.length) {
    list.innerHTML = '';
    emptyState?.classList.remove('hidden');
    return;
  }

  emptyState?.classList.add('hidden');

  list.innerHTML = members
    .map((m) => {
      const ev = getMemberEvaluation(m.id);
      const score = ev?.score ?? '';
      const notes = ev?.notes ?? '';

      return `
      <div class="evaluation-row" data-member-id="${escapeHtml(m.id)}">
        <div class="evaluation-member-info">
          <p class="font-semibold text-primary">${escapeHtml(m.fullName)}</p>
          <p class="text-xs text-muted font-mono">${escapeHtml(m.studentId)}</p>
        </div>
        <div class="evaluation-inputs">
          <input type="number" class="input eval-score-input" min="0" max="10" step="0.5"
            placeholder="0–10" value="${score !== '' ? escapeHtml(score) : ''}"
            data-score-input="${escapeHtml(m.id)}" aria-label="Score for ${escapeHtml(m.fullName)}" />
          <input type="text" class="input eval-notes-input" placeholder="Notes (optional)"
            value="${escapeHtml(notes)}" data-notes-input="${escapeHtml(m.id)}" />
          <button type="button" class="btn btn-primary btn-sm" data-save-eval="${escapeHtml(m.id)}">Save</button>
        </div>
      </div>`;
    })
    .join('');
}

async function saveEvaluation(memberId) {
  const scoreInput = document.querySelector(`[data-score-input="${memberId}"]`);
  const notesInput = document.querySelector(`[data-notes-input="${memberId}"]`);
  const saveBtn = document.querySelector(`[data-save-eval="${memberId}"]`);

  const rawScore = scoreInput?.value?.trim();
  if (rawScore === '' || rawScore == null) {
    showToast('Please enter a score between 0 and 10.', 'error');
    return;
  }

  const score = parseFloat(rawScore);
  const notes = notesInput?.value?.trim() ?? '';
  const month = getCurrentMonthKey();

  if (Number.isNaN(score) || score < 0 || score > 10) {
    showToast('Score must be between 0 and 10.', 'error');
    return;
  }

  setButtonLoading(saveBtn, true, 'Saving…');

  try {
    const docId = evaluationDocId(memberId, month);
    await setDoc(doc(db, 'evaluations', docId), {
      memberId,
      month,
      score,
      notes,
      updatedAt: new Date().toISOString(),
    });

    showToast('Evaluation saved.', 'success');
    await refreshEvaluations();
  } catch (err) {
    console.error('Save evaluation error:', err);
    showToast(err?.code === 'permission-denied' ? 'Permission denied. Check Firestore rules.' : 'Failed to save evaluation.', 'error');
  } finally {
    setButtonLoading(saveBtn, false);
  }
}

export async function refreshEvaluations(members) {
  if (members?.length) membersRef = members;
  const month = getCurrentMonthKey();
  await fetchEvaluations(month);
  renderEvaluationList(membersRef);
  renderMVPHero(calculateMVP(membersRef, evaluationsCache));
}

export function initEvaluationsTab(members) {
  setEvaluationsMembers(members);

  document.getElementById('evaluations-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-save-eval]');
    if (btn) saveEvaluation(btn.dataset.saveEval);
  });

  refreshEvaluations(members);
}

export function getEvaluationsCache() {
  return evaluationsCache;
}
