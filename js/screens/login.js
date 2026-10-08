import { auth } from '../services/auth.js';
import { DATA_POLICY_VERSION } from '../services/privacy.js';

const form = document.querySelector('#auth-form');
const feedback = document.querySelector('#auth-feedback');
const username = document.querySelector('#username');
const password = document.querySelector('#password');
const confirmPassword = document.querySelector('#password-confirm');
const consent = document.querySelector('#data-consent');
const submit = document.querySelector('#auth-submit');
let flow = 'login';
let pendingUser = null;

function mode(next) {
  flow = next;
  const consentOnly = next === 'consent';
  const registering = next === 'register';
  document.querySelector('.auth-tabs').classList.toggle('d-none', consentOnly);
  document.querySelector('#tab-login').classList.toggle('active', next === 'login');
  document.querySelector('#tab-register').classList.toggle('active', registering);
  document.querySelector('#username').closest('label').classList.toggle('d-none', consentOnly);
  document.querySelector('#password').closest('label').classList.toggle('d-none', consentOnly);
  username.required = !consentOnly;
  password.required = !consentOnly;
  username.disabled = consentOnly;
  password.disabled = consentOnly;
  confirmPassword.disabled = consentOnly;
  confirmPassword.required = registering;
  document.querySelector('#confirm-wrap').classList.toggle('d-none', !registering);
  document.querySelector('#password-notice').classList.toggle('d-none', !registering);
  document.querySelector('#data-consent-row').classList.toggle('d-none', !(registering || consentOnly));
  document.querySelector('#remember-row').classList.toggle('d-none', registering || consentOnly);
  password.autocomplete = registering ? 'new-password' : 'current-password';
  submit.querySelector('span').textContent = consentOnly
    ? 'ACEPTAR Y CONTINUAR'
    : registering
      ? 'CREAR MI CUENTA'
      : 'ENTRAR AL PARCHE';
  feedback.textContent = '';
}

async function continueWithAccount(user) {
  if (user.dataConsentVersion !== DATA_POLICY_VERSION) {
    pendingUser = user;
    mode('consent');
    feedback.textContent = 'Lee la política de datos y acepta para continuar con esta cuenta.';
    return;
  }
  location.replace('./menu.html');
}

document.querySelector('#tab-login').addEventListener('click', () => mode('login'));
document.querySelector('#tab-register').addEventListener('click', () => mode('register'));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submit.disabled = true;
  try {
    if (flow === 'consent') {
      if (!consent.checked) throw Error('Debes aceptar la política de datos para continuar.');
      await auth.acceptDataPolicy(pendingUser);
      location.replace('./menu.html');
      return;
    }

    const user =
      flow === 'register'
        ? await auth.register({
            username: username.value,
            password: password.value,
            confirm: confirmPassword.value,
            acceptedDataPolicy: consent.checked,
          })
        : await auth.login({
            username: username.value,
            password: password.value,
            remember: document.querySelector('#remember').checked,
          });
    await continueWithAccount(user);
  } catch (error) {
    feedback.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

const currentUser = await auth.current();
if (currentUser) await continueWithAccount(currentUser);
