const firebaseConfig = {
  apiKey:            "AIzaSyDOVu-RQfzfShmZe8fV7Sw7TShP6zScYQQ",
  authDomain:        "good-food-3cc91.firebaseapp.com",
  projectId:         "good-food-3cc91",
  storageBucket:     "good-food-3cc91.firebasestorage.app",
  messagingSenderId: "848994614302",
  appId:             "1:848994614302:web:0fa56aef4e86afadbdc20f",
  measurementId:     "G-NZSGDBYPSN"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
