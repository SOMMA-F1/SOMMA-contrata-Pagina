const form = document.getElementById('form-trabajador');
const status = document.getElementById('form-status');

// Fecha de nacimiento: no puede ser futura.
document.getElementById('nacimiento').max = new Date().toISOString().slice(0, 10);

// DNI: solo dígitos.
document.getElementById('dni').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
});

function mensaje(campo) {
  const v = campo.value.trim();
  if (campo.required && !v) return 'Este campo es obligatorio.';
  if (campo.id === 'dni' && !/^\d{8}$/.test(v)) return 'El DNI debe tener 8 dígitos.';
  if (campo.id === 'nacimiento' && v && v > campo.max) return 'La fecha no puede ser futura.';
  return '';
}

function validar(campo) {
  const texto = mensaje(campo);
  const caja = campo.closest('.field');
  caja.classList.toggle('invalid', texto !== '');
  caja.querySelector('.field-error').textContent = texto;
  campo.setAttribute('aria-invalid', String(texto !== ''));
  return texto === '';
}

const campos = [...form.querySelectorAll('input, select')];

campos.forEach((c) => {
  c.addEventListener('blur', () => validar(c));
  c.addEventListener('input', () => {
    if (c.closest('.field').classList.contains('invalid')) validar(c);
  });
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  status.className = 'form-status';

  const resultados = campos.map(validar);
  if (resultados.includes(false)) {
    status.textContent = 'Revisa los campos marcados.';
    status.classList.add('error');
    campos.find((c) => c.closest('.field').classList.contains('invalid')).focus();
    return;
  }

  // Pendiente: guardar en la base de datos cuando se conecte.
  // Por ahora los datos no se guardan en ningún sitio.
  status.textContent = 'Datos válidos. El guardado se activará cuando se conecte la base de datos.';
  status.classList.add('ok');
});

form.addEventListener('reset', () => {
  status.textContent = '';
  campos.forEach((c) => {
    c.closest('.field').classList.remove('invalid');
    c.closest('.field').querySelector('.field-error').textContent = '';
    c.removeAttribute('aria-invalid');
  });
});
