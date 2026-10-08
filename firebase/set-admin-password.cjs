// Cambia la contraseña de yiyo en Firebase Auth sin guardarla en el repositorio.
const admin = require('firebase-admin');
const { stdin, stdout } = require('node:process');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: process.env.GCLOUD_PROJECT,
});

(async () => {
  const password = await hiddenPassword('Nueva contraseña de yiyo (mínimo 12 caracteres): ');
  if (password.length < 12) throw new Error('Usa al menos 12 caracteres.');
  const user = await admin.auth().getUserByEmail('yiyo@players.cyberstriker.invalid');
  const profile = await admin.firestore().collection('users').doc(user.uid).get();
  if (user.customClaims?.role !== 'admin' || profile.data()?.role !== 'admin') {
    throw new Error('La cuenta yiyo no está inicializada como admin. Ejecuta primero seed-admin.');
  }
  await admin.auth().updateUser(user.uid, { password });
  await admin.auth().revokeRefreshTokens(user.uid);
  console.log('Contraseña actualizada y sesiones anteriores revocadas.');
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
