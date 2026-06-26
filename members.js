/**
 * Members CRUD — Team Directory, CV profile view, exports
 */

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import {
  escapeHtml,
  formatDate,
  showToast,
  debounce,
  validateMemberForm,
  displayFormErrors,
  clearFormErrors,
  setButtonLoading,
} from './utils.js';
import { resolveStorageUrl } from './storage.js';
import { exportMemberData, exportAllMembers, downloadImageFromUrl } from './export.js';

let membersCache = [];
let currentCvMember = null;

export async function fetchMembers() {
  const q = query(collection(db, 'members'), orderBy('fullName'));
  const snapshot = await getDocs(q);
  membersCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return membersCache;
}

function maskNationalId(id) {
  if (!id) return '—';
  const str = String(id);
  if (str.length <= 6) return '••••••';
  return `${str.slice(0, 4)}••••••${str.slice(-2)}`;
}

/** Resolve member image: Base64 data URL in Firestore, or legacy Storage path */
async function resolveMemberImage(member, dataField, legacyPathField) {
  const dataUrl = member[dataField];
  if (dataUrl) return dataUrl;
  const path = member[legacyPathField];
  if (path) return resolveStorageUrl(path);
  return null;
}

function setAvatarImage(memberId, src) {
  const el = document.querySelector(`[data-avatar="${memberId}"]`);
  if (el && src) el.innerHTML = `<img src="${src}" alt="" class="member-avatar" />`;
}

export function renderMembersTable(members = membersCache) {
  const tbody = document.getElementById('members-tbody');
  const emptyState = document.getElementById('members-empty');
  if (!tbody) return;

  if (!members.length) {
    tbody.innerHTML = '';
    emptyState?.classList.remove('hidden');
    return;
  }

  emptyState?.classList.add('hidden');

  tbody.innerHTML = members
    .map(
      (m) => `
    <tr class="table-row" data-id="${escapeHtml(m.id)}">
      <td class="table-cell"><div class="member-avatar-placeholder" data-avatar="${escapeHtml(m.id)}">👤</div></td>
      <td class="table-cell font-medium">${escapeHtml(m.fullName)}</td>
      <td class="table-cell font-mono text-xs">${maskNationalId(m.nationalId)}</td>
      <td class="table-cell">${escapeHtml(m.phone ?? '—')}</td>
      <td class="table-cell font-mono">${escapeHtml(m.studentId)}</td>
      <td class="table-cell text-muted">${formatDate(m.registrationDate)}</td>
      <td class="table-cell">
        <div class="flex items-center gap-1">
          <button type="button" class="btn-icon" data-view-member="${escapeHtml(m.id)}" title="View CV">👁</button>
          <button type="button" class="btn-icon" data-edit-member="${escapeHtml(m.id)}" title="Edit">✎</button>
          <button type="button" class="btn-icon btn-icon-danger" data-delete-member="${escapeHtml(m.id)}" title="Delete">🗑</button>
        </div>
      </td>
    </tr>`
    )
    .join('');

  members.forEach(async (m) => {
    if (m.personalPhoto) {
      setAvatarImage(m.id, m.personalPhoto);
      return;
    }
    const url = await resolveMemberImage(m, 'personalPhoto', 'profilePhotoPath');
    if (url) setAvatarImage(m.id, url);
  });
}

export function filterMembers(searchTerm, ageFilter) {
  const term = searchTerm.toLowerCase().trim();
  return membersCache.filter((m) => {
    const matchesSearch =
      !term ||
      m.fullName?.toLowerCase().includes(term) ||
      m.studentId?.toLowerCase().includes(term) ||
      m.email?.toLowerCase().includes(term) ||
      m.phone?.includes(term);
    let matchesAge = true;
    if (ageFilter === 'under20') matchesAge = m.age < 20;
    else if (ageFilter === '20-25') matchesAge = m.age >= 20 && m.age <= 25;
    else if (ageFilter === 'over25') matchesAge = m.age > 25;
    return matchesSearch && matchesAge;
  });
}

async function openMemberCV(memberId) {
  const member = membersCache.find((m) => m.id === memberId);
  if (!member) return;

  currentCvMember = member;
  const modal = document.getElementById('member-cv-modal');
  const body = document.getElementById('member-cv-body');
  if (!modal || !body) return;

  body.innerHTML = '<div class="flex justify-center py-8"><div class="spinner"></div></div>';
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  const [profileUrl, frontUrl, backUrl] = await Promise.all([
    resolveMemberImage(member, 'personalPhoto', 'profilePhotoPath'),
    resolveMemberImage(member, 'idFront', 'idCardFrontPath'),
    resolveMemberImage(member, 'idBack', 'idCardBackPath'),
  ]);

  body.innerHTML = `
    <div class="cv-layout">
      <aside class="cv-sidebar">
        <div class="cv-photo-wrap">
          ${profileUrl ? `<img src="${profileUrl}" alt="Profile" class="cv-photo" id="cv-profile-img" />` : '<div class="cv-photo-placeholder">No Photo</div>'}
        </div>
        <h2 class="cv-name">${escapeHtml(member.fullName)}</h2>
        <p class="cv-subtitle font-mono">${escapeHtml(member.studentId)}</p>
        <div class="cv-contact">
          <p><strong>Email</strong><br>${escapeHtml(member.email ?? '—')}</p>
          <p><strong>Phone</strong><br>${escapeHtml(member.phone ?? '—')}</p>
          <p><strong>Address</strong><br>${escapeHtml(member.address ?? '—')}</p>
          <p><strong>Age</strong><br>${escapeHtml(member.age)}</p>
          <p><strong>National ID</strong><br><span class="font-mono">${escapeHtml(member.nationalId)}</span></p>
          <p><strong>Registered</strong><br>${formatDate(member.registrationDate)}</p>
        </div>
        <div class="cv-actions flex flex-col gap-2 mt-4">
          <button type="button" class="btn btn-secondary btn-sm" data-cv-export-data>📊 Export Data (Excel)</button>
          ${profileUrl ? '<button type="button" class="btn btn-secondary btn-sm" data-cv-dl-profile>⬇ Download Photo</button>' : ''}
          ${frontUrl ? '<button type="button" class="btn btn-secondary btn-sm" data-cv-dl-front>⬇ Download ID Front</button>' : ''}
          ${backUrl ? '<button type="button" class="btn btn-secondary btn-sm" data-cv-dl-back>⬇ Download ID Back</button>' : ''}
        </div>
      </aside>
      <section class="cv-main">
        <h3 class="cv-section-title">National ID Card</h3>
        <div class="cv-id-grid">
          <div class="cv-id-card">
            <p class="text-xs text-muted mb-2">Front</p>
            ${frontUrl ? `<img src="${frontUrl}" alt="ID Front" class="cv-id-img" id="cv-front-img" />` : '<div class="cv-id-placeholder">Not uploaded</div>'}
          </div>
          <div class="cv-id-card">
            <p class="text-xs text-muted mb-2">Back</p>
            ${backUrl ? `<img src="${backUrl}" alt="ID Back" class="cv-id-img" id="cv-back-img" />` : '<div class="cv-id-placeholder">Not uploaded</div>'}
          </div>
        </div>
      </section>
    </div>`;

  body.dataset.profileUrl = profileUrl ?? '';
  body.dataset.frontUrl = frontUrl ?? '';
  body.dataset.backUrl = backUrl ?? '';
}

function closeMemberCV() {
  document.getElementById('member-cv-modal')?.classList.add('hidden');
  document.getElementById('member-cv-modal')?.classList.remove('flex');
  currentCvMember = null;
}

function openEditModal(memberId) {
  const member = membersCache.find((m) => m.id === memberId);
  if (!member) return;
  const modal = document.getElementById('edit-member-modal');
  const form = document.getElementById('edit-member-form');
  if (!modal || !form) return;

  form.dataset.memberId = memberId;
  form.fullName.value = member.fullName ?? '';
  form.nationalId.value = member.nationalId ?? '';
  form.age.value = member.age ?? '';
  form.studentId.value = member.studentId ?? '';
  form.email.value = member.email ?? '';
  form.phone.value = member.phone ?? '';
  form.address.value = member.address ?? '';
  clearFormErrors(form);
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeEditModal() {
  document.getElementById('edit-member-modal')?.classList.add('hidden');
  document.getElementById('edit-member-modal')?.classList.remove('flex');
}

async function deleteMember(memberId) {
  const member = membersCache.find((m) => m.id === memberId);
  if (!member || !confirm(`Delete "${member.fullName}"?`)) return;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'members', memberId));
    if (member.studentId) batch.delete(doc(db, 'studentIds', member.studentId));
    await batch.commit();
    showToast('Member deleted.', 'success');
    await refreshMembers();
  } catch (err) {
    showToast('Delete failed.', 'error');
  }
}

async function handleEditSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const memberId = form.dataset.memberId;
  if (!memberId) return;
  clearFormErrors(form);

  const data = {
    fullName: form.fullName.value.trim(),
    nationalId: form.nationalId.value.trim(),
    age: form.age.value.trim(),
    studentId: form.studentId.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    address: form.address.value.trim(),
  };

  const errors = validateMemberForm(data, { requireContact: true });
  if (Object.keys(errors).length > 0) {
    displayFormErrors(form, errors);
    return;
  }

  const btn = form.querySelector('[type="submit"]');
  setButtonLoading(btn, true, 'Saving…');
  try {
    await updateDoc(doc(db, 'members', memberId), {
      fullName: data.fullName,
      nationalId: data.nationalId,
      age: Number(data.age),
      studentId: data.studentId,
      email: data.email,
      phone: data.phone,
      address: data.address,
    });
    showToast('Member updated.', 'success');
    closeEditModal();
    await refreshMembers();
  } catch (err) {
    showToast('Update failed.', 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

async function handleCvActions(e) {
  const body = document.getElementById('member-cv-body');
  if (!currentCvMember) return;

  if (e.target.closest('[data-cv-export-data]')) {
    exportMemberData(currentCvMember);
    showToast('Data exported.', 'success');
    return;
  }
  if (e.target.closest('[data-cv-dl-profile]')) {
    const ok = await downloadImageFromUrl(body.dataset.profileUrl, `${currentCvMember.studentId}_photo.jpg`);
    showToast(ok ? 'Photo downloaded.' : 'Download failed.', ok ? 'success' : 'error');
  }
  if (e.target.closest('[data-cv-dl-front]')) {
    const ok = await downloadImageFromUrl(body.dataset.frontUrl, `${currentCvMember.studentId}_id_front.jpg`);
    showToast(ok ? 'Downloaded.' : 'Download failed.', ok ? 'success' : 'error');
  }
  if (e.target.closest('[data-cv-dl-back]')) {
    const ok = await downloadImageFromUrl(body.dataset.backUrl, `${currentCvMember.studentId}_id_back.jpg`);
    showToast(ok ? 'Downloaded.' : 'Download failed.', ok ? 'success' : 'error');
  }
}

export async function refreshMembers() {
  await fetchMembers();
  const searchInput = document.getElementById('member-search');
  const ageFilter = document.getElementById('member-age-filter');
  renderMembersTable(filterMembers(searchInput?.value ?? '', ageFilter?.value ?? 'all'));
  return membersCache;
}

export function initMembersTab() {
  const searchInput = document.getElementById('member-search');
  const ageFilter = document.getElementById('member-age-filter');
  const tbody = document.getElementById('members-tbody');

  const applyFilters = debounce(() => {
    renderMembersTable(filterMembers(searchInput?.value ?? '', ageFilter?.value ?? 'all'));
  }, 200);

  searchInput?.addEventListener('input', applyFilters);
  ageFilter?.addEventListener('change', applyFilters);

  tbody?.addEventListener('click', (e) => {
    if (e.target.closest('[data-view-member]')) openMemberCV(e.target.closest('[data-view-member]').dataset.viewMember);
    if (e.target.closest('[data-edit-member]')) openEditModal(e.target.closest('[data-edit-member]').dataset.editMember);
    if (e.target.closest('[data-delete-member]')) deleteMember(e.target.closest('[data-delete-member]').dataset.deleteMember);
  });

  document.getElementById('edit-member-form')?.addEventListener('submit', handleEditSubmit);
  document.getElementById('export-all-members')?.addEventListener('click', () => {
    exportAllMembers(membersCache);
    showToast('All members exported.', 'success');
  });

  document.querySelectorAll('[data-close-edit-modal]').forEach((b) => b.addEventListener('click', closeEditModal));
  document.querySelectorAll('[data-close-cv-modal]').forEach((b) => b.addEventListener('click', closeMemberCV));
  document.getElementById('edit-member-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'edit-member-modal') closeEditModal();
  });
  document.getElementById('member-cv-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'member-cv-modal') closeMemberCV();
    handleCvActions(e);
  });
}

export function getMembersCache() {
  return membersCache;
}
