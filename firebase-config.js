const admin = require('firebase-admin');
const path = require('path');

// Firebase 설정 초기화
let firebaseApp = null;

function initializeFirebase() {
    if (firebaseApp) {
        return firebaseApp;
    }

    try {
        // 환경변수에서 Firebase 설정 정보 가져오기
        const serviceAccount = {
            type: "service_account",
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
        };

        // Firebase Admin SDK 초기화
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET
        });

        console.log('Firebase initialized successfully');
        return firebaseApp;

    } catch (error) {
        console.error('Firebase initialization error:', error);
        throw error;
    }
}

// Firebase Storage 인스턴스 가져오기
function getFirebaseStorage() {
    const app = initializeFirebase();
    return admin.storage(app);
}

// Firebase Storage 버킷 가져오기
function getStorageBucket() {
    const storage = getFirebaseStorage();
    return storage.bucket();
}

module.exports = {
    initializeFirebase,
    getFirebaseStorage,
    getStorageBucket
}; 