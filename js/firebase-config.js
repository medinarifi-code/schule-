// ============================================================
//  HIER DEINE FIREBASE-DATEN EINTRAGEN (siehe README.md)
// ============================================================
// Firebase-Konsole → Projekteinstellungen → "Meine Apps" → Web-App → Konfiguration
export const firebaseConfig = {
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCzeSMFz3efKY4odqj1jEpmMMkC1IM-16U",
  authDomain: "schule-c9c4f.firebaseapp.com",
  projectId: "schule-c9c4f",
  storageBucket: "schule-c9c4f.firebasestorage.app",
  messagingSenderId: "65582972806",
  appId: "1:65582972806:web:b2c06b73771a45fe13f607",
  measurementId: "G-P3GEG2FDWB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
};

// E-Mail-Adresse des Admin-Kontos (muss auch in firestore.rules stehen!)
export const ADMIN_EMAIL = medinarifi@icloud.com
  ;
