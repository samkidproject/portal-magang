import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore,
  initializeFirestore, 
  memoryLocalCache 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import appletConfig from '../firebase-applet-config.json';

// Support Vercel/External env variables with fallback to AI Studio config
const metaEnv = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || appletConfig.appId,
  measurementId: metaEnv.VITE_FIREBASE_MEASUREMENT_ID || appletConfig.measurementId,
};

// Use globalThis to persist app, auth, db, and storage across hot module reloads (HMR)
const globalForFirebase = globalThis as unknown as {
  app?: any;
  auth?: any;
  db?: any;
  storage?: any;
};

export const app = globalForFirebase.app || (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp());
if (!globalForFirebase.app) {
  globalForFirebase.app = app;
}

// Initialize Auth
export const auth = globalForFirebase.auth || getAuth(app);
if (!globalForFirebase.auth) {
  globalForFirebase.auth = auth;
}

// Initialize Firestore stably using memory local cache to prevent IndexedDB tab lock collision assertion errors within iframe sandboxes
export const db = globalForFirebase.db || (() => {
  // Check if Firestore provider has already been initialized internally to prevent "Unexpected state (ID: 3f0d)" assertion failures
  const isInitialized = (() => {
    try {
      const provider = (app as any)?.container?.getProvider?.('firestore');
      if (provider?.isInitialized?.()) {
        return true;
      }
    } catch (e) {}
    return false;
  })();

  if (isInitialized) {
    try {
      return getFirestore(app);
    } catch (e) {
      console.warn('Failed to retrieve existing initialized firestore instance, falling back:', e);
    }
  }

  try {
    // Attempt to initialize with memory local cache first to bypass IndexedDB sandbox locks
    return initializeFirestore(app, {
      localCache: memoryLocalCache()
    });
  } catch (e: any) {
    console.warn('Firestore already initialized or memory cache failed, retrieving existing instance:', e);
    try {
      return getFirestore(app);
    } catch (getErr) {
      console.error('Failed to retrieve or initialize firestore:', getErr);
      throw getErr;
    }
  }
})();
if (!globalForFirebase.db) {
  globalForFirebase.db = db;
}

// Initialize Storage
export const storage = globalForFirebase.storage || getStorage(app);
if (!globalForFirebase.storage) {
  globalForFirebase.storage = storage;
}

// Auth Provider
export const googleProvider = new GoogleAuthProvider();
// Prompt user to select account when logging in
googleProvider.setCustomParameters({
  prompt: 'select_account'
});


