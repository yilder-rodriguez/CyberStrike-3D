import { auth } from '../services/auth.js';
import { db } from '../services/db.js';
import { firebaseConfig, firebaseReady } from '../core/firebase-config.js';

const user = await auth.current();
if (!user) location.replace('./index.html');
else openSocial(user);

function openSocial(user) {
  const requestList = document.querySelector('#request-list');
  const friendList = document.querySelector('#friend-list');
  const inviteList = document.querySelector('#invite-list');
  const modeSelect = document.querySelector('#invite-mode');
  const cleanups = [];
  const presenceCleanups = new Map();
  const visibleInvites = new Map();
  const cloudReady = firebaseReady;
  const realtimeReady = firebaseReady && Boolean(firebaseConfig.databaseURL);
  document.querySelector('#social-status').textContent = realtimeReady
    ? 'CUENTA EN LÍNEA · PRESENCIA E INVITACIONES EN TIEMPO REAL'
    : cloudReady
      ? 'FIRESTORE ACTIVO · Configura Realtime Database para presencia e invitaciones entre dispositivos.'
      : 'MODO LOCAL · Amigos y solicitudes se guardan en este dispositivo; no se sincronizan entre URLs o equipos.';

  function showMessage(message, isError = false) {
    const feedback = document.querySelector('#request-feedback');
    feedback.textContent = message;
    feedback.style.color = isError ? '#ee9277' : 'var(--lime)';
  }

  function createEmpty(message) {
    const empty = document.createElement('p');
    empty.className = 'empty-copy';
    empty.textContent = message;
    return empty;
  }

  function playerRow(profile, options = {}) {
    const row = document.createElement('article');
    row.className = 'social-row';
    const avatar = document.createElement('span');
    avatar.className = 'avatar-mark';
    avatar.textContent = (profile.username || '?').slice(0, 1).toUpperCase();
    const info = document.createElement('div');
    info.className = 'social-player';
    const name = document.createElement('strong');
    name.textContent = profile.username || 'Jugador';
    const detail = document.createElement('small');
    detail.textContent = `NIVEL ${Number(profile.level) || 0} · RANGO ${profile.rankName || 'Tonto'}`;
    info.append(name, detail);
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    row.append(avatar, info, actions);
    return { row, info, actions };
  }

  async function loadRequests() {
    try {
      const requests = await db.listFriendRequests(user);
      document.querySelector('#request-count').textContent = String(requests.length);
      requestList.replaceChildren();
      if (!requests.length) requestList.append(createEmpty('No tienes solicitudes nuevas.'));
      for (const request of requests) {
        const ui = playerRow(request);
        const accept = document.createElement('button');
        accept.className = 'action-btn';
        accept.textContent = 'ACEPTAR';
        accept.addEventListener('click', async () => {
          accept.disabled = true;
          try {
            await db.acceptFriendRequest(user, request.senderUid);
            showMessage(`${request.username || request.senderName} ya está en tu cuadrilla.`);
            await refreshFriends();
            await loadRequests();
          } catch (error) {
            showMessage(error.message || 'No se pudo aceptar la solicitud.', true);
            accept.disabled = false;
          }
        });
        const reject = document.createElement('button');
        reject.className = 'action-btn danger';
        reject.textContent = 'PASAR';
        reject.addEventListener('click', async () => {
          reject.disabled = true;
          try {
            await db.rejectFriendRequest(user, request.senderUid);
            await loadRequests();
          } catch (error) {
            showMessage(error.message || 'No se pudo quitar la solicitud.', true);
            reject.disabled = false;
          }
        });
        ui.actions.append(accept, reject);
        requestList.append(ui.row);
      }
    } catch (error) {
      requestList.replaceChildren(
        createEmpty(error.message || 'No pudimos cargar las solicitudes.'),
      );
    }
  }

  async function refreshFriends() {
    for (const stop of presenceCleanups.values()) stop();
    presenceCleanups.clear();
    try {
      const friends = await db.listFriends(user);
      document.querySelector('#friend-count').textContent =
        `${friends.length} AMIGO${friends.length === 1 ? '' : 'S'}`;
      friendList.replaceChildren();
      if (!friends.length)
        friendList.append(
          createEmpty('Agrega a alguien por su nombre para armar tu primera cuadrilla.'),
        );
      for (const friend of friends) {
        const ui = playerRow(friend);
        const presence = document.createElement('small');
        presence.className = 'friend-presence';
        const onlineDot = document.createElement('span');
        onlineDot.className = 'presence';
        const onlineText = document.createElement('span');
        onlineText.textContent = 'FUERA DE LÍNEA';
        presence.append(onlineDot, onlineText);
        ui.info.append(presence);

        const invite = document.createElement('button');
        invite.className = 'action-btn';
        invite.textContent = realtimeReady ? 'INVITAR Y JUGAR' : 'INVITAR';
        invite.disabled = !realtimeReady;
        invite.addEventListener('click', async () => {
          invite.disabled = true;
          const mode = modeSelect.value;
          try {
            await db.sendGameInvite(user, friend, mode);
            const mapId = mode === 'parkour' ? 'medellin-azoteas' : 'bogota-tejados';
            location.href = `./juego.html?mode=${mode}&map=${mapId}`;
          } catch (error) {
            showMessage(error.message || 'No se pudo enviar la invitación.', true);
            invite.disabled = !realtimeReady;
          }
        });
        const remove = document.createElement('button');
        remove.className = 'action-btn danger';
        remove.textContent = 'QUITAR';
        remove.addEventListener('click', async () => {
          remove.disabled = true;
          try {
            await db.removeFriend(user, friend.uid);
            await refreshFriends();
          } catch (error) {
            showMessage(error.message || 'No se pudo quitar a este jugador.', true);
            remove.disabled = false;
          }
        });
        ui.actions.append(invite, remove);
        friendList.append(ui.row);
        const stop = db.watchPresence(friend.uid, (state) => {
          onlineDot.classList.toggle('online', state.online);
          onlineText.textContent = state.online ? 'EN LÍNEA' : 'FUERA DE LÍNEA';
        });
        presenceCleanups.set(friend.uid, stop);
      }
    } catch (error) {
      friendList.replaceChildren(createEmpty(error.message || 'No pudimos cargar a tu cuadrilla.'));
    }
  }

  document.querySelector('#friend-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = document.querySelector('#friend-username');
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    const name = input.value.trim();
    if (!name) return showMessage('Escribe el nombre exacto de tu amigo.', true);
    submit.disabled = true;
    try {
      const target = await db.sendFriendRequest(user, name);
      input.value = '';
      showMessage(`Solicitud enviada a ${target.username}.`);
    } catch (error) {
      showMessage(error.message || 'No se pudo enviar la solicitud.', true);
    } finally {
      submit.disabled = false;
    }
  });

  function renderInvite(invite) {
    if (!invite?.id) return;
    if (invite.status !== 'pending' || Date.now() - Number(invite.createdAt || 0) > 180000) {
      visibleInvites.delete(invite.id);
      const old = inviteList.querySelector(`[data-invite="${CSS.escape(invite.id)}"]`);
      old?.remove();
      if (!visibleInvites.size)
        inviteList.replaceChildren(createEmpty('Esperando invitaciones del parche…'));
      return;
    }
    visibleInvites.set(invite.id, invite);
    inviteList.replaceChildren();
    for (const current of visibleInvites.values()) {
      const row = document.createElement('article');
      row.className = 'invite-row';
      row.dataset.invite = current.id;
      const copy = document.createElement('div');
      copy.className = 'invite-copy';
      const name = document.createElement('strong');
      name.textContent = `${current.fromName} te invita a ${current.mode === 'parkour' ? 'Parkour' : 'Combate'}`;
      const detail = document.createElement('small');
      detail.textContent = `${current.mode === 'parkour' ? 'Azoteas de Medellín' : 'Tejados de Bogotá'} · vence en 3 minutos`;
      copy.append(name, detail);
      const actions = document.createElement('div');
      actions.className = 'row-actions';
      const accept = document.createElement('button');
      accept.className = 'action-btn';
      accept.textContent = 'ACEPTAR Y ENTRAR';
      accept.disabled = !realtimeReady;
      accept.addEventListener('click', async () => {
        accept.disabled = true;
        try {
          await db.respondGameInvite(user, current.id, 'accepted');
          location.href = `./juego.html?mode=${current.mode}&map=${current.mapId}`;
        } catch (error) {
          showMessage(error.message || 'No se pudo aceptar la invitación.', true);
          accept.disabled = false;
        }
      });
      const reject = document.createElement('button');
      reject.className = 'action-btn danger';
      reject.textContent = 'AHORA NO';
      reject.addEventListener('click', async () => {
        try {
          await db.respondGameInvite(user, current.id, 'rejected');
        } catch (error) {
          showMessage(error.message || 'No se pudo responder la invitación.', true);
        }
      });
      actions.append(accept, reject);
      row.append(copy, actions);
      inviteList.append(row);
    }
  }

  const unwatchInvites = db.watchGameInvites(user, renderInvite);
  cleanups.push(unwatchInvites);
  refreshFriends();
  loadRequests();
  window.addEventListener(
    'pagehide',
    () => {
      for (const stop of presenceCleanups.values()) stop();
      cleanups.forEach((stop) => stop());
    },
    { once: true },
  );
}
