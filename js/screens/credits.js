export function openCredits({ body, title, modal }) {
  title.textContent = 'Hecho desde el parche';
  body.innerHTML =
    '<p>CYBERSTRIKER 3D</p><p>Creado por <strong>YILDER RODRIGUEZ</strong></p><p>Un proyecto independiente con identidad callejera colombiana.</p>';
  modal.show();
}
