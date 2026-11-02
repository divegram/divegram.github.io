const loader = document.getElementById('siteLoader');
const fill = document.getElementById('siteLoaderFill');

if (loader && fill) {
  loader.hidden = false;
  document.documentElement.classList.add('is-loading');

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
      document.documentElement.classList.remove('is-loading');
      setTimeout(() => loader.remove(), 650);
    }, 100);
  };

  window.addEventListener('load', finish, { once: true });
  setTimeout(finish, 6000);
}

if (document.getElementById('phoneCanvas') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('load', () => {
    import('/js/phone3d.v7.js?v=8').catch((error) => console.warn('[divegram] 3D-модель не загрузилась', error));
  }, { once: true });
}
