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

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  status.className = 'form-status';

  const resultados = campos.map(validar);
  if (resultados.includes(false)) {
    status.textContent = 'Revisa los campos marcados.';
    status.classList.add('error');
    campos.find((c) => c.closest('.field').classList.contains('invalid')).focus();
    return;
  }

  const val = (id) => document.getElementById(id).value.trim();
  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;
  status.textContent = 'Guardando...';

  try {
    await supabase('trabajadores', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        apellido_paterno: val('ap-paterno'),
        apellido_materno: val('ap-materno'),
        nombres: val('nombres'),
        dni: val('dni'),
        fecha_nacimiento: val('nacimiento'),
        sexo: val('sexo'),
        nacionalidad: val('nacionalidad'),
        direccion_personal: val('direccion'),
        empresa: val('empresa'),
      }),
    });
    form.reset();
    status.className = 'form-status ok';
    status.textContent = 'Trabajador guardado correctamente.';
  } catch (err) {
    status.className = 'form-status error';
    status.textContent = err.code === '23505'
      ? 'Ya existe un trabajador con ese DNI.'
      : 'No se pudo guardar. Inténtalo de nuevo.';
  } finally {
    boton.disabled = false;
  }
});

form.addEventListener('reset', () => {
  status.textContent = '';
  campos.forEach((c) => {
    c.closest('.field').classList.remove('invalid');
    c.closest('.field').querySelector('.field-error').textContent = '';
    c.removeAttribute('aria-invalid');
  });
});
