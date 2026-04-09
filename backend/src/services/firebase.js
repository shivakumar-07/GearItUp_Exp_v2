import { config } from 'dotenv';
config({ override: true });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let firebaseInitialized = false;

function createAuthError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function initFirebase() {
  if (firebaseInitialized || getApps().length > 0) return;

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    firebaseInitialized = true;
    console.log('[Firebase] Admin SDK initialized');
  } else {
    console.log('[Firebase] Running in dev mode — Firebase credentials not set, token verification bypassed');
  }
}

// Verify a Firebase ID token and return decoded claims
export async function verifyFirebaseToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw createAuthError('firebaseToken is required', 400, 'MISSING_TOKEN');
  }

  initFirebase();

  const isDevToken = idToken.startsWith('dev:') || idToken.startsWith('dev-google:');

  if (firebaseInitialized && isDevToken) {
    throw createAuthError(
      'Frontend Firebase web config is missing or invalid. Configure VITE_FIREBASE_* variables and sign in again.',
      400,
      'DEV_TOKEN_NOT_ALLOWED'
    );
  }

  // Dev mode bypass: if no Firebase credentials, accept a dev token format
  // Dev token format: "dev:<phone>" or "dev-google:<email>"
  if (!firebaseInitialized) {
    if (idToken.startsWith('dev:')) {
      const phone = idToken.replace('dev:', '').trim();
      return { uid: `dev_${phone}`, phone_number: `+91${phone}`, provider: 'phone' };
    }
    if (idToken.startsWith('dev-google:')) {
      const email = idToken.replace('dev-google:', '').trim();
      return { uid: `dev_google_${email}`, email, name: 'Dev User', provider: 'google' };
    }
    throw createAuthError(
      'Development mode token required. Use "dev:<phone>" or "dev-google:<email>" for local testing.',
      401,
      'DEV_TOKEN_REQUIRED'
    );
  }

  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const provider = decoded.firebase?.sign_in_provider || 'phone';
    return {
      uid: decoded.uid,
      phone_number: decoded.phone_number,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      provider: provider === 'google.com' ? 'google' : 'phone',
    };
  } catch (err) {
    throw createAuthError(
      'Invalid Firebase ID token. Sign in again and ensure frontend/backend use the same Firebase project.',
      401,
      'INVALID_FIREBASE_ID_TOKEN'
    );
  }
}
