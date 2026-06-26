/**
 * Tasks — assign work to members (competition or external)
 */

import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import {
  escapeHtml,
  showToast,
  formatDate,
  setButtonLoading,
} from './utils.js';
import { getMembersCache } from './members.js';
import { getCompetitionsCache } from './competitions.js';

let tasksCache = [];

export async function fetchTasks() {
  const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  tasksCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return tasksCache;
}

function getMemberName(memberId) {
  const m = getMembersCache().find((x) => x.id === memberId);
  return m?.fullName ?? memberId;
}

function getCompName(compId) {
  if (!compId) return 'External';
  const c = getCompetitionsCache().find((x) => x.id === compId);
  return c?.compName ?? 'Competition';
}

function taskProgress(task) {
  const ids = task.assignedMemberIds ?? [];
  if (!ids.length) return { done: 0, total: 0, pct: 0 };
  const status = task.memberStatus ?? {};
  const done = ids.filter((id) => status[id] === 'done').length;
  return { done, total: ids.length, pct: Math.round((done / ids.length) * 100) };
}

export function renderTasksList(tasks = tasksCache) {
  const list = document.getElementById('tasks-list');
  const empty = document.getElementById('tasks-empty');
  if (!list) return;

  if (!tasks.length) {
    list.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }

  empty?.classList.add('hidden');

  list.innerHTML = tasks
    .map((t) => {
      const prog = taskProgress(t);
      const typeLabel = t.type === 'competition' ? getCompName(t.competitionId) : 'External Task';
      const typeBadge = t.type === 'competition' ? 'badge-info' : 'badge-muted';

      const membersHtml = (t.assignedMemberIds ?? [])
        .map((mid) => {
          const done = t.memberStatus?.[mid] === 'done';
          const rating = t.memberRatings?.[mid] ?? '';
          return `
          <div class="task-member-row">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span class="text-sm font-medium truncate">${escapeHtml(getMemberName(mid))}</span>
              <span class="badge ${done ? 'badge-success' : 'badge-danger'}">${done ? 'Done' : 'Pending'}</span>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <button type="button" class="btn btn-sm ${done ? 'btn-secondary' : 'btn-primary'}"
                data-toggle-task-status="${escapeHtml(t.id)}" data-member-id="${escapeHtml(mid)}">
                ${done ? 'Mark Pending' : 'Mark Done'}
              </button>
              <input type="number" class="input w-16 text-center text-sm" min="0" max="10" step="0.5"
                placeholder="Rate" value="${rating !== '' ? escapeHtml(rating) : ''}"
                data-task-rating="${escapeHtml(t.id)}" data-member-id="${escapeHtml(mid)}" />
              <button type="button" class="btn btn-sm btn-secondary"
                data-save-task-rating="${escapeHtml(t.id)}" data-member-id="${escapeHtml(mid)}">Rate</button>
            </div>
          </div>`;
        })
        .join('');

      return `
      <article class="task-card" data-task-id="${escapeHtml(t.id)}">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div>
            <span class="badge ${typeBadge}">${escapeHtml(typeLabel)}</span>
            <h3 class="text-lg font-semibold text-primary mt-2">${escapeHtml(t.title)}</h3>
            <p class="text-sm text-muted mt-1">${escapeHtml(t.description || '')}</p>
            <p class="text-xs text-muted mt-2">Due: ${formatDate(t.dueDate)}</p>
          </div>
          <button type="button" class="btn-icon btn-icon-danger" data-delete-task="${escapeHtml(t.id)}" title="Delete">✕</button>
        </div>
        <div class="mb-3">
          <div class="flex justify-between text-xs text-muted mb-1">
            <span>Progress</span><span>${prog.done}/${prog.total} (${prog.pct}%)</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${prog.pct}%"></div></div>
        </div>
        <div class="space-y-2">${membersHtml || '<p class="text-sm text-muted">No members assigned.</p>'}</div>
      </article>`;
    })
    .join('');
}

function openAddTaskModal() {
  const modal = document.getElementById('add-task-modal');
  const form = document.getElementById('add-task-form');
  form?.reset();
  populateTaskMemberSelect();
  populateTaskCompetitionSelect();
  toggleCompetitionField();
  modal?.classList.remove('hidden');
  modal?.classList.add('flex');
}

function closeAddTaskModal() {
  const modal = document.getElementById('add-task-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('flex');
}

function populateTaskMemberSelect() {
  const sel = document.getElementById('task-members');
  if (!sel) return;
  sel.innerHTML = getMembersCache()
    .map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.fullName)} (${escapeHtml(m.studentId)})</option>`)
    .join('');
}

function populateTaskCompetitionSelect() {
  const sel = document.getElementById('task-competition');
  if (!sel) return;
  sel.innerHTML =
    '<option value="">— Select competition —</option>' +
    getCompetitionsCache()
      .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.compName)}</option>`)
      .join('');
}

function toggleCompetitionField() {
  const type = document.getElementById('task-type')?.value;
  const wrap = document.getElementById('task-competition-wrap');
  wrap?.classList.toggle('hidden', type !== 'competition');
}

async function handleAddTask(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('[type="submit"]');
  const assignedMemberIds = Array.from(form.members.selectedOptions).map((o) => o.value);

  if (!form.title.value.trim()) {
    showToast('Task title is required.', 'error');
    return;
  }
  if (!assignedMemberIds.length) {
    showToast('Assign at least one member.', 'error');
    return;
  }

  const memberStatus = {};
  assignedMemberIds.forEach((id) => {
    memberStatus[id] = 'pending';
  });

  setButtonLoading(btn, true, 'Creating…');

  try {
    await addDoc(collection(db, 'tasks'), {
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      type: form.type.value,
      competitionId: form.type.value === 'competition' ? form.competition.value || null : null,
      assignedMemberIds,
      memberStatus,
      memberRatings: {},
      dueDate: form.dueDate.value ? Timestamp.fromDate(new Date(form.dueDate.value)) : null,
      createdAt: serverTimestamp(),
    });
    showToast('Task created.', 'success');
    closeAddTaskModal();
    await refreshTasks();
  } catch (err) {
    console.error(err);
    showToast('Failed to create task.', 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

async function toggleMemberStatus(taskId, memberId) {
  const task = tasksCache.find((t) => t.id === taskId);
  if (!task) return;
  const status = { ...(task.memberStatus ?? {}) };
  status[memberId] = status[memberId] === 'done' ? 'pending' : 'done';
  try {
    await updateDoc(doc(db, 'tasks', taskId), { memberStatus: status });
    await refreshTasks();
  } catch (err) {
    showToast('Failed to update status.', 'error');
  }
}

async function saveMemberRating(taskId, memberId) {
  const input = document.querySelector(
    `[data-task-rating="${taskId}"][data-member-id="${memberId}"]`
  );
  const rating = parseFloat(input?.value);
  if (Number.isNaN(rating) || rating < 0 || rating > 10) {
    showToast('Rating must be 0–10.', 'error');
    return;
  }
  const task = tasksCache.find((t) => t.id === taskId);
  if (!task) return;
  const memberRatings = { ...(task.memberRatings ?? {}) };
  memberRatings[memberId] = rating;
  try {
    await updateDoc(doc(db, 'tasks', taskId), { memberRatings });
    showToast('Rating saved.', 'success');
    await refreshTasks();
  } catch (err) {
    showToast('Failed to save rating.', 'error');
  }
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task?')) return;
  try {
    await deleteDoc(doc(db, 'tasks', taskId));
    showToast('Task deleted.', 'success');
    await refreshTasks();
  } catch (err) {
    showToast('Failed to delete task.', 'error');
  }
}

export async function refreshTasks() {
  await fetchTasks();
  renderTasksList();
}

export function initTasksTab() {
  document.getElementById('add-task-btn')?.addEventListener('click', openAddTaskModal);
  document.getElementById('task-type')?.addEventListener('change', toggleCompetitionField);

  document.querySelectorAll('[data-close-task-modal]').forEach((btn) => {
    btn.addEventListener('click', closeAddTaskModal);
  });

  document.getElementById('add-task-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'add-task-modal') closeAddTaskModal();
  });

  document.getElementById('add-task-form')?.addEventListener('submit', handleAddTask);

  document.getElementById('tasks-list')?.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('[data-toggle-task-status]');
    if (toggleBtn) {
      toggleMemberStatus(toggleBtn.dataset.toggleTaskStatus, toggleBtn.dataset.memberId);
      return;
    }
    const rateBtn = e.target.closest('[data-save-task-rating]');
    if (rateBtn) {
      saveMemberRating(rateBtn.dataset.saveTaskRating, rateBtn.dataset.memberId);
      return;
    }
    const delBtn = e.target.closest('[data-delete-task]');
    if (delBtn) deleteTask(delBtn.dataset.deleteTask);
  });
}

export function getTasksCache() {
  return tasksCache;
}
