const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const auth = getAuth();
const db = getFirestore();
const PERMISSIONS = [
  'players.read', 'roles.assign', 'codes.read', 'codes.manage', 'economy.gift',
  'content.manage', 'season.manage',
];
const BASE_ROLES = {
  jugador: { name: 'Jugador', permissions: [] },
  moderador: { name: 'Moderador', permissions: ['players.read'] },
  admin: { name: 'Administrador', permissions: ['*'] },
};
const hasPermission = (request, permission) =>
  request.auth?.token?.role === 'admin' ||
  request.auth?.token?.permissions?.includes('*') ||
  request.auth?.token?.permissions?.includes(permission);
const requirePermission = (request, permission) => {
  if (!hasPermission(request, permission)) {
    throw new HttpsError('permission-denied', `Falta el permiso ${permission}.`);
  }
};

function elapsedSeasonNumber(config, now) {
  const forced = config.currentSeason;
  const anchor = new Date(forced?.startsAt || config.startsAt || '2026-10-07T00:00:00-05:00');
  const baseNumber = Number(forced?.number) || 1;
  if (config.type === 'month') {
    let cursor = new Date(anchor);
    let number = baseNumber;
    for (let count = 0; count < 1200; count += 1) {
      const next = new Date(cursor);
      const day = next.getUTCDate();
      next.setUTCDate(1);
      next.setUTCMonth(next.getUTCMonth() + 1);
      const lastDay = new Date(
        Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
      ).getUTCDate();
      next.setUTCDate(Math.min(day, lastDay));
      if (now < next) break;
      cursor = next;
      number += 1;
    }
    return number;
  }
  const duration = Math.max(1, Number(config.days) || 15) * 86400000;
  return baseNumber + Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / duration));
}

// El cambio de rol ocurre fuera del navegador y actualiza los claims que exigen las reglas.
exports.adminSetRole = onCall(async (request) => {
  requirePermission(request, 'roles.assign');
  const { uid, role } = request.data || {};
  if (typeof uid !== 'string' || typeof role !== 'string' || !/^[a-z][a-z0-9_-]{1,31}$/.test(role)) {
    throw new HttpsError('invalid-argument', 'UID o rol no válido.');
  }
  if (uid === request.auth.uid)
    throw new HttpsError('failed-precondition', 'No puedes cambiar tu propio rol.');
  if (role === 'admin' && request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo el administrador raíz puede asignar el rol admin.');
  }
  let target;
  try {
    target = await auth.getUser(uid);
  } catch {
    throw new HttpsError('not-found', 'No encontramos esa cuenta.');
  }
  if (target.customClaims?.role === 'admin' && request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo el administrador raíz puede modificar otra cuenta raíz.');
  }
  let roleConfig = BASE_ROLES[role];
  if (!roleConfig) {
    const roleSnapshot = await db.collection('roles').doc(role).get();
    if (!roleSnapshot.exists) throw new HttpsError('not-found', 'Ese rol no existe.');
    roleConfig = roleSnapshot.data();
  }
  const claims = { ...(target.customClaims || {}), role, permissions: roleConfig.permissions || [] };
  await auth.setCustomUserClaims(uid, claims);
  await db.collection('users').doc(uid).set({ role, permissions: roleConfig.permissions || [] }, { merge: true });
  return { uid, role, permissions: roleConfig.permissions || [] };
});

// Consulta segura: el directorio nunca entrega datos privados del documento de cuenta.
exports.adminListPlayers = onCall(async (request) => {
  requirePermission(request, 'players.read');
  const snapshot = await db.collection('users').get();
  return {
    players: snapshot.docs.map((entry) => {
      const user = entry.data();
      return {
        uid: entry.id,
        username: String(user.username || 'Sin nombre'),
        role: String(user.role || 'jugador'),
        level: Number(user.level) || 0,
        rankPoints: Number(user.rankPoints) || 0,
        coins: Number(user.coins) || 0,
        gems: Number(user.gems) || 0,
        createdAt: user.createdAt || null,
        lastSeenAt: Number(user.lastSeenAt) || null,
      };
    }),
  };
});

exports.adminListRoles = onCall(async (request) => {
  requirePermission(request, 'roles.assign');
  const custom = await db.collection('roles').get();
  return { roles: [
    ...Object.entries(BASE_ROLES).map(([id, role]) => ({ id, ...role, fixed: true })),
    ...custom.docs.map((entry) => ({ id: entry.id, ...entry.data(), fixed: false })),
  ] };
});

exports.adminSaveRole = onCall(async (request) => {
  if (request.auth?.token?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo el administrador raíz puede crear roles.');
  }
  const { id, name, permissions } = request.data || {};
  if (typeof id !== 'string' || !/^[a-z][a-z0-9_-]{1,31}$/.test(id) || BASE_ROLES[id]) {
    throw new HttpsError('invalid-argument', 'El identificador de rol no es válido o está reservado.');
  }
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 32 || !Array.isArray(permissions)) {
    throw new HttpsError('invalid-argument', 'Revisa el nombre y los permisos del rol.');
  }
  const safePermissions = [...new Set(permissions)];
  if (safePermissions.length > PERMISSIONS.length || safePermissions.some((permission) => !PERMISSIONS.includes(permission))) {
    throw new HttpsError('invalid-argument', 'El rol incluye permisos no reconocidos.');
  }
  if (
    (safePermissions.includes('economy.gift') && !safePermissions.includes('players.read')) ||
    (safePermissions.includes('roles.assign') && !safePermissions.includes('players.read')) ||
    (safePermissions.includes('codes.manage') && !safePermissions.includes('codes.read'))
  ) {
    throw new HttpsError('failed-precondition', 'Selecciona también el permiso de lectura que necesita esa herramienta.');
  }
  const role = { name: name.trim(), permissions: safePermissions, updatedAt: new Date().toISOString() };
  await db.collection('roles').doc(id).set(role);
  // Editar un rol actualiza también sus claims: no deja permisos antiguos en cuentas ya asignadas.
  const assigned = await db.collection('users').where('role', '==', id).get();
  let profileBatch = db.batch();
  let batchWrites = 0;
  for (const profileDoc of assigned.docs) {
    const account = await auth.getUser(profileDoc.id);
    await auth.setCustomUserClaims(profileDoc.id, {
      ...(account.customClaims || {}),
      role: id,
      permissions: safePermissions,
    });
    profileBatch.update(profileDoc.ref, { permissions: safePermissions });
    batchWrites += 1;
    if (batchWrites === 450) {
      await profileBatch.commit();
      profileBatch = db.batch();
      batchWrites = 0;
    }
  }
  if (batchWrites) await profileBatch.commit();
  return { id, ...role };
});

exports.adminDeleteRole = onCall(async (request) => {
  if (request.auth?.token?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo el administrador raíz puede eliminar roles.');
  }
  const id = request.data?.id;
  if (typeof id !== 'string' || BASE_ROLES[id]) {
    throw new HttpsError('invalid-argument', 'Ese rol está reservado.');
  }
  const assigned = await db.collection('users').where('role', '==', id).limit(1).get();
  if (!assigned.empty) throw new HttpsError('failed-precondition', 'Primero asigna otro rol a sus usuarios.');
  await db.collection('roles').doc(id).delete();
  return { id };
});

// Regalos con límites, historial y saldo actualizados atómicamente.
exports.adminGift = onCall(async (request) => {
  requirePermission(request, 'economy.gift');
  const { uid, coins = 0, gems = 0, items = [] } = request.data || {};
  const coinGift = Math.floor(Number(coins));
  const gemGift = Math.floor(Number(gems));
  if (
    typeof uid !== 'string' ||
    !Number.isFinite(coinGift) ||
    !Number.isFinite(gemGift) ||
    coinGift < 0 ||
    coinGift > 1000000 ||
    gemGift < 0 ||
    gemGift > 10000 ||
    !Array.isArray(items) ||
    items.length > 3 ||
    items.some((id) => typeof id !== 'string' || !/^(skin|gun)_[A-Za-z0-9_]+$/.test(id))
  ) {
    throw new HttpsError('invalid-argument', 'El regalo no cumple los límites permitidos.');
  }
  const profileRef = db.collection('users').doc(uid);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(profileRef);
    if (!snapshot.exists) throw new HttpsError('not-found', 'No encontramos el perfil.');
    const profile = snapshot.data();
    const inventory = Array.isArray(profile.inventory) ? [...profile.inventory] : [];
    const collection = Array.isArray(profile.collection) ? [...profile.collection] : [];
    const now = new Date().toISOString();
    for (const itemId of new Set(items)) {
      if (inventory.includes(itemId)) continue;
      inventory.push(itemId);
      collection.push({ itemId, source: 'admin', acquiredAt: now });
    }
    tx.update(profileRef, {
      coins: (Number(profile.coins) || 0) + coinGift,
      gems: (Number(profile.gems) || 0) + gemGift,
      inventory,
      collection,
    });
  });
  return { uid, coins: coinGift, gems: gemGift, items };
});

// Abre una temporada nueva con número monotónico; los perfiles conservan su historial.
exports.adminForceSeason = onCall(async (request) => {
  requirePermission(request, 'season.manage');
  const configRef = db.collection('gameContent').doc('season');
  const [configSnap, usersSnap] = await Promise.all([
    configRef.get(),
    db.collection('users').orderBy('seasonNumber', 'desc').limit(1).get(),
  ]);
  const config = configSnap.exists
    ? configSnap.data().value
    : {
        idPrefix: 'parche',
        startsAt: '2026-10-07T00:00:00-05:00',
        type: 'days',
        days: 15,
        rankResetPercent: 40,
      };
  const now = new Date();
  const currentNumber = Math.max(
    Number(usersSnap.docs[0]?.data().seasonNumber) || 0,
    elapsedSeasonNumber(config, now),
  );
  const number = currentNumber + 1;
  const startsAt = now;
  let endsAt;
  if (config.type === 'month') {
    endsAt = new Date(startsAt);
    const day = endsAt.getUTCDate();
    endsAt.setUTCDate(1);
    endsAt.setUTCMonth(endsAt.getUTCMonth() + 1);
    const last = new Date(
      Date.UTC(endsAt.getUTCFullYear(), endsAt.getUTCMonth() + 1, 0),
    ).getUTCDate();
    endsAt.setUTCDate(Math.min(day, last));
  } else {
    endsAt = new Date(startsAt.getTime() + Math.max(1, Number(config.days) || 15) * 86400000);
  }
  const season = {
    id: `${config.idPrefix || 'parche'}-${startsAt.toISOString().slice(0, 10).replaceAll('-', '')}-${number}`,
    number,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
  await configRef.set({
    value: {
      ...config,
      currentSeason: season,
      seasonOverrides: [
        ...(Array.isArray(config.seasonOverrides) ? config.seasonOverrides : []),
        ...(config.currentSeason ? [config.currentSeason] : []),
      ],
    },
    updatedAt: startsAt.toISOString(),
    updatedBy: request.auth.uid,
  });
  return season;
});
