const form = document.getElementById('form-login');
const status = document.getElementById('login-status');
const boton = document.getElementById('btn-login');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const usuario = document.getElementById('usuario').value;
  const clave = document.getElementById('clave').value;
  status.className = 'form-status';

  if (!usuario.trim() || !clave) {
    status.textContent = 'Ingresa tu usuario y contraseña.';
    status.classList.add('error');
    return;
  }

  boton.disabled = true;
  status.textContent = 'Ingresando...';
  try {
    await iniciarSesion(usuario, clave);
    location.replace('index.html');
  } catch (err) {
    status.className = 'form-status error';
    status.textContent = err.message === 'Invalid login credentials'
      ? 'Usuario o contraseña incorrectos.'
      : 'No se pudo iniciar sesión. Inténtalo de nuevo.';
    boton.disabled = false;
  }
});
