// Capa de persistencia versionada. Las pantallas consumen el mismo contrato en local y en Firebase.
import { firebaseReady } from '../core/firebase-config.js';
import { getFirebase } from '../core/firebase.js';
import { firebaseConfig } from '../core/firebase-config.js';
import { rankForPoints } from '../data/ranks.js';
import { SEASON_CONFIG } from '../data/seasons.js';
const U = 'cyber_users_v1',
  S = 'cyber_session_v1',
  P = 'cyber_pending_progression_v1',
  V = 'cyber_schema_version',
  read = (k, d) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch {
      return d;
    }
  },
  write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
// Migración aditiva: conserva cada cuenta y rellena solo campos que antes no existían.
let ver = Number(localStorage.getItem(V) || 0);
if (ver < 1) localStorage.setItem('cyber_legacy_imported', 'true');
if (ver < 3) {
  const users = read(U, []).map((user) => ({
    ...user,
    progressionVersion: Number(user.progressionVersion) || 0,
    seasonHistory: Array.isArray(user.seasonHistory)
      ? user.seasonHistory
      : Array.isArray(user.rankHistory)
        ? user.rankHistory
        : [],
    inventory: Array.isArray(user.inventory) ? user.inventory : [],
  }));
  write(U, users);
  localStorage.setItem(V, '3');
}

if (ver < 4) {
  const users = read(U, []).map((user) => {
    const inventory = Array.isArray(user.inventory) ? user.inventory : [];
    const equipped =
      user.equipped && typeof user.equipped === 'object'
        ? user.equipped
        : {
            skin: inventory.find((id) => String(id).startsWith('skin_')) || null,
            weapon: inventory.find((id) => String(id).startsWith('gun_')) || null,
          };
    const collection = Array.isArray(user.collection) ? [...user.collection] : [];
    for (const itemId of inventory) {
      if (
        !collection.some((entry) => entry && typeof entry === 'object' && entry.itemId === itemId)
      ) {
        collection.push({ itemId, source: 'legacy', acquiredAt: user.createdAt || null });
      }
    }
    return { ...user, equipped, collection };
  });
  write(U, users);
  localStorage.setItem(V, '4');
}
const progressionKeys = [
  'progressionVersion',
  'level',
  'xp',
  'rankPoints',
  'matchesLost',
  'quitCount',
  'seasonId',
  'seasonNumber',
  'seasonHighestRank',
  'seasonHistory',
  'coins',
  'inventory',
  'collection',
];
const pickProgression = (user) =>
  Object.fromEntries(progressionKeys.map((key) => [key, user[key]]));
let activePresenceUid = null;
let stopPresence = null;

function publicSummary(user) {
  const rankPoints = Number(user.rankPoints) || 0;
  return {
    uid: user.uid,
    username: user.username,
    level: Number(user.level) || 0,
    rankPoints,
    rankName: rankForPoints(rankPoints).name,
  };
}

function writeLocalUser(user) {
  const users = read(U, []);
  const index = users.findIndex((entry) => entry.uid === user.uid);
  if (index < 0) throw Error('No encontramos el perfil local.');
  users[index] = user;
  write(U, users);
}

function localPresenceKey(uid) {
  return `cyber_presence_v1_${uid}`;
}

export const db = {
  get mode() {
    return firebaseReady ? 'firebase' : 'local';
  },
  newId: () => crypto.randomUUID?.() || 'local-' + Date.now(),
  async createLocalUser(u) {
    let a = read(U, []);
    if (a.some((x) => x.username.toLowerCase() === u.username.toLowerCase()))
      throw Error('Ese nombre ya está en uso.');
    a.push(u);
    write(U, a);
    return u;
  },
  async getLocalUser(n) {
    return read(U, []).find((x) => x.username.toLowerCase() === n.toLowerCase()) || null;
  },
  async saveProfile(u) {
    if (firebaseReady) {
      let f = await getFirebase();
      await f.dbSdk.updateDoc(f.dbSdk.doc(f.db, 'users', u.uid), { settings: u.settings });
      return u;
    }
    let a = read(U, []),
      i = a.findIndex((x) => x.uid === u.uid);
    if (i < 0) throw Error('No encontramos el perfil.');
    a[i] = { ...a[i], ...u };
    write(U, a);
    return a[i];
  },
  async saveDataConsent(uid, consent) {
    const fields = {
      dataConsentVersion: consent.dataConsentVersion,
      dataConsentAt: consent.dataConsentAt,
    };
    if (firebaseReady) {
      const f = await getFirebase();
      await f.dbSdk.updateDoc(f.dbSdk.doc(f.db, 'users', uid), fields);
      return fields;
    }
    const users = read(U, []);
    const index = users.findIndex((entry) => entry.uid === uid);
    if (index < 0) throw Error('No encontramos el perfil para guardar tu autorización.');
    users[index] = { ...users[index], ...fields };
    write(U, users);
    return fields;
  },
  async saveProgression(user) {
    if (firebaseReady) {
      const pending = read(P, {});
      pending[user.uid] = { ...(pending[user.uid] || {}), ...pickProgression(user) };
      write(P, pending);
      try {
        const f = await getFirebase();
        await f.dbSdk.updateDoc(f.dbSdk.doc(f.db, 'users', user.uid), pending[user.uid]);
        delete pending[user.uid];
        write(P, pending);
      } catch {
        // El progreso queda en cola local y se reintenta al volver a abrir el juego.
      }
      return user;
    }
    const users = read(U, []);
    const index = users.findIndex((entry) => entry.uid === user.uid);
    if (index < 0) throw Error('No encontramos el perfil local.');
    users[index] = { ...users[index], ...pickProgression(user) };
    write(U, users);
    return users[index];
  },
  async saveEconomy(user) {
    const fields = {
      coins: Number(user.coins) || 0,
      gems: Number(user.gems) || 0,
      inventory: Array.isArray(user.inventory) ? user.inventory : [],
      collection: Array.isArray(user.collection) ? user.collection : [],
      equipped:
        user.equipped && typeof user.equipped === 'object'
          ? { skin: user.equipped.skin || null, weapon: user.equipped.weapon || null }
          : {
              skin: (user.inventory || []).find((id) => String(id).startsWith('skin_')) || null,
              weapon: (user.inventory || []).find((id) => String(id).startsWith('gun_')) || null,
            },
    };
    if (firebaseReady) {
      const f = await getFirebase();
      await f.dbSdk.updateDoc(f.dbSdk.doc(f.db, 'users', user.uid), fields);
      return { ...user, ...fields };
    }
    const users = read(U, []);
    const index = users.findIndex((entry) => entry.uid === user.uid);
    if (index < 0) throw Error('No encontramos el perfil local.');
    users[index] = { ...users[index], ...fields };
    write(U, users);
    return { ...user, ...fields };
  },
  async redeemCode(user, rawCode) {
    if (!firebaseReady) {
      throw Error('El canje de códigos requiere conectar Firebase para validar usos y premios.');
    }
    const codeId = String(rawCode).trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(codeId)) throw Error('Revisa el formato del código.');

    const f = await getFirebase();
    const sdk = f.dbSdk;
    const codeRef = sdk.doc(f.db, 'codes', codeId);
    const userRef = sdk.doc(f.db, 'users', user.uid);
    const redemptionRef = sdk.doc(f.db, 'users', user.uid, 'redemptions', codeId);
    let updatedUser;

    await sdk.runTransaction(f.db, async (transaction) => {
      const [codeSnapshot, userSnapshot, redemptionSnapshot] = await Promise.all([
        transaction.get(codeRef),
        transaction.get(userRef),
        transaction.get(redemptionRef),
      ]);
      if (!codeSnapshot.exists()) throw Error('Código no válido o inactivo.');
      if (redemptionSnapshot.exists()) throw Error('Ya canjeaste este código.');
      if (!userSnapshot.exists()) throw Error('No encontramos tu perfil.');

      const code = codeSnapshot.data();
      const profile = userSnapshot.data();
      const now = Date.now();
      const expiry = code.expiresAt?.toDate?.()?.getTime() ?? Number(code.expiresAt || 0);
      if (!code.active || (expiry && expiry <= now)) throw Error('El código ya venció.');
      if (Number(code.uses || 0) >= Number(code.maxUses || 0)) {
        throw Error('El código ya llegó a su límite de usos.');
      }

      const reward = code.reward || {};
      const items = Array.isArray(reward.items) ? reward.items : [];
      if (items.length > 3) throw Error('La recompensa del código no es válida.');
      const inventory = [...(profile.inventory || [])];
      const collection = [...(profile.collection || [])];
      const addedItems = items.filter((itemId) => !inventory.includes(itemId));
      for (const itemId of addedItems) {
        inventory.push(itemId);
        collection.push({
          itemId,
          source: 'code',
          codeId,
          acquiredAt: new Date().toISOString(),
        });
      }

      const coins = (Number(profile.coins) || 0) + Math.max(0, Number(reward.coins) || 0);
      const gems = (Number(profile.gems) || 0) + Math.max(0, Number(reward.gems) || 0);
      const rewards = {
        codeId,
        uid: user.uid,
        coins: Math.max(0, Number(reward.coins) || 0),
        gems: Math.max(0, Number(reward.gems) || 0),
        items,
        redeemedAt: new Date().toISOString(),
      };

      transaction.update(codeRef, { uses: Number(code.uses || 0) + 1 });
      transaction.update(userRef, {
        coins,
        gems,
        inventory,
        collection,
        lastRedeemedCode: codeId,
      });
      transaction.set(redemptionRef, rewards);
      updatedUser = { ...user, coins, gems, inventory, collection, lastRedeemedCode: codeId };
    });

    return updatedUser;
  },
  async syncPublicProfile(user) {
    if (!firebaseReady || !user?.uid) return null;
    const f = await getFirebase();
    const sdk = f.dbSdk;
    const ref = sdk.doc(f.db, 'publicProfiles', user.uid);
    const summary = publicSummary(user);
    const snapshot = await sdk.getDoc(ref);
    const current = snapshot.exists() ? snapshot.data() : null;
    if (
      !current ||
      ['username', 'level', 'rankPoints', 'rankName'].some((key) => current[key] !== summary[key])
    ) {
      await sdk.setDoc(ref, { ...summary, updatedAt: new Date().toISOString() }, { merge: true });
    }
    return summary;
  },
  async searchPlayer(user, rawName) {
    const username = String(rawName || '')
      .trim()
      .normalize('NFKC');
    if (!username) throw Error('Escribe un nombre de jugador.');
    if (firebaseReady) {
      const f = await getFirebase();
      const sdk = f.dbSdk;
      const record = await sdk.getDoc(sdk.doc(f.db, 'usernames', username.toLowerCase()));
      if (!record.exists()) return null;
      const uid = record.data().uid;
      if (uid === user.uid) throw Error('Ese eres tú. Busca a otro jugador.');
      const profile = await sdk.getDoc(sdk.doc(f.db, 'publicProfiles', uid));
      return profile.exists()
        ? profile.data()
        : { uid, username: record.data().username, level: 0, rankName: 'Tonto', rankPoints: 0 };
    }
    const target = read(U, []).find(
      (entry) => entry.username.toLowerCase() === username.toLowerCase(),
    );
    if (!target) return null;
    if (target.uid === user.uid) throw Error('Ese eres tú. Busca a otro jugador.');
    return publicSummary(target);
  },
  async sendFriendRequest(user, targetName) {
    const target = await this.searchPlayer(user, targetName);
    if (!target) throw Error('No encontramos ese nombre de jugador.');
    if (firebaseReady) {
      const f = await getFirebase();
      const sdk = f.dbSdk;
      const requestRef = sdk.doc(f.db, 'users', target.uid, 'friendRequests', user.uid);
      const friendRef = sdk.doc(f.db, 'users', user.uid, 'friends', target.uid);
      await sdk.runTransaction(f.db, async (tx) => {
        const friendship = await tx.get(friendRef);
        if (friendship.exists()) throw Error('Ya son amigos.');
        tx.set(requestRef, {
          senderUid: user.uid,
          senderName: user.username,
          sentAt: new Date().toISOString(),
        });
      });
      return target;
    }
    const users = read(U, []);
    const fromIndex = users.findIndex((entry) => entry.uid === user.uid);
    const toIndex = users.findIndex((entry) => entry.uid === target.uid);
    if (fromIndex < 0 || toIndex < 0) throw Error('No encontramos la cuenta local.');
    const from = users[fromIndex];
    const to = users[toIndex];
    if ((from.friends || []).some((friend) => friend.uid === to.uid)) throw Error('Ya son amigos.');
    const requests = Array.isArray(to.friendRequests) ? [...to.friendRequests] : [];
    if (requests.some((request) => request.senderUid === from.uid))
      throw Error('Ya enviaste una solicitud pendiente.');
    requests.push({
      senderUid: from.uid,
      senderName: from.username,
      sentAt: new Date().toISOString(),
    });
    users[toIndex] = { ...to, friendRequests: requests };
    write(U, users);
    return target;
  },
  async listFriendRequests(user) {
    if (firebaseReady) {
      const f = await getFirebase();
      const sdk = f.dbSdk;
      const snapshot = await sdk.getDocs(sdk.collection(f.db, 'users', user.uid, 'friendRequests'));
      return Promise.all(
        snapshot.docs.map(async (entry) => {
          const data = entry.data();
          const profile = await sdk.getDoc(sdk.doc(f.db, 'publicProfiles', data.senderUid));
          return { ...(profile.exists() ? profile.data() : {}), ...data };
        }),
      );
    }
    const current = await this.getLocalUser(user.username);
    const requests = current?.friendRequests || [];
    const users = read(U, []);
    return requests.map((request) => {
      const sender = users.find((entry) => entry.uid === request.senderUid);
      return { ...request, ...(sender ? publicSummary(sender) : {}) };
    });
  },
  async listFriends(user) {
    if (firebaseReady) {
      const f = await getFirebase();
      const sdk = f.dbSdk;
      const snapshot = await sdk.getDocs(sdk.collection(f.db, 'users', user.uid, 'friends'));
      const friends = await Promise.all(
        snapshot.docs.map(async (entry) => {
          const fallback = entry.data();
          const profile = await sdk.getDoc(sdk.doc(f.db, 'publicProfiles', fallback.uid));
          return profile.exists() ? profile.data() : fallback;
        }),
      );
      return friends.sort((a, b) => a.username.localeCompare(b.username, 'es'));
    }
    const current = await this.getLocalUser(user.username);
    const users = read(U, []);
    return (current?.friends || [])
      .map((friend) => {
        const latest = users.find((entry) => entry.uid === friend.uid);
        return latest ? publicSummary(latest) : friend;
      })
      .sort((a, b) => a.username.localeCompare(b.username, 'es'));
  },
  async acceptFriendRequest(user, senderUid) {
    if (firebaseReady) {
      const f = await getFirebase();
      const sdk = f.dbSdk;
      const requestRef = sdk.doc(f.db, 'users', user.uid, 'friendRequests', senderUid);
      const ownPublicRef = sdk.doc(f.db, 'publicProfiles', user.uid);
      const senderPublicRef = sdk.doc(f.db, 'publicProfiles', senderUid);
      const ownFriendRef = sdk.doc(f.db, 'users', user.uid, 'friends', senderUid);
      const peerFriendRef = sdk.doc(f.db, 'users', senderUid, 'friends', user.uid);
      await sdk.runTransaction(f.db, async (tx) => {
        const [request, ownProfile, senderProfile] = await Promise.all([
          tx.get(requestRef),
          tx.get(ownPublicRef),
          tx.get(senderPublicRef),
        ]);
        if (!request.exists()) throw Error('La solicitud ya no está disponible.');
        if (!ownProfile.exists() || !senderProfile.exists())
          throw Error('No encontramos los perfiles públicos.');
        const own = ownProfile.data();
        const sender = senderProfile.data();
        const now = new Date().toISOString();
        const friendSummary = (profile) => ({
          uid: profile.uid,
          username: profile.username,
          level: profile.level,
          rankPoints: profile.rankPoints,
          rankName: profile.rankName,
          since: now,
        });
        tx.set(ownFriendRef, friendSummary(sender));
        tx.set(peerFriendRef, friendSummary(own));
        tx.delete(requestRef);
      });
      return;
    }
    const users = read(U, []);
    const ownIndex = users.findIndex((entry) => entry.uid === user.uid);
    const senderIndex = users.findIndex((entry) => entry.uid === senderUid);
    if (ownIndex < 0 || senderIndex < 0) throw Error('No encontramos la cuenta local.');
    const own = users[ownIndex];
    const sender = users[senderIndex];
    const requests = (own.friendRequests || []).filter(
      (request) => request.senderUid !== senderUid,
    );
    const now = new Date().toISOString();
    const addFriend = (list, other) => [
      ...(list || []).filter((entry) => entry.uid !== other.uid),
      { ...publicSummary(other), since: now },
    ];
    users[ownIndex] = { ...own, friendRequests: requests, friends: addFriend(own.friends, sender) };
    users[senderIndex] = { ...sender, friends: addFriend(sender.friends, own) };
    write(U, users);
  },
  async rejectFriendRequest(user, senderUid) {
    if (firebaseReady) {
      const f = await getFirebase();
      await f.dbSdk.deleteDoc(f.dbSdk.doc(f.db, 'users', user.uid, 'friendRequests', senderUid));
      return;
    }
    const current = await this.getLocalUser(user.username);
    if (!current) return;
    writeLocalUser({
      ...current,
      friendRequests: (current.friendRequests || []).filter(
        (entry) => entry.senderUid !== senderUid,
      ),
    });
  },
  async removeFriend(user, friendUid) {
    if (firebaseReady) {
      const f = await getFirebase();
      const sdk = f.dbSdk;
      const batch = sdk.writeBatch(f.db);
      batch.delete(sdk.doc(f.db, 'users', user.uid, 'friends', friendUid));
      batch.delete(sdk.doc(f.db, 'users', friendUid, 'friends', user.uid));
      await batch.commit();
      return;
    }
    const users = read(U, []);
    const ownIndex = users.findIndex((entry) => entry.uid === user.uid);
    const friendIndex = users.findIndex((entry) => entry.uid === friendUid);
    if (ownIndex < 0) return;
    users[ownIndex] = {
      ...users[ownIndex],
      friends: (users[ownIndex].friends || []).filter((entry) => entry.uid !== friendUid),
    };
    if (friendIndex >= 0)
      users[friendIndex] = {
        ...users[friendIndex],
        friends: (users[friendIndex].friends || []).filter((entry) => entry.uid !== user.uid),
      };
    write(U, users);
  },
  async startPresence(user) {
    if (!user?.uid || activePresenceUid === user.uid) return;
    if (stopPresence) stopPresence();
    activePresenceUid = user.uid;
    let cleanup = () => {};
    stopPresence = () => {
      cleanup();
      stopPresence = null;
      activePresenceUid = null;
    };
    const lastSeenAt = Date.now();
    if (firebaseReady) {
      try {
        const f = await getFirebase();
        await f.dbSdk.updateDoc(f.dbSdk.doc(f.db, 'users', user.uid), { lastSeenAt });
      } catch {
        // El juego puede seguir aunque reglas antiguas aún no permitan guardar la conexión.
      }
    } else {
      const users = read(U, []);
      const index = users.findIndex((entry) => entry.uid === user.uid);
      if (index >= 0) {
        users[index] = { ...users[index], lastSeenAt };
        write(U, users);
      }
    }
    if (firebaseReady && firebaseConfig.databaseURL) {
      try {
        const f = await getFirebase();
        const sdk = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
        const database = sdk.getDatabase(f.app, firebaseConfig.databaseURL);
        const connection = sdk.ref(database, '.info/connected');
        const connectionId = crypto.randomUUID?.() || String(Date.now());
        const ref = sdk.ref(database, `presence/${user.uid}/${connectionId}`);
        const onDisconnect = sdk.onDisconnect(ref);
        const update = () =>
          sdk.set(ref, { username: user.username, state: 'online', updatedAt: Date.now() });
        const unsubscribe = sdk.onValue(connection, async (snapshot) => {
          if (snapshot.val() !== true) return;
          try {
            await onDisconnect.remove();
            await update();
          } catch {}
        });
        const heartbeat = setInterval(() => {
          if (document.visibilityState === 'visible') update().catch(() => {});
        }, 25000);
        cleanup = () => {
          clearInterval(heartbeat);
          unsubscribe();
          onDisconnect.cancel().catch(() => {});
          sdk.remove(ref).catch(() => {});
        };
        window.addEventListener('pagehide', () => stopPresence?.(), { once: true });
      } catch {
        activePresenceUid = null;
        stopPresence = null;
      }
      return;
    }
    const key = localPresenceKey(user.uid);
    const connectionId = crypto.randomUUID?.() || String(Date.now());
    const readConnections = () => {
      try {
        return JSON.parse(localStorage.getItem(key)) || {};
      } catch {
        return {};
      }
    };
    const heartbeat = () =>
      localStorage.setItem(
        key,
        JSON.stringify({
          ...readConnections(),
          [connectionId]: { state: 'online', updatedAt: Date.now() },
        }),
      );
    heartbeat();
    const timer = setInterval(heartbeat, 20000);
    cleanup = () => {
      clearInterval(timer);
      const peers = readConnections();
      delete peers[connectionId];
      if (Object.keys(peers).length) localStorage.setItem(key, JSON.stringify(peers));
      else localStorage.removeItem(key);
    };
    window.addEventListener('pagehide', () => stopPresence?.(), { once: true });
  },
  watchPresence(userId, callback) {
    if (firebaseReady && firebaseConfig.databaseURL) {
      let unsubscribe = () => {};
      let disposed = false;
      getFirebase()
        .then(async (f) => {
          const sdk = await import(
            'https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js'
          );
          const database = sdk.getDatabase(f.app, firebaseConfig.databaseURL);
          const stop = sdk.onValue(
            sdk.ref(database, `presence/${userId}`),
            (snapshot) => {
              const presence = snapshot.val();
              const connections = presence?.state ? [presence] : Object.values(presence || {});
              const live = connections.find(
                (entry) =>
                  entry?.state === 'online' && Date.now() - Number(entry.updatedAt || 0) < 60000,
              );
              const lastSeen =
                connections
                  .map((entry) => Number(entry?.updatedAt) || 0)
                  .sort((a, b) => b - a)[0] || null;
              callback(
                live ? { online: true, lastSeen: live.updatedAt } : { online: false, lastSeen },
              );
            },
            () => callback({ online: false, lastSeen: null }),
          );
          if (disposed) stop();
          else unsubscribe = stop;
        })
        .catch(() => callback({ online: false, lastSeen: null }));
      return () => {
        disposed = true;
        unsubscribe();
      };
    }
    const key = localPresenceKey(userId);
    const check = () => {
      let presence = null;
      try {
        presence = JSON.parse(localStorage.getItem(key));
      } catch {}
      const connections = presence?.state ? [presence] : Object.values(presence || {});
      const live = connections.find(
        (entry) => entry?.state === 'online' && Date.now() - Number(entry.updatedAt || 0) < 60000,
      );
      const lastSeen =
        connections.map((entry) => Number(entry?.updatedAt) || 0).sort((a, b) => b - a)[0] || null;
      callback(live ? { online: true, lastSeen: live.updatedAt } : { online: false, lastSeen });
    };
    check();
    window.addEventListener('storage', check);
    const timer = setInterval(check, 10000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', check);
    };
  },
  async sendGameInvite(user, friend, mode = 'combat') {
    if (!firebaseReady || !firebaseConfig.databaseURL)
      throw Error(
        'Las invitaciones entre dispositivos requieren configurar Firebase Realtime Database.',
      );
    if (!['combat', 'parkour'].includes(mode)) throw Error('Modo de juego no válido.');
    const f = await getFirebase();
    const sdk = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = sdk.getDatabase(f.app, firebaseConfig.databaseURL);
    const invites = sdk.ref(database, `gameInvites/${friend.uid}`);
    const inviteRef = sdk.push(invites);
    const mapId = mode === 'parkour' ? 'medellin-azoteas' : 'bogota-tejados';
    await sdk.set(inviteRef, {
      fromUid: user.uid,
      fromName: user.username,
      mode,
      mapId,
      createdAt: Date.now(),
      status: 'pending',
    });
    return inviteRef.key;
  },
  watchGameInvites(user, callback) {
    if (!firebaseReady || !firebaseConfig.databaseURL) return () => {};
    let unsubscribeAdded = () => {};
    let unsubscribeChanged = () => {};
    let disposed = false;
    getFirebase()
      .then(async (f) => {
        const sdk = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
        const database = sdk.getDatabase(f.app, firebaseConfig.databaseURL);
        const ref = sdk.ref(database, `gameInvites/${user.uid}`);
        const receive = (snapshot) => callback({ id: snapshot.key, ...snapshot.val() });
        const stopAdded = sdk.onChildAdded(ref, receive);
        const stopChanged = sdk.onChildChanged(ref, receive);
        if (disposed) {
          stopAdded();
          stopChanged();
        } else {
          unsubscribeAdded = stopAdded;
          unsubscribeChanged = stopChanged;
        }
      })
      .catch(() => {});
    return () => {
      disposed = true;
      unsubscribeAdded();
      unsubscribeChanged();
    };
  },
  async respondGameInvite(user, inviteId, status) {
    if (!['accepted', 'rejected'].includes(status))
      throw Error('Respuesta de invitación no válida.');
    const f = await getFirebase();
    const sdk = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js');
    const database = sdk.getDatabase(f.app, firebaseConfig.databaseURL);
    await sdk.update(sdk.ref(database, `gameInvites/${user.uid}/${inviteId}`), { status });
  },
  async listLocalUsers() {
    return read(U, []);
  },
  // Devuelve únicamente campos seguros para el directorio administrativo.
  async listPlayers(user) {
    requirePermission(user, 'players.read');
    let players;
    if (firebaseReady) {
      const result = await callAdminFunction('adminListPlayers', {});
      players = result.players || [];
    } else {
      players = await this.listLocalUsers();
    }
    return players
      .map((player) => ({
        uid: player.uid,
        username: String(player.username || 'Sin nombre'),
        role: String(player.role || 'jugador'),
        level: Number(player.level) || 0,
        rankPoints: Number(player.rankPoints) || 0,
        rankName: rankForPoints(Number(player.rankPoints) || 0).name,
        coins: Number(player.coins) || 0,
        gems: Number(player.gems) || 0,
        createdAt: player.createdAt || null,
        lastSeenAt: Number(player.lastSeenAt) || null,
      }))
      .sort((a, b) => a.username.localeCompare(b.username, 'es'));
  },
  async adminListCodes(user) {
    requirePermission(user, 'codes.read');
    if (!firebaseReady) return read('cyber_admin_codes_v1', []);
    const f = await getFirebase();
    const snapshot = await f.dbSdk.getDocs(f.dbSdk.collection(f.db, 'codes'));
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },
  async adminSaveCode(user, data) {
    requirePermission(user, 'codes.manage');
    const id = String(data.id || '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(id))
      throw Error('Usa un código de 3 a 32 letras, números, guion o guion bajo.');
    const maxUses = Math.floor(Number(data.maxUses));
    if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 100000)
      throw Error('Cantidad de usos no válida.');
    const codeItems = [
      ...new Set((data.items || []).map((item) => String(item).trim()).filter(Boolean)),
    ];
    const reward = {
      coins: Math.max(0, Math.floor(Number(data.coins) || 0)),
      gems: Math.max(0, Math.floor(Number(data.gems) || 0)),
      items: codeItems,
    };
    if (
      reward.coins > 3500 ||
      reward.gems > 10000 ||
      reward.items.length > 3 ||
      reward.items.some((itemId) => !/^(skin|gun)_[A-Za-z0-9_]+$/.test(itemId))
    ) {
      throw Error('La recompensa supera los límites permitidos o tiene un ID inválido.');
    }
    if (!firebaseReady) {
      const codes = read('cyber_admin_codes_v1', []);
      const old = codes.find((entry) => entry.id === id);
      const code = {
        id,
        reward,
        maxUses,
        uses: old?.uses || 0,
        active: true,
        expiresAt: data.expiresAt,
      };
      write('cyber_admin_codes_v1', [code, ...codes.filter((entry) => entry.id !== id)]);
      return code;
    }
    const f = await getFirebase();
    const expiresAt = f.dbSdk.Timestamp.fromDate(new Date(data.expiresAt));
    if (!Number.isFinite(expiresAt.toMillis()) || expiresAt.toMillis() <= Date.now())
      throw Error('La vigencia debe terminar en el futuro.');
    const ref = f.dbSdk.doc(f.db, 'codes', id);
    const previous = await f.dbSdk.getDoc(ref);
    const code = {
      reward,
      maxUses,
      uses: previous.exists() ? Number(previous.data().uses) || 0 : 0,
      active: true,
      expiresAt,
    };
    await f.dbSdk.setDoc(ref, code);
    return { id, ...code };
  },
  async adminSetCodeActive(user, id, active) {
    requirePermission(user, 'codes.manage');
    if (!firebaseReady) {
      const codes = read('cyber_admin_codes_v1', []).map((code) =>
        code.id === id ? { ...code, active } : code,
      );
      write('cyber_admin_codes_v1', codes);
      return codes;
    }
    const f = await getFirebase();
    await f.dbSdk.updateDoc(f.dbSdk.doc(f.db, 'codes', id), { active: Boolean(active) });
  },
  async adminDeleteCode(user, id) {
    requirePermission(user, 'codes.manage');
    if (!firebaseReady) {
      write(
        'cyber_admin_codes_v1',
        read('cyber_admin_codes_v1', []).filter((code) => code.id !== id),
      );
      return;
    }
    const f = await getFirebase();
    await f.dbSdk.deleteDoc(f.dbSdk.doc(f.db, 'codes', id));
  },
  async adminRedeemers(user, codeId) {
    requirePermission(user, 'codes.read');
    if (!firebaseReady) return [];
    const f = await getFirebase();
    const snap = await f.dbSdk.getDocs(f.dbSdk.collectionGroup(f.db, 'redemptions'));
    return snap.docs.map((doc) => doc.data()).filter((row) => row.codeId === codeId);
  },
  async adminGift(user, gift) {
    requirePermission(user, 'economy.gift');
    if (!firebaseReady) {
      const fakes = await this.listLocalUsers();
      const target = fakes.find((player) => player.uid === gift.uid);
      if (!target) throw Error('Jugador no encontrado.');
      const changed = applyGift(target, gift);
      writeLocalUser(changed);
      return changed;
    }
    return callAdminFunction('adminGift', gift);
  },
  async adminChangeRole(user, uid, role) {
    requirePermission(user, 'roles.assign');
    if (role === 'admin' && user?.role !== 'admin') throw Error('Solo el administrador raíz puede asignar el rol admin.');
    if (!firebaseReady) {
      const users = await this.listLocalUsers();
      const target = users.find((player) => player.uid === uid);
      if (!target) throw Error('Jugador no encontrado.');
      target.role = role;
      writeLocalUser(target);
      return target;
    }
    return callAdminFunction('adminSetRole', { uid, role });
  },
  async adminGetContent(user, key, fallback) {
    requirePermission(user, 'content.manage');
    return this.getGameContent(key, fallback);
  },
  async adminSaveContent(user, key, value) {
    requirePermission(user, 'content.manage');
    if (!firebaseReady) return this.saveData('admin_content_' + key, value);
    const f = await getFirebase();
    await f.dbSdk.setDoc(f.dbSdk.doc(f.db, 'gameContent', key), {
      value,
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid,
    });
  },
  async adminForceSeason(user) {
    requirePermission(user, 'season.manage');
    if (firebaseReady) return callAdminFunction('adminForceSeason', {});
    const config = await this.getGameContent('season', SEASON_CONFIG);
    const users = await this.listLocalUsers();
    const number =
      Math.max(
        Number(config.currentSeason?.number) || 0,
        ...users.map((entry) => Number(entry.seasonNumber) || 0),
      ) + 1;
    const startsAt = new Date();
    const endsAt =
      config.type === 'month'
        ? new Date(
            Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth() + 1, startsAt.getUTCDate()),
          )
        : new Date(startsAt.getTime() + Math.max(1, Number(config.days) || 15) * 86400000);
    const forced = {
      ...config,
      currentSeason: {
        id: `${config.idPrefix || 'parche'}-${startsAt.toISOString().slice(0, 10).replaceAll('-', '')}-${number}`,
        number,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      },
      seasonOverrides: [
        ...(Array.isArray(config.seasonOverrides) ? config.seasonOverrides : []),
        ...(config.currentSeason ? [config.currentSeason] : []),
      ],
    };
    await this.saveData('admin_content_season', forced);
    return forced.currentSeason;
  },
  async adminListRoles(user) {
    requirePermission(user, 'roles.assign');
    if (!firebaseReady) return read('cyber_roles_v1', []);
    return (await callAdminFunction('adminListRoles', {})).roles || [];
  },
  async adminSaveRole(user, role) {
    if (user?.role !== 'admin') throw Error('Solo el administrador raíz puede gestionar roles.');
    const id = String(role.id || '').trim().toLowerCase();
    const name = String(role.name || '').trim();
    const permissions = [...new Set(role.permissions || [])];
    const allowed = ['players.read', 'roles.assign', 'codes.read', 'codes.manage', 'economy.gift', 'content.manage', 'season.manage'];
    if (!/^[a-z][a-z0-9_-]{1,31}$/.test(id) || ['jugador', 'moderador', 'admin'].includes(id) || !name || name.length > 32 || permissions.some((permission) => !allowed.includes(permission))) {
      throw Error('Revisa el ID, nombre y permisos del rol.');
    }
    if ((permissions.includes('economy.gift') || permissions.includes('roles.assign')) && !permissions.includes('players.read')) throw Error('Para regalos o asignación de roles, selecciona también «Ver jugadores».');
    if (permissions.includes('codes.manage') && !permissions.includes('codes.read')) throw Error('Para administrar códigos, selecciona también «Ver códigos».');
    if (!firebaseReady) {
      const roles = read('cyber_roles_v1', []).filter((entry) => entry.id !== id);
      const saved = { id, name, permissions };
      write('cyber_roles_v1', [...roles, saved]);
      return saved;
    }
    return callAdminFunction('adminSaveRole', { id, name, permissions });
  },
  async adminDeleteRole(user, id) {
    if (user?.role !== 'admin') throw Error('Solo el administrador raíz puede gestionar roles.');
    if (!firebaseReady) {
      const assigned = (await this.listLocalUsers()).some((entry) => entry.role === id);
      if (assigned) throw Error('Primero asigna otro rol a sus usuarios.');
      write('cyber_roles_v1', read('cyber_roles_v1', []).filter((entry) => entry.id !== id));
      return;
    }
    return callAdminFunction('adminDeleteRole', { id });
  },
  async getGameContent(key, fallback) {
    if (!firebaseReady) return read('cyber_data_v1_admin_content_' + key, fallback);
    try {
      const f = await getFirebase();
      const snap = await f.dbSdk.getDoc(f.dbSdk.doc(f.db, 'gameContent', key));
      return snap.exists() ? snap.data().value : fallback;
    } catch {
      return fallback;
    }
  },
  async getLocalSession() {
    try {
      return JSON.parse(sessionStorage.getItem(S)) || read(S, null);
    } catch {
      return read(S, null);
    }
  },
  async setLocalSession(s, remember) {
    if (remember) {
      write(S, s);
      sessionStorage.removeItem(S);
    } else {
      localStorage.removeItem(S);
      sessionStorage.setItem(S, JSON.stringify(s));
    }
  },
  async clearSession() {
    localStorage.removeItem(S);
    sessionStorage.removeItem(S);
    if (stopPresence) stopPresence();
  },
  async getData(k, d) {
    return read('cyber_data_v1_' + k, d);
  },
  async saveData(k, v) {
    write('cyber_data_v1_' + k, v);
  },
  async claimUsername(username, uid, email, profile) {
    let f = await getFirebase(),
      sdk = f.dbSdk,
      claim = sdk.doc(f.db, 'usernames', username.toLowerCase()),
      user = sdk.doc(f.db, 'users', uid);
    await sdk.runTransaction(f.db, async (tx) => {
      if ((await tx.get(claim)).exists()) throw Error('Ese nombre ya está en uso.');
      tx.set(claim, { uid, username, email });
      tx.set(user, profile);
      tx.set(sdk.doc(f.db, 'publicProfiles', uid), {
        ...publicSummary(profile),
        updatedAt: new Date().toISOString(),
      });
    });
  },
  async usernameRecord(username) {
    let f = await getFirebase(),
      s = await f.dbSdk.getDoc(f.dbSdk.doc(f.db, 'usernames', username.toLowerCase()));
    return s.exists() ? s.data() : null;
  },
  async cloudProfile(uid) {
    let f = await getFirebase(),
      s = await f.dbSdk.getDoc(f.dbSdk.doc(f.db, 'users', uid));
    if (!s.exists()) return null;
    const profile = s.data();
    const pending = read(P, {});
    if (!pending[uid]) return profile;
    try {
      await f.dbSdk.updateDoc(f.dbSdk.doc(f.db, 'users', uid), pending[uid]);
      delete pending[uid];
      write(P, pending);
    } catch {
      // La copia local se aplica a la sesión aunque la nube siga sin conexión.
    }
    return { ...profile, ...pending[uid] };
  },
};

function requirePermission(user, permission) {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  if (user?.role !== 'admin' && !permissions.includes('*') && !permissions.includes(permission)) {
    throw Error(`Tu rol no tiene el permiso ${permission}.`);
  }
}

function applyGift(profile, gift) {
  const coins = Math.floor(Number(gift.coins) || 0),
    gems = Math.floor(Number(gift.gems) || 0);
  if (coins < 0 || gems < 0 || coins > 1000000 || gems > 10000)
    throw Error('La cantidad del regalo está fuera de los límites.');
  const changed = {
    ...profile,
    coins: (Number(profile.coins) || 0) + coins,
    gems: (Number(profile.gems) || 0) + gems,
    inventory: [...(profile.inventory || [])],
    collection: [...(profile.collection || [])],
  };
  for (const itemId of [...new Set(gift.items || [])].slice(0, 3)) {
    if (!/^(skin|gun)_[A-Za-z0-9_]+$/.test(itemId) || changed.inventory.includes(itemId)) continue;
    changed.inventory.push(itemId);
    changed.collection.push({ itemId, source: 'admin', acquiredAt: new Date().toISOString() });
  }
  return changed;
}

async function callAdminFunction(name, data) {
  const f = await getFirebase();
  const sdk = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js');
  const functions = sdk.getFunctions(f.app, 'us-central1');
  const result = await sdk.httpsCallable(functions, name)(data);
  return result.data;
}
