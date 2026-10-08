// Emparejamiento liviano por modo/mapa con Firebase RTDB; desconectados se retiran automáticamente.
import { getFirebase } from '../core/firebase.js';
import { firebaseConfig, firebaseReady } from '../core/firebase-config.js';
export async function joinMatch({ user, mode, mapId, onRoster }) {
  if (!firebaseReady || !firebaseConfig.databaseURL)
    throw Error('Configura Realtime Database para activar rivales en línea.');
  const f = await getFirebase(),
    sdk = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js'),
    database = sdk.getDatabase(f.app, firebaseConfig.databaseURL),
    room = sdk.ref(database, 'matches/' + mode + '-' + mapId + '/players'),
    self = sdk.child(room, user.uid),
    initial = {
      uid: user.uid,
      username: user.username,
      mode,
      map: mapId,
      x: 0,
      y: 0,
      z: 0,
      rotation: 0,
      health: 100,
      updatedAt: Date.now(),
    };
  await sdk.set(self, initial);
  const leave = sdk.onDisconnect(self);
  leave.remove();
  const unsubscribe = sdk.onValue(room, (snap) => {
    const roster = snap.val() || {};
    delete roster[user.uid];
    onRoster(roster);
  });
  return {
    publish: (data) => sdk.update(self, { ...data, updatedAt: Date.now() }),
    fire: (shot) =>
      sdk.update(self, {
        lastShot: { ...shot, id: crypto.randomUUID?.() || String(Date.now()), at: Date.now() },
      }),
    close: async () => {
      unsubscribe();
      try {
        await leave.cancel();
        await sdk.remove(self);
      } catch {}
    },
  };
}
