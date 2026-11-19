/* Тема применяется до отрисовки страницы, чтобы не мигать. Если localStorage недоступен, остаётся тёмная. */
try {
  const saved = localStorage.getItem('dg-theme');
  document.documentElement.dataset.theme = saved === 'light' ? 'light' : 'dark';
} catch (e) {}
