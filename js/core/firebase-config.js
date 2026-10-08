// Estos valores públicos se copian de la configuración de la app web en Firebase Console.
export const firebaseConfig = {
  apiKey: 'AIzaSyAV91W6fj-GpEJcYeLRpgOCWjlZvqkJeD4',
  authDomain: 'cyberstriker-3d.firebaseapp.com',
  // Se deja vacío hasta que se cree una Realtime Database.
  databaseURL: '',
  projectId: 'cyberstriker-3d',
  appId: '1:568506075155:web:ea5860ffae988e054157e6',
};
export const firebaseReady = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);
