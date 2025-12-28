// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDSWJklvg1y4ZTMFTxAoKx3GNAOoSJFONU",
  authDomain: "wholesale-tracker-27034.firebaseapp.com",
  projectId: "wholesale-tracker-27034",
  storageBucket: "wholesale-tracker-27034.firebasestorage.app",
  messagingSenderId: "555830672864",
  appId: "1:555830672864:web:87447f682a6c4f542d3f85"
};

// Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);