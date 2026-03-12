import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBEEwVg9EwgqvdLmv-eg19akt5lXAUqSdk",
  authDomain: "neuralflavor.firebaseapp.com",
  projectId: "neuralflavor",
  storageBucket: "neuralflavor.firebasestorage.app",
  messagingSenderId: "793952773208",
  appId: "1:793952773208:web:9ddc2e11f44a8b7297d62d",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
