/**
 * Public member registration with photos and contact info
 */

import {
  doc,
  writeBatch,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import {
  validateMemberForm,
  displayFormErrors,
  clearFormErrors,
  showToast,
  setButtonLoading,
} from './utils.js';
import {
  validateImageFile,
  previewImageFile,
  fileToBase64DataUrl,
  MAX_FIRESTORE_IMAGE_SIZE,
} from './storage.js';

const form = document.getElementById('registration-form');
const submitBtn = document.getElementById('submit-btn');

function getRegistrationErrorMessage(err) {
  if (err?.code === 'permission-denied') {
    return 'This National ID or Student ID is already registered.';
  }
  if (err?.message?.includes('longer than')) {
    return 'Images are too large for storage. Use smaller photos (under 400 KB each).';
  }
  return 'Registration failed. Please try again later.';
}

function validateFiles(formEl) {
  const errors = {};
  const personalPhoto = formEl.querySelector('#personalPhoto')?.files?.[0];
  const idFront = formEl.querySelector('#idFront')?.files?.[0];
  const idBack = formEl.querySelector('#idBack')?.files?.[0];

  const personalPhotoErr = validateImageFile(personalPhoto, 'Profile photo', MAX_FIRESTORE_IMAGE_SIZE);
  const idFrontErr = validateImageFile(idFront, 'ID card (front)', MAX_FIRESTORE_IMAGE_SIZE);
  const idBackErr = validateImageFile(idBack, 'ID card (back)', MAX_FIRESTORE_IMAGE_SIZE);

  if (personalPhotoErr) errors.personalPhoto = personalPhotoErr;
  if (idFrontErr) errors.idFront = idFrontErr;
  if (idBackErr) errors.idBack = idBackErr;

  return errors;
}

async function encodeRegistrationImages(formEl) {
  const personalPhotoFile = formEl.querySelector('#personalPhoto').files[0];
  const idFrontFile = formEl.querySelector('#idFront').files[0];
  const idBackFile = formEl.querySelector('#idBack').files[0];

  const [personalPhoto, idFront, idBack] = await Promise.all([
    fileToBase64DataUrl(personalPhotoFile),
    fileToBase64DataUrl(idFrontFile),
    fileToBase64DataUrl(idBackFile),
  ]);

  return { personalPhoto, idFront, idBack };
}

[
  ['personalPhoto', 'preview-profile'],
  ['idFront', 'preview-id-front'],
  ['idBack', 'preview-id-back'],
].forEach(([inputId, imgId]) => {
  document.getElementById(inputId)?.addEventListener('change', (e) => {
    previewImageFile(e.target, document.getElementById(imgId));
  });
});

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFormErrors(form);

  const formData = new FormData(form);
  const data = {
    fullName: formData.get('fullName')?.toString().trim() ?? '',
    nationalId: formData.get('nationalId')?.toString().trim() ?? '',
    age: formData.get('age')?.toString().trim() ?? '',
    studentId: formData.get('studentId')?.toString().trim() ?? '',
    email: formData.get('email')?.toString().trim() ?? '',
    phone: formData.get('phone')?.toString().trim() ?? '',
    address: formData.get('address')?.toString().trim() ?? '',
  };

  const fileErrors = validateFiles(form);
  const errors = { ...validateMemberForm(data, { requireContact: true }), ...fileErrors };

  if (Object.keys(errors).length > 0) {
    displayFormErrors(form, errors);
    Object.entries(fileErrors).forEach(([field, msg]) => {
      const el = form.querySelector(`[data-error-for="${field}"]`);
      if (el) { el.textContent = msg; el.classList.remove('hidden'); }
    });
    showToast('Please fix the highlighted errors.', 'error');
    return;
  }

  setButtonLoading(submitBtn, true, 'Registering…');

  try {
    const { personalPhoto, idFront, idBack } = await encodeRegistrationImages(form);

    const batch = writeBatch(db);
    batch.set(doc(db, 'members', data.nationalId), {
      fullName: data.fullName,
      nationalId: data.nationalId,
      age: Number(data.age),
      studentId: data.studentId,
      email: data.email,
      phone: data.phone,
      address: data.address,
      personalPhoto,
      idFront,
      idBack,
      registrationDate: serverTimestamp(),
    });

    batch.set(doc(db, 'studentIds', data.studentId), {
      memberId: data.nationalId,
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    form.reset();
    ['preview-profile', 'preview-id-front', 'preview-id-back'].forEach((id) => {
      const img = document.getElementById(id);
      if (img) {
        img.src = '';
        img.classList.add('hidden');
      }
    });
    showToast('Registration successful! Welcome to the team.', 'success');
  } catch (err) {
    console.error('Registration error:', err);
    showToast(getRegistrationErrorMessage(err), 'error');
  } finally {
    setButtonLoading(submitBtn, false);
  }
});

document.getElementById('nationalId')?.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 14);
});

document.getElementById('phone')?.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^\d+\-\s]/g, '').slice(0, 20);
});
