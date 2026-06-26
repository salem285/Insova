/**
 * Competitions & Projects — cards with images, team, cost, components
 */

import {
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import {
  escapeHtml,
  showToast,
  getCountdown,
  setButtonLoading,
  formatCurrency,
  sumComponentPrices,
} from './utils.js';
import { getMembersCache } from './members.js';
import { uploadProjectImage, resolveStorageUrl, validateImageFile } from './storage.js';

let competitionsCache = [];
let countdownInterval = null;

export async function fetchCompetitions() {
  const q = query(collection(db, 'competitions'), orderBy('deadlineDate', 'asc'));
  const snapshot = await getDocs(q);
  competitionsCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return competitionsCache;
}

export function getCompetitionsCache() {
  return competitionsCache;
}

function statusBadgeClass(status) {
  const map = { active: 'badge-success', upcoming: 'badge-info', completed: 'badge-muted', cancelled: 'badge-danger' };
  return map[status] || 'badge-muted';
}

function memberNames(ids = []) {
  const members = getMembersCache();
  return ids.map((id) => members.find((m) => m.id === id)?.fullName ?? id).filter(Boolean);
}

function renderComponentsList(components = []) {
  if (!components.length) return '';
  const rows = components
    .map(
      (c) =>
        `<tr><td class="table-cell">${escapeHtml(c.name)}</td><td class="table-cell">${escapeHtml(c.material)}</td><td class="table-cell">${formatCurrency(c.price)}</td><td class="table-cell">${escapeHtml(c.qty ?? 1)}</td></tr>`
    )
    .join('');
  return `
    <div class="mt-3">
      <p class="text-xs font-semibold uppercase text-muted mb-2">Components & Materials</p>
      <div class="table-wrap"><table class="data-table text-xs"><thead><tr><th>Component</th><th>Material</th><th>Price</th><th>Qty</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
}

export async function renderCompetitionsGrid(competitions = competitionsCache) {
  const grid = document.getElementById('competitions-grid');
  const emptyState = document.getElementById('competitions-empty');
  if (!grid) return;

  if (!competitions.length) {
    grid.innerHTML = '';
    emptyState?.classList.remove('hidden');
    return;
  }

  emptyState?.classList.add('hidden');

  const cards = await Promise.all(
    competitions.map(async (c) => {
      const imgUrl = c.projectImagePath ? await resolveStorageUrl(c.projectImagePath) : null;
      const team = memberNames(c.memberIds ?? []);
      const componentsCost = sumComponentPrices(c.components);
      const totalCost = c.cost ?? componentsCost;

      return `
    <article class="competition-card" data-competition-id="${escapeHtml(c.id)}">
      ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="" class="competition-img mb-3" />` : '<div class="competition-img-placeholder mb-3">No image</div>'}
      <div class="flex items-start justify-between gap-3 mb-2">
        <div>
          <span class="badge ${statusBadgeClass(c.status)}">${escapeHtml(c.status || 'active')}</span>
          <h3 class="text-lg font-semibold mt-2 text-primary">${escapeHtml(c.compName)}</h3>
          <p class="text-sm text-muted mt-1">Project: <span class="font-medium">${escapeHtml(c.projectName)}</span></p>
        </div>
        <button type="button" class="btn-icon btn-icon-danger shrink-0" data-delete-competition="${escapeHtml(c.id)}">✕</button>
      </div>
      <p class="text-sm text-muted mb-2 line-clamp-2">${escapeHtml(c.description || 'No description.')}</p>
      <p class="text-sm"><span class="text-muted">Team:</span> ${team.length ? escapeHtml(team.join(', ')) : '—'}</p>
      <p class="text-sm font-semibold text-primary mt-1">Cost: ${formatCurrency(totalCost)}</p>
      ${renderComponentsList(c.components)}
      <div class="countdown-box mt-3" data-deadline-id="${escapeHtml(c.id)}">${renderCountdownHtml(c.deadlineDate, c.id)}</div>
    </article>`;
    })
  );

  grid.innerHTML = cards.join('');
  startCountdownTimers();
}

function renderCountdownHtml(deadline, id) {
  const cd = getCountdown(deadline);
  if (cd.expired) return `<div class="countdown-expired"><span class="text-sm font-semibold">Deadline passed</span></div>`;
  return `
    <p class="text-xs uppercase tracking-wider text-muted mb-2">Time remaining</p>
    <div class="countdown-timer" data-countdown="${escapeHtml(id)}">
      <div class="countdown-unit"><span class="countdown-value" data-days>${cd.days}</span><span class="countdown-label">Days</span></div>
      <div class="countdown-separator">:</div>
      <div class="countdown-unit"><span class="countdown-value" data-hours>${String(cd.hours).padStart(2, '0')}</span><span class="countdown-label">Hrs</span></div>
      <div class="countdown-separator">:</div>
      <div class="countdown-unit"><span class="countdown-value" data-minutes>${String(cd.minutes).padStart(2, '0')}</span><span class="countdown-label">Min</span></div>
    </div>`;
}

function startCountdownTimers() {
  if (countdownInterval) clearInterval(countdownInterval);
  const tick = () => {
    competitionsCache.forEach((c) => {
      const el = document.querySelector(`[data-countdown="${c.id}"]`);
      if (!el) return;
      const cd = getCountdown(c.deadlineDate);
      if (cd.expired) {
        document.querySelector(`[data-deadline-id="${c.id}"]`).innerHTML =
          `<div class="countdown-expired"><span class="text-sm font-semibold">Deadline passed</span></div>`;
        return;
      }
      el.querySelector('[data-days]').textContent = cd.days;
      el.querySelector('[data-hours]').textContent = String(cd.hours).padStart(2, '0');
      el.querySelector('[data-minutes]').textContent = String(cd.minutes).padStart(2, '0');
    });
  };
  tick();
  countdownInterval = setInterval(tick, 60000);
}

function populateCompetitionMembersSelect() {
  const sel = document.getElementById('comp-members');
  if (!sel) return;
  sel.innerHTML = getMembersCache()
    .map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.fullName)}</option>`)
    .join('');
}

function addComponentRow(container, data = {}) {
  const row = document.createElement('div');
  row.className = 'component-row';
  row.innerHTML = `
    <input type="text" class="input comp-name" placeholder="Component" value="${escapeHtml(data.name ?? '')}" />
    <input type="text" class="input comp-material" placeholder="Material" value="${escapeHtml(data.material ?? '')}" />
    <input type="number" class="input comp-price" placeholder="Price" min="0" step="0.01" value="${data.price ?? ''}" />
    <input type="number" class="input comp-qty" placeholder="Qty" min="1" value="${data.qty ?? 1}" />
    <button type="button" class="btn-icon btn-icon-danger comp-remove" title="Remove">✕</button>`;
  row.querySelector('.comp-remove').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function getComponentsFromForm(form) {
  return Array.from(form.querySelectorAll('.component-row')).map((row) => ({
    name: row.querySelector('.comp-name')?.value?.trim() ?? '',
    material: row.querySelector('.comp-material')?.value?.trim() ?? '',
    price: parseFloat(row.querySelector('.comp-price')?.value) || 0,
    qty: parseInt(row.querySelector('.comp-qty')?.value, 10) || 1,
  })).filter((c) => c.name);
}

function openAddModal() {
  const modal = document.getElementById('add-competition-modal');
  const form = document.getElementById('add-competition-form');
  form?.reset();
  populateCompetitionMembersSelect();
  const compList = document.getElementById('components-list');
  if (compList) {
    compList.innerHTML = '';
    addComponentRow(compList);
  }
  modal?.classList.remove('hidden');
  modal?.classList.add('flex');
}

function closeAddModal() {
  document.getElementById('add-competition-modal')?.classList.add('hidden');
  document.getElementById('add-competition-modal')?.classList.remove('flex');
}

async function handleAddCompetition(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('[type="submit"]');

  const components = getComponentsFromForm(form);
  const memberIds = Array.from(form.members?.selectedOptions ?? []).map((o) => o.value);
  const cost = parseFloat(form.cost?.value) || sumComponentPrices(components);

  if (!form.compName.value.trim() || !form.projectName.value.trim() || !form.deadlineDate.value) {
    showToast('Fill all required fields.', 'error');
    return;
  }

  setButtonLoading(btn, true, 'Creating…');

  try {
    const docRef = await addDoc(collection(db, 'competitions'), {
      compName: form.compName.value.trim(),
      projectName: form.projectName.value.trim(),
      deadlineDate: Timestamp.fromDate(new Date(form.deadlineDate.value)),
      description: form.description.value.trim(),
      status: form.status.value,
      memberIds,
      components,
      cost,
      projectImagePath: '',
      createdAt: Timestamp.now(),
    });

    const imageFile = form.projectImage?.files?.[0];
    if (imageFile) {
      const err = validateImageFile(imageFile, 'Project image');
      if (err) {
        showToast(err, 'error');
      } else {
        const path = await uploadProjectImage(docRef.id, imageFile);
        await updateDoc(doc(db, 'competitions', docRef.id), { projectImagePath: path });
      }
    }

    showToast('Competition created.', 'success');
    closeAddModal();
    await refreshCompetitions();
  } catch (err) {
    console.error(err);
    showToast('Failed to create competition.', 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

async function deleteCompetition(id) {
  const comp = competitionsCache.find((c) => c.id === id);
  if (!comp || !confirm(`Delete "${comp.compName}"?`)) return;
  try {
    await deleteDoc(doc(db, 'competitions', id));
    showToast('Deleted.', 'success');
    await refreshCompetitions();
  } catch (err) {
    showToast('Delete failed.', 'error');
  }
}

export async function refreshCompetitions() {
  await fetchCompetitions();
  await renderCompetitionsGrid();
}

export function initCompetitionsTab() {
  document.getElementById('add-competition-btn')?.addEventListener('click', openAddModal);
  document.getElementById('add-component-row')?.addEventListener('click', () => {
    addComponentRow(document.getElementById('components-list'));
  });
  document.querySelectorAll('[data-close-competition-modal]').forEach((b) => b.addEventListener('click', closeAddModal));
  document.getElementById('add-competition-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'add-competition-modal') closeAddModal();
  });
  document.getElementById('add-competition-form')?.addEventListener('submit', handleAddCompetition);
  document.getElementById('competitions-grid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete-competition]');
    if (btn) deleteCompetition(btn.dataset.deleteCompetition);
  });
}

export function stopCountdownTimers() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}
