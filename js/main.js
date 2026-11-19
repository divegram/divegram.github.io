(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- localStorage без падений (приватный режим, запрет cookie) ---------- */
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) {} },
    remove(key) { try { localStorage.removeItem(key); } catch (e) {} },
  };

  /* ---------- тема ---------- */
  const themeToggle = $('#themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      if (storage.get('dg-consent') !== 'declined') storage.set('dg-theme', next);
      themeToggle.setAttribute('aria-pressed', String(next === 'light'));
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', next === 'light' ? '#faf9f7' : '#0d0a12');
    });
  }

  /* ---------- уведомление о localStorage ---------- */
  const cookieBanner = $('#cookieBanner');
  if (cookieBanner) {
    if (!storage.get('dg-consent')) {
      cookieBanner.hidden = false;
      root.classList.add('has-cookie');
    }

    const saveConsent = (value) => {
      storage.set('dg-consent', value);
      if (value === 'declined') storage.remove('dg-theme');
      else storage.set('dg-theme', root.dataset.theme || 'dark');
      cookieBanner.hidden = true;
      root.classList.remove('has-cookie');
    };

    $('#cookieAccept')?.addEventListener('click', () => saveConsent('accepted'));
    $('#cookieDecline')?.addEventListener('click', () => saveConsent('declined'));
  }

  /* ---------- счётчики дней: число считается сразу, анимация только поверх ---------- */
  const statEls = $$('[data-date]');
  const statTargets = new Map();
  statEls.forEach((el) => {
    const start = new Date(`${el.dataset.date}T00:00:00`).getTime();
    const days = Number.isFinite(start) ? Math.max(0, Math.floor((Date.now() - start) / 86400000)) : 0;
    statTargets.set(el, days);
    el.textContent = String(days);
  });

  /* ---------- Lenis: только для мыши. На телефонах родной скролл (плавнее и дешевле) ---------- */
  let lenis = null;
  const hasGsap = Boolean(window.gsap && window.ScrollTrigger);
  const canMotion = hasGsap && !prefersReduced;

  if (window.Lenis && isFinePointer && !prefersReduced) {
    lenis = new Lenis({
      duration: 0.95,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    root.classList.add('lenis-active');

    if (hasGsap) {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  } else if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
  }

  const scrollToTarget = (target, offset = -90) => {
    if (lenis) lenis.scrollTo(target, { offset, duration: 1 });
    else {
      const top = target.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top: Math.max(0, top), behavior: prefersReduced ? 'auto' : 'smooth' });
    }
  };

  const scrollToTop = () => {
    if (lenis) lenis.scrollTo(0, { duration: 1 });
    else window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
  };

  /* ---------- мобильное меню ---------- */
  const burger = $('#burger');
  const mobileMenu = $('#mobileMenu');
  const lockScroll = (locked) => {
    root.classList.toggle('menu-open', locked);
    if (lenis) (locked ? lenis.stop() : lenis.start());
  };

  const setMenu = (open, { restoreFocus = false } = {}) => {
    if (!burger || !mobileMenu) return;
    mobileMenu.classList.toggle('mobile-menu--open', open);
    burger.classList.toggle('nav__burger--open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'закрыть меню' : 'открыть меню');
    mobileMenu.inert = !open;
    lockScroll(open);
    if (open) mobileMenu.querySelector('a')?.focus({ preventScroll: true });
    else if (restoreFocus) burger.focus({ preventScroll: true });
  };

  if (burger && mobileMenu) {
    burger.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('mobile-menu--open'), { restoreFocus: true }));
    $$('a', mobileMenu).forEach((link) => link.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileMenu.classList.contains('mobile-menu--open')) setMenu(false, { restoreFocus: true });
    });

    /* если меню осталось открытым, а экран стал широким (поворот планшета), закрываем его */
    window.matchMedia('(min-width: 1201px)').addEventListener('change', (e) => {
      if (e.matches && mobileMenu.classList.contains('mobile-menu--open')) setMenu(false);
    });
  }

  /* ---------- якорные ссылки ---------- */
  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href) return;
      if (href === '#') {
        e.preventDefault();
        scrollToTop();
        return;
      }
      const target = document.getElementById(href.slice(1));
      if (!target) return;
      e.preventDefault();
      scrollToTarget(target);
      history.replaceState(null, '', href);
    });
  });

  /* ---------- UI от скролла: прогресс, шапка, кнопка «наверх». Без GSAP, работает всегда ---------- */
  const nav = $('#nav');
  const progress = $('.progress');
  const toTop = $('#toTop');
  let scrollTicking = false;

  const updateScrollUi = () => {
    scrollTicking = false;
    const y = window.scrollY;
    const max = Math.max(1, root.scrollHeight - window.innerHeight);
    if (progress) progress.style.transform = `scaleX(${Math.min(1, y / max)})`;
    if (nav) nav.classList.toggle('nav--scrolled', y > 40);
    if (toTop) toTop.classList.toggle('to-top--visible', y > 320);
  };

  window.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(updateScrollUi);
  }, { passive: true });
  window.addEventListener('resize', updateScrollUi, { passive: true });
  updateScrollUi();

  toTop?.addEventListener('click', scrollToTop);

  /* ---------- кастомный курсор (только мышь) ---------- */
  const cursor = $('#cursor');
  const cursorDot = $('#cursorDot');

  if (isFinePointer && cursor && cursorDot && !prefersReduced) {
    let targetX = -100, targetY = -100, ringX = -100, ringY = -100;
    let cursorVisible = false;

    const setVisible = (visible) => {
      cursorVisible = visible;
      cursor.style.opacity = visible ? '1' : '0';
      cursorDot.style.opacity = visible ? '1' : '0';
    };

    window.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!cursorVisible) {
        ringX = targetX;
        ringY = targetY;
        setVisible(true);
      }
    }, { passive: true });

    document.addEventListener('mouseleave', () => setVisible(false));
    document.addEventListener('mouseenter', () => setVisible(true));

    const tick = () => {
      ringX += (targetX - ringX) * 0.22;
      ringY += (targetY - ringY) * 0.22;
      cursor.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      cursorDot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    document.addEventListener('mouseover', (e) => {
      cursor.classList.toggle('cursor--active', Boolean(e.target.closest('a, button, .card, [data-hover]')));
    });
  }

  /* ---------- подсветка карточек за курсором (только мышь) ---------- */
  if (isFinePointer && !prefersReduced) {
    $$('.card, .platform, .shot, .faq__item').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
      }, { passive: true });
    });
  }

  /* ---------- FAQ: нативный <details>, плавность добавляет GSAP ---------- */
  const faqItems = $$('.faq__item');
  if (faqItems.length) {
    const smooth = canMotion;

    const openItem = (item) => {
      item.setAttribute('open', '');
      if (!smooth) return;
      const answer = $('.faq__a', item);
      if (!answer) return;
      gsap.killTweensOf(answer);
      gsap.fromTo(answer,
        { height: 0, opacity: 0, y: -6 },
        { height: 'auto', opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', onComplete: () => gsap.set(answer, { clearProps: 'height' }) });
    };

    const closeItem = (item) => {
      const answer = $('.faq__a', item);
      if (!smooth || !answer) { item.removeAttribute('open'); return; }
      gsap.killTweensOf(answer);
      gsap.to(answer, {
        height: 0, opacity: 0, y: -6, duration: 0.35, ease: 'power2.in',
        onComplete: () => { item.removeAttribute('open'); gsap.set(answer, { clearProps: 'all' }); },
      });
    };

    faqItems.forEach((item) => {
      const summary = $('.faq__q', item);
      if (!summary) return;
      summary.addEventListener('click', (e) => {
        e.preventDefault();
        const wasOpen = item.hasAttribute('open');
        faqItems.forEach((other) => { if (other !== item && other.hasAttribute('open')) closeItem(other); });
        if (wasOpen) closeItem(item);
        else openItem(item);
      });
    });
  }

  /* ---------- дальше только анимации. При reduced-motion или без GSAP контент просто виден ---------- */
  if (!canMotion) return;

  root.classList.add('motion-ready');

  /* ---------- появление блоков ---------- */
  $$('[data-reveal]').forEach((el) => {
    gsap.fromTo(el,
      { y: 22, opacity: 0 },
      {
        y: 0, opacity: 1, duration: 0.85, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' },
      });
  });

  /* ---------- hero: запускается только когда исчез загрузчик ---------- */
  if ($('.hero')) {
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });

    tl.to('.hero__line-inner', { y: 0, duration: 1.1, stagger: 0.14 })
      .fromTo('.hero__badge', { y: -16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, '-=0.9')
      .fromTo('.hero__subtitle', { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, '-=0.65')
      .fromTo('.hero__actions', { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, '-=0.6')
      .fromTo('.hero__scroll', { opacity: 0 }, { opacity: 1, duration: 0.8 }, '-=0.45');

    if (window.dgReady) tl.play();
    else document.addEventListener('dg:ready', () => tl.play(), { once: true });

    /* мягкий выезд hero при скролле */
    gsap.to('.hero__title, .hero__subtitle, .hero__badge', {
      y: -50, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 30%', scrub: 0.9 },
    });
  }

  /* ---------- карточки ---------- */
  $$('[data-card]').forEach((card) => {
    gsap.fromTo(card,
      { y: 32, opacity: 0 },
      {
        y: 0, opacity: 1, duration: 0.8, ease: 'power3.out',
        onComplete: () => gsap.set(card, { clearProps: 'transform,opacity' }),
        scrollTrigger: { trigger: card, start: 'top 92%', toggleActions: 'play none none none' },
      });
  });

  /* ---------- большая фраза ---------- */
  if ($('.phrase')) {
    gsap.to('[data-reveal-word]', {
      opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', stagger: 0.12,
      scrollTrigger: { trigger: '.phrase', start: 'top 80%', toggleActions: 'play none none none' },
    });
  }

  /* ---------- счётчики ---------- */
  statEls.forEach((el) => {
    const target = statTargets.get(el) || 0;
    const counter = { value: 0 };
    el.textContent = '0';

    ScrollTrigger.create({
      trigger: el,
      start: 'top 92%',
      once: true,
      onEnter: () => {
        gsap.fromTo(el, { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.8)' });
        gsap.to(counter, {
          value: target, duration: 2, ease: 'power2.out',
          onUpdate: () => { el.textContent = String(Math.round(counter.value)); },
          onComplete: () => { el.textContent = String(target); },
        });
      },
    });
  });

  /* ---------- FAQ: появление списка ---------- */
  if (faqItems.length) {
    gsap.fromTo(faqItems,
      { y: 28, opacity: 0 },
      {
        y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.08,
        onComplete: () => gsap.set(faqItems, { clearProps: 'transform,opacity' }),
        scrollTrigger: { trigger: '.faq__list', start: 'top 88%', toggleActions: 'play none none none' },
      });
  }

  /* ---------- футер ---------- */
  gsap.fromTo('.footer',
    { y: 28, opacity: 0 },
    {
      y: 0, opacity: 1, duration: 1, ease: 'power3.out',
      onComplete: () => gsap.set('.footer', { clearProps: 'transform,opacity' }),
      scrollTrigger: { trigger: '.footer', start: 'top 95%', toggleActions: 'play none none none' },
    });

  /* ---------- пересчёт позиций после шрифтов, картинок и возврата из bfcache ---------- */
  const refresh = () => ScrollTrigger.refresh();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  window.addEventListener('load', refresh, { once: true });
  window.addEventListener('pageshow', (event) => { if (event.persisted) refresh(); });
  refresh();
})();
