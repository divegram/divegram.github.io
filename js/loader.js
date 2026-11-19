/* Картинки с data-hide-on-error удаляются при ошибке загрузки (inline onerror запрещён CSP) */
document.addEventListener('error', (event) => {
  const el = event.target;
  if (el instanceof HTMLImageElement && el.hasAttribute('data-hide-on-error')) el.remove();
}, true);

(() => {
  const root = document.documentElement;
  const loader = document.getElementById('siteLoader');
  const fill = document.getElementById('siteLoaderFill');

  /* main.js ждёт это событие, чтобы запустить анимацию hero уже после того, как пропадёт загрузчик */
  window.dgReady = false;
  const markReady = () => {
    window.dgReady = true;
    document.dispatchEvent(new Event('dg:ready'));
  };

  if (!loader || !fill) { markReady(); return; }

  loader.hidden = false;
  root.classList.add('is-loading');

  let progress = 0;
  const timer = setInterval(() => {
    progress = Math.min(92, progress + Math.max(1, (92 - progress) * 0.08));
    fill.style.width = `${progress}%`;
    fill.parentElement.setAttribute('aria-valuenow', Math.round(progress));
  }, 80);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    fill.style.width = '100%';
    fill.parentElement.setAttribute('aria-valuenow', '100');
    setTimeout(() => {
      root.classList.remove('is-loading');
      markReady();
      setTimeout(() => loader.remove(), 650);
    }, 120);
  };

  /* ждём шрифты (важно для анимации заголовка) и DOM, а не все картинки; страховочный таймер 2.5 с */
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  const domReady = document.readyState === 'loading'
    ? new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
    : Promise.resolve();

  Promise.all([fontsReady, domReady]).then(finish, finish);
  setTimeout(finish, 2500);
})();

/* 3D-телефон: только компьютер (от 900px, мышь), без reduced-motion. На телефонах ничего не грузится. */
(() => {
  const desktop = window.matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  if (!desktop || reduced) return;

  root.classList.add('has-phone'); /* сразу резервируем место справа, чтобы раскладка не прыгала */

  const load = () => {
    if (!document.getElementById('phoneCanvas')) { root.classList.remove('has-phone'); return; }
    import('/js/phone3d.v7.js?v=2').catch((error) => {
      root.classList.remove('has-phone');
      console.warn('[divegram] 3D-модель не загрузилась', error);
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();
