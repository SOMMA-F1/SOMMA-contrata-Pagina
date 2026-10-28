// Comportamiento compartido por todas las páginas: menú móvil y año del pie.
(function () {
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('menu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const abierto = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(abierto));
    });
  }

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
