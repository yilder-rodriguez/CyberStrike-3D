// Inicialización única de Firebase Web SDK; la configuración vive en firebase-config.js.
import { firebaseConfig, firebaseReady } from './firebase-config.js';
let promise;
export async function getFirebase() {
  if (!firebaseReady) return null;
  if (!promise)
    promise = (async () => {
      const appSdk = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js'),
        authSdk = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js'),
        dbSdk = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js'),
        app = appSdk.initializeApp(firebaseConfig);
      return { app, auth: authSdk.getAuth(app), authSdk, db: dbSdk.getFirestore(app), dbSdk };
    })();
  return promise;
}
