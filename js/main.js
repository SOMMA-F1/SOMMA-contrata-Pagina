const nav = document.getElementById('nav');
const toggle = document.querySelector('.nav-toggle');

toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});

nav.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }
});

document.getElementById('year').textContent = new Date().getFullYear();

const form = document.getElementById('contact-form');
const status = form.querySelector('.form-status');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  status.className = 'form-status';

  if (!form.checkValidity()) {
    status.textContent = 'Completa todos los campos con datos válidos.';
    status.classList.add('error');
    return;
  }

  // Pendiente: conectar con un servicio real (correo, Supabase, etc.).
  status.textContent = 'Gracias, recibimos tu mensaje.';
  status.classList.add('ok');
  form.reset();
});
