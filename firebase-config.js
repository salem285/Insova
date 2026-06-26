/**
 * Firebase Configuration & Initialization
 * ----------------------------------------
 * Replace the placeholder values below with your Firebase project credentials.
 * Find them in: Firebase Console → Project Settings → General → Your apps
 *
 * Security note: Firebase API keys are safe to expose in client-side code when
 * Firestore Security Rules and Auth are properly configured on the server side.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';

/** @type {import('firebase/app').FirebaseOptions} */
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDRaiTeATs2eJjnR1ehxigI8fWqnjeXmew",
  authDomain: "team-mangement-25c8d.firebaseapp.com",
  projectId: "team-mangement-25c8d",
  storageBucket: "team-mangement-25c8d.firebasestorage.app",
  messagingSenderId: "226908946731",
  appId: "1:226908946731:web:d210c06d5eaf8966efc56e",
  measurementId: "G-CCWYDC56W1"
};

// Export the config so it can be used across the app



const app = initializeApp(firebaseConfig);

/** Firebase Authentication instance */
export const auth = getAuth(app);

/** Cloud Firestore database instance */
export const db = getFirestore(app);

/** Firebase Storage instance */
export const storage = getStorage(app);

export default app;
