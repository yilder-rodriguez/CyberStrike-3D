// Semilla privada inicial. Ejecutar en un entorno seguro; nunca publicar credenciales ni subirlas al repo.
const admin = require('firebase-admin');
const { stdin, stdout } = require('node:process');
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: process.env.GCLOUD_PROJECT,
});
const auth = admin.auth(),
  db = admin.firestore();
(async () => {
  const password = await hiddenPassword('Contraseña inicial para yiyo (mínimo 12 caracteres): ');
  if (password.length < 12) throw new Error('Usa una contraseña de al menos 12 caracteres.');
  const username = 'yiyo',
    email = username + '@players.cyberstriker.invalid';
  const claim = db.collection('usernames').doc(username);
  let record;
  let accountAlreadyExisted = false;
  try {
    record = await auth.getUserByEmail(email);
    accountAlreadyExisted = true;
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    if ((await claim.get()).exists) {
      throw new Error('El nombre yiyo ya está reservado en perfiles. Revisa la cuenta desde el Firebase Console antes de sembrar.');
    }
    record = await auth.createUser({ email, password, displayName: username });
  }
  const profile = db.collection('users').doc(record.uid);
  if (accountAlreadyExisted) {
    const [existingClaim, existingProfile] = await Promise.all([claim.get(), profile.get()]);
    const isPreviouslySeeded =
      existingClaim.exists && existingClaim.data().uid === record.uid &&
      (record.customClaims?.role === 'admin' || existingProfile.data()?.role === 'admin');
    if (!isPreviouslySeeded) {
      throw new Error('La cuenta o el nombre yiyo ya existían y no son un administrador raíz. Por seguridad, la semilla no toma una cuenta de jugador.');
    }
  }
  await db.runTransaction(async (tx) => {
    const [existingClaim, existingProfile] = await Promise.all([tx.get(claim), tx.get(profile)]);
    if (existingClaim.exists && existingClaim.data().uid !== record.uid) {
      throw new Error('El nombre yiyo ya pertenece a otra cuenta. No se modificó su perfil.');
    }
    tx.set(claim, { uid: record.uid, username, email });
    if (existingProfile.exists) {
      tx.set(profile, { role: 'admin', permissions: ['*'] }, { merge: true });
    } else {
      tx.set(profile, {
        uid: record.uid,
        username,
        role: 'admin',
        permissions: ['*'],
        createdAt: new Date().toISOString(),
        level: 0,
        xp: 0,
        rankPoints: 0,
        coins: 0,
        gems: 0,
        inventory: ['skin_emerald', 'gun_green'],
        collection: [],
        settings: {
          quality: 'auto',
          music: true,
          sfx: true,
          sensitivity: 1,
          language: 'es',
          reducedEffects: false,
        },
      });
    }
  });
  // Repetir la semilla cambia la contraseña, pero nunca reinicia el progreso existente.
  await auth.updateUser(record.uid, { password, displayName: username });
  await auth.setCustomUserClaims(record.uid, { role: 'admin', permissions: ['*'] });
  console.log('Administrador raíz listo. Inicia sesión y activa la verificación en dos pasos en la cuenta propietaria del proyecto.');
  process.exit(0);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function hiddenPassword(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Ejecuta este comando en una terminal interactiva para ocultar la contraseña.');
  }
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  let value = '';
  try {
    for await (const chunk of stdin) {
      for (const char of chunk) {
        if (char === '\u0003') throw new Error('Operación cancelada.');
        if (char === '\r' || char === '\n') {
          stdout.write('\n');
          return value;
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    }
    return value;
  } finally {
    stdin.setRawMode(false);
  }
}
