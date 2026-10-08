import { auth } from '../services/auth.js';
export function openSettings({ user, body, title, modal, save }) {
  title.textContent = 'Ajustes de juego';
  let s = user.settings || {};
  body.innerHTML =
    '<div class="settings-grid"><label>Calidad gráfica<select id="quality"><option value="auto">Automática</option><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></label><label>Sensibilidad <input id="sensitivity" type="range" min="0.5" max="2" step="0.1" value="' +
    (s.sensitivity || 1) +
    '"></label><label>Idioma<select id="language"><option value="es">Español</option></select></label><label><span><input id="music" type="checkbox" ' +
    (s.music === false ? '' : 'checked') +
    '> Música</span></label><label><span><input id="sfx" type="checkbox" ' +
    (s.sfx === false ? '' : 'checked') +
    '> Efectos</span></label><label><span><input id="reduced" type="checkbox" ' +
    (s.reducedEffects ? 'checked' : '') +
    '> Reducir efectos para celular</span></label></div>';
  document.querySelector('#quality').value = s.quality || 'auto';
  save.classList.remove('d-none');
  save.onclick = async () => {
    user.settings = {
      quality: document.querySelector('#quality').value,
      sensitivity: Number(document.querySelector('#sensitivity').value),
      language: document.querySelector('#language').value,
      music: document.querySelector('#music').checked,
      sfx: document.querySelector('#sfx').checked,
      reducedEffects: document.querySelector('#reduced').checked,
    };
    await auth.updateProfile(user);
    save.textContent = 'GUARDADO';
    setTimeout(() => {
      save.textContent = 'GUARDAR';
      modal.hide();
    }, 600);
  };
  modal.show();
}
