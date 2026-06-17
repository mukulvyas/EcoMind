import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase only if config exists
let app;
let auth;
let googleProvider;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
} catch (error) {
  console.warn("Firebase not fully configured yet.", error);
}

export { auth, googleProvider, onAuthStateChanged };

export const signInWithGoogle = async () => {
  if (!auth) throw new Error("Firebase auth not initialized");
  return await signInWithPopup(auth, googleProvider);
};

export const signOut = async () => {
  if (!auth) throw new Error("Firebase auth not initialized");
  return await firebaseSignOut(auth);
};
