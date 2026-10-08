export function openPlay({ body, title, modal }) {
  title.textContent = 'Elige cómo jugar';
  body.innerHTML =
    '<div class="play-choice"><button data-mode="combat"><small>01 / COMBATE</small><strong>Aguanta la ronda</strong><span>Enfréntate a drones con IA y sube oleadas.</span><b>ENTRAR ↗</b></button><button data-mode="parkour"><small>02 / PARKOUR</small><strong>Corre por los techos</strong><span>Salta obstáculos, llega a la meta y marca récord.</span><b>ENTRAR ↗</b></button></div>';
  body
    .querySelectorAll('[data-mode]')
    .forEach((b) => (b.onclick = () => (location.href = './juego.html?mode=' + b.dataset.mode)));
  modal.show();
}
