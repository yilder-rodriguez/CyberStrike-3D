import { auth } from '../services/auth.js';
import { db } from '../services/db.js';
import { openProfile } from './profile.js';
import { openSettings } from './settings.js';
import { openCredits } from './credits.js';
import { openPlay } from './play.js';
import { ensureProgress } from '../services/progression.js';
import { openRoulette } from './roulette.js';
let user = await auth.current();
if (!user) location.replace('./index.html');
else {
  user = await ensureProgress(user);
  document.querySelector('#player-display-name').textContent = user.username.toUpperCase();
  document.querySelector('#lobby-player-name').textContent = user.username.toUpperCase();
  document.querySelector('#lobby-character-name').textContent = user.username.toUpperCase();
  document.querySelector('#lobby-player-level').textContent = Number(user.level || 0);
  document.querySelector('#lobby-player-rank').textContent = user.rankName || 'Tonto';
  const xp = Number(user.xp || 0), xpTarget = Math.max(100, Number(user.level || 0) * 100 + 100);
  document.querySelector('#lobby-xp-bar').style.width = `${Math.min(100, (xp / xpTarget) * 100)}%`;
  document.querySelector('#lobby-xp-label').textContent = `${xp.toLocaleString('es-CO')} / ${xpTarget.toLocaleString('es-CO')} XP`;
  document.querySelector('#coins-val').textContent = Number(user.coins || 0).toLocaleString(
    'es-CO',
  );
  document.querySelector('#gems-val').textContent = Number(user.gems || 0).toLocaleString('es-CO');
  document.querySelector('#storage-mode').textContent =
    db.mode === 'local' ? 'GUARDADO EN ESTE DISPOSITIVO' : 'NUBE ACTIVA';
  if (user.role === 'admin' || (user.permissions || []).length) {
    document.querySelector('#admin-link').classList.remove('d-none');
  }
}
const modal = new bootstrap.Modal(document.querySelector('#panel-modal')),
  body = document.querySelector('#modal-body'),
  title = document.querySelector('#modal-title'),
  save = document.querySelector('#save-settings');
const logoutModal = new bootstrap.Modal(document.querySelector('#logout-modal'));
const logoutButton = document.querySelector('#logout-confirm');
document.querySelector('#logout').addEventListener('click', () => logoutModal.show());
logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  logoutButton.classList.add('is-leaving');
  logoutButton.querySelector('span').textContent = 'CERRANDO…';
  try {
    await auth.signOut();
    location.replace('./index.html');
  } catch (error) {
    logoutButton.disabled = false;
    logoutButton.classList.remove('is-leaving');
    logoutButton.querySelector('span').textContent = 'CERRAR SESIÓN';
    document.querySelector('#logout-modal .modal-body').textContent =
      error.message || 'No se pudo cerrar la sesión. Intenta de nuevo.';
  }
});
function show(id) {
  save.classList.add('d-none');
  if (id === 'play') return openPlay({ body, title, modal });
  if (id === 'roulette')
    return openRoulette({
      user,
      body,
      title,
      modal,
      onUserChange: (updated) => {
        user = updated;
        document.querySelector('#coins-val').textContent = Number(user.coins || 0).toLocaleString(
          'es-CO',
        );
        document.querySelector('#gems-val').textContent = Number(user.gems || 0).toLocaleString(
          'es-CO',
        );
      },
    });
  if (id === 'profile') return openProfile({ user, body, title, modal });
  if (id === 'settings') return openSettings({ user, body, title, modal, save });
  if (id === 'credits') return openCredits({ body, title, modal });
  title.textContent = 'Disponible en la siguiente fase';
  body.textContent =
    'Esta pantalla llegará en su fase de desarrollo. Tu cuenta y progreso permanecen guardados.';
  modal.show();
}
document.querySelectorAll('[data-panel]').forEach((b) => (b.onclick = () => show(b.dataset.panel)));
document.querySelector('#btn-play-game').addEventListener(
  'click',
  (e) => {
    e.stopImmediatePropagation();
    show('play');
  },
  true,
);
