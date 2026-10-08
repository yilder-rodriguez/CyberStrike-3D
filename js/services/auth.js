// Auth cloud cuando Firebase está configurado; PBKDF2 local durante desarrollo sin backend.
import { db } from './db.js';
import { firebaseReady } from '../core/firebase-config.js';
import { getFirebase } from '../core/firebase.js';
import { DATA_POLICY_VERSION } from './privacy.js';
const enc = new TextEncoder(),
  validName = (s) => /^[\p{L}\p{N}_]{3,18}$/u.test(s.trim()),
  b64 = (a) => btoa(String.fromCharCode(...a));
async function hash(p, s) {
  let k = await crypto.subtle.importKey('raw', enc.encode(p), 'PBKDF2', false, ['deriveBits']),
    b = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
        iterations: 210000,
        hash: 'SHA-256',
      },
      k,
      256,
    );
  return b64(new Uint8Array(b));
}
const fresh = (n) => ({
    uid: db.newId(),
    username: n,
    role: 'jugador',
    createdAt: new Date().toISOString(),
    level: 0,
    xp: 0,
    rankPoints: 0,
    matchesLost: 0,
    coins: Number(localStorage.getItem('cyber_coins') || 0),
    gems: 0,
    inventory: [
      'skin_emerald',
      'gun_green',
      ...JSON.parse(localStorage.getItem('cyber_owned_skins') || '[]'),
    ],
    collection: ['skin_emerald', 'gun_green'].map((itemId) => ({
      itemId,
      source: 'starter',
      acquiredAt: new Date().toISOString(),
    })),
    equipped: { skin: 'skin_emerald', weapon: 'gun_green' },
    settings: {
      quality: 'auto',
      music: true,
      sfx: true,
      sensitivity: 1,
      language: 'es',
      reducedEffects: false,
    },
  }),
  safe = ({ passwordHash, passwordSalt, ...u }) => u,
  emailFor = (n) => n.toLowerCase() + '@players.cyberstriker.invalid';
export const auth = {
  async register({ username, password, confirm, acceptedDataPolicy }) {
    username = username.trim().normalize('NFKC');
    if (!validName(username)) throw Error('Nombre: 3–18 letras, números o guion bajo.');
    if (password.length < 8) throw Error('Usa una contraseña de mínimo 8 caracteres.');
    if (password !== confirm) throw Error('Las contraseñas no coinciden.');
    if (acceptedDataPolicy !== true)
      throw Error('Debes leer y aceptar la política de tratamiento de datos para crear la cuenta.');
    const consent = {
      dataConsentVersion: DATA_POLICY_VERSION,
      dataConsentAt: new Date().toISOString(),
    };
    if (firebaseReady) {
      let f = await getFirebase(),
        s = f.authSdk,
        mail = emailFor(username),
        cr = await s.createUserWithEmailAndPassword(f.auth, mail, password),
        u = {
          ...fresh(username),
          ...consent,
          uid: cr.user.uid,
          coins: 0,
          gems: 0,
          inventory: ['skin_emerald', 'gun_green'],
        };
      try {
        await db.claimUsername(username, u.uid, mail, u);
      } catch (err) {
        await s.deleteUser(cr.user);
        throw err;
      }
      return u;
    }
    let salt = b64(crypto.getRandomValues(new Uint8Array(16))),
      u = {
        ...fresh(username),
        ...consent,
        passwordSalt: salt,
        passwordHash: await hash(password, salt),
      };
    await db.createLocalUser(u);
    await db.setLocalSession({ uid: u.uid, username: u.username, role: u.role }, true);
    return safe(u);
  },
  async login({ username, password, remember = true }) {
    username = username.trim();
    if (firebaseReady) {
      let f = await getFirebase(),
        s = f.authSdk,
        record = await db.usernameRecord(username);
      if (!record) throw Error('No encontramos ese nombre de jugador.');
      await s.setPersistence(
        f.auth,
        remember ? s.browserLocalPersistence : s.browserSessionPersistence,
      );
      let cr = await s.signInWithEmailAndPassword(f.auth, record.email, password),
        profile = await db.cloudProfile(cr.user.uid);
      if (!profile) throw Error('La cuenta no tiene perfil asociado.');
      let claims = await cr.user.getIdTokenResult(true);
      const currentUser = {
        ...profile,
        role: claims.claims.role || 'jugador',
        permissions: Array.isArray(claims.claims.permissions) ? claims.claims.permissions : [],
      };
      await db.syncPublicProfile(currentUser).catch(() => {});
      await db.startPresence(currentUser).catch(() => {});
      return currentUser;
    }
    let u = await db.getLocalUser(username);
    if (!u)
      throw Error('Cuenta no encontrada en este dispositivo. Regístrate o configura Firebase.');
    if ((await hash(password, u.passwordSalt)) !== u.passwordHash)
      throw Error('La contraseña no coincide.');
    await db.setLocalSession({ uid: u.uid, username: u.username, role: u.role }, remember);
    return safe(u);
  },
  async current() {
    if (firebaseReady) {
      let f = await getFirebase();
      await f.auth.authStateReady();
      let u = f.auth.currentUser;
      if (!u) return null;
      let profile = await db.cloudProfile(u.uid);
      if (!profile) return null;
      let claims = await u.getIdTokenResult();
      const currentUser = {
        ...profile,
        role: claims.claims.role || 'jugador',
        permissions: Array.isArray(claims.claims.permissions) ? claims.claims.permissions : [],
      };
      await db.syncPublicProfile(currentUser).catch(() => {});
      await db.startPresence(currentUser).catch(() => {});
      return currentUser;
    }
    let s = await db.getLocalSession(),
      u = s && (await db.getLocalUser(s.username));
    if (!u) return null;
    const currentUser = safe(u);
    await db.startPresence(currentUser).catch(() => {});
    return currentUser;
  },
  async signOut() {
    if (firebaseReady) {
      let f = await getFirebase();
      await f.authSdk.signOut(f.auth);
    }
    await db.clearSession();
  },
  async updateProfile(u) {
    await db.saveProfile(u);
    return u;
  },
  async acceptDataPolicy(user) {
    const consent = {
      dataConsentVersion: DATA_POLICY_VERSION,
      dataConsentAt: new Date().toISOString(),
    };
    await db.saveDataConsent(user.uid, consent);
    return { ...user, ...consent };
  },
};
