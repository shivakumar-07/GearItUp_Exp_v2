import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// Firebase config — fill these from Firebase Console → Project Settings → Your Apps → Web App
// Steps:
//  1. Go to console.firebase.google.com
//  2. Create project "autospace-prod"
//  3. Enable Authentication → Sign-in methods → Phone + Google
//  4. Add Web App → copy config below
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
};

const requiredFirebaseEnv = [
  ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
];

export const missingFirebaseEnvVars = requiredFirebaseEnv
  .filter(([, value]) => !value)
  .map(([name]) => name);

// Check if Firebase is configured
const isFirebaseConfigured = missingFirebaseEnvVars.length === 0;

let app, auth;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} else {
  console.warn('[Firebase] Not configured — running in dev mode. OTP will be simulated.');
  auth = null;
}

export { auth, isFirebaseConfigured };

// Phone auth: send OTP
export async function sendPhoneOtp(phone, recaptchaContainerId) {
  if (!isFirebaseConfigured) {
    // Dev mode: simulate OTP sent
    console.log(`[DEV] OTP sent to ${phone} — use any 6-digit code`);
    return { verificationId: `dev:${phone}`, dev: true };
  }
  const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' });
  const result = await signInWithPhoneNumber(auth, `+91${phone}`, verifier);
  return result;
}

// Phone auth: verify OTP and get Firebase token
export async function verifyPhoneOtp(confirmationResult, otp) {
  if (confirmationResult.dev) {
    // Dev mode: return a dev token
    const phone = confirmationResult.verificationId.replace('dev:', '');
    return { token: `dev:${phone}`, dev: true };
  }
  const result = await confirmationResult.confirm(otp);
  const token = await result.user.getIdToken();
  return { token };
}

// Google Sign-In and get Firebase token
export async function signInWithGoogle() {
  if (!isFirebaseConfigured) {
    return { token: 'dev-google:demo@autospace.in', dev: true };
  }
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const token = await result.user.getIdToken();
  return { token, user: result.user };
}
