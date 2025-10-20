// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyBKSEoZyaLYRftuzfzn8H68SA6HM1qvOOk",
  authDomain: "attendance-app-92ed7.firebaseapp.com",
  projectId: "attendance-app-92ed7",
  storageBucket: "attendance-app-92ed7.firebasestorage.app",
  messagingSenderId: "496141456787",
  appId: "1:496141456787:web:619ed98d03d2af6ed7c466",
  measurementId: "G-R4LS82TCTC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
