(() => {
  gsap.registerPlugin(ScrollTrigger);

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- smooth scroll (lenis) ---------- */
  const lenis = new Lenis({
    duration: 1.35,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 1.6,
  });

  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  ScrollTrigger.scrollerProxy(document.body, {
    scrollTop(value) {
      if (arguments.length) lenis.scrollTo(value, { immediate: true });
      return lenis.scroll;
    },
    getBoundingClientRect() {
      return {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
    },
  });

  /* anchor links through lenis */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -80, duration: 1.6 });
    });
  });

  /* ---------- navbar state ---------- */
  const nav = document.getElementById('nav');

  ScrollTrigger.create({
    start: 40,
    end: 'max',
    onToggle: (self) => nav.classList.toggle('nav--scrolled', self.isActive),
  });

  /* ---------- scroll progress bar ---------- */
  gsap.to('.progress', {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: {
      start: 0,
      end: 'max',
      scrub: 0.3,
    },
  });

  /* ---------- cursor ---------- */
  const cursor = document.getElementById('cursor');
  const cursorDot = document.getElementById('cursorDot');
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (isFinePointer) {
    gsap.set([cursor, cursorDot], { xPercent: -50, yPercent: -50 });

    let cursorX = 0, cursorY = 0, dotX = 0, dotY = 0;

    window.addEventListener('mousemove', (e) => {
      cursorX = e.clientX;
      cursorY = e.clientY;
      gsap.to(cursor, { opacity: 1, duration: 0.15 });
      gsap.to(cursorDot, { opacity: 1, duration: 0.15 });
    });

    gsap.ticker.add(() => {
      cursorDot.style.transform = `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%)`;
      gsap.to(cursor, {
        x: cursorX,
        y: cursorY,
        duration: 0.35,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    });

    document.addEventListener('mouseleave', () => {
      gsap.to([cursor, cursorDot], { opacity: 0, duration: 0.25 });
    });

    document.querySelectorAll('a, .btn, .card, [data-hover]').forEach((el) => {
      el.addEventListener('mouseenter', () => cursor.classList.add('cursor--active'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('cursor--active'));
    });
  }

  /* ---------- reveal helper ---------- */
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    gsap.fromTo(
      el,
      { y: 26, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: 'play none none none',
        },
      }
    );
  });

  /* ---------- hero entrance ---------- */
  if (!prefersReduced && document.querySelector('.hero')) {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.to('.hero__line-inner', {
      y: 0,
      duration: 1.15,
      stagger: 0.13,
    })
      .fromTo('.hero__badge', { y: -18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, '-=0.85')
      .fromTo('.hero__subtitle', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, '-=0.6')
      .fromTo('.hero__actions', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, '-=0.55')
      .fromTo('.hero__scroll', { opacity: 0 }, { opacity: 1, duration: 0.8 }, '-=0.4');

    gsap.to('.hero__orb--1', {
      x: 60, y: -40, duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1,
    });
    gsap.to('.hero__orb--2', {
      x: -50, y: 50, duration: 11, ease: 'sine.inOut', yoyo: true, repeat: -1,
    });
    gsap.to('.hero__orb--3', {
      x: 30, y: 30, scale: 1.15, duration: 8, ease: 'sine.inOut', yoyo: true, repeat: -1,
    });

    /* hero parallax out on scroll */
    gsap.to('.hero__title, .hero__subtitle, .hero__badge', {
      y: -70,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom 30%',
        scrub: 0.8,
      },
    });
  }

  /* ---------- cards stagger ---------- */
  gsap.utils.toArray('[data-card]').forEach((card, i) => {
    gsap.fromTo(
      card,
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power3.out',
        onComplete: () => gsap.set(card, { clearProps: 'transform' }),
        scrollTrigger: {
          trigger: card,
          start: 'top 88%',
          toggleActions: 'play none none none',
        },
      }
    );
  });

  /* ---------- phrase words ---------- */
  if (document.querySelector('.phrase')) {
    gsap.to('[data-reveal-word]', {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.5,
      ease: 'power3.out',
      stagger: 0.12,
      scrollTrigger: {
        trigger: '.phrase',
        start: 'top 75%',
        toggleActions: 'play none none none',
      },
    });
  }

  /* ---------- count-up stats ---------- */
  document.querySelectorAll('[data-date]').forEach((el) => {
    const start = new Date(el.dataset.date + 'T00:00:00').getTime();
    const target = Math.max(0, Math.floor((Date.now() - start) / 86400000));

    gsap.fromTo(
      el,
      { innerText: 0 },
      {
        innerText: target,
        duration: 2,
        ease: 'power2.out',
        snap: { innerText: 1 },
        scrollTrigger: {
          trigger: el,
          start: 'top 90%',
          toggleActions: 'play none none none',
          onEnter: () => {
            gsap.fromTo(el, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(2)' });
          },
        },
        onUpdate() {
          el.textContent = Math.round(el.innerText);
        },
      }
    );
  });

  /* ---------- faq accordion ---------- */
  const faqItems = gsap.utils.toArray('.faq__item');

  if (faqItems.length) {
    const smooth = !prefersReduced;

    const openItem = (item) => {
      item.setAttribute('open', '');
      if (!smooth) return;
      const answer = item.querySelector('.faq__a');
      if (!answer) return;
      gsap.killTweensOf(answer);
      gsap.fromTo(
        answer,
        { height: 0, opacity: 0, y: -8 },
        { height: 'auto', opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }
      );
    };

    const closeItem = (item) => {
      if (!smooth) { item.removeAttribute('open'); return; }
      const answer = item.querySelector('.faq__a');
      if (!answer) { item.removeAttribute('open'); return; }
      gsap.killTweensOf(answer);
      gsap.to(answer, {
        height: 0,
        opacity: 0,
        y: -8,
        duration: 0.35,
        ease: 'power2.in',
        onComplete: () => item.removeAttribute('open'),
      });
    };

    faqItems.forEach((item) => {
      const summary = item.querySelector('.faq__q');
      if (!summary) return;

      summary.addEventListener('click', (e) => {
        e.preventDefault();
        const wasOpen = item.hasAttribute('open');
        faqItems.forEach((other) => {
          if (other !== item && other.hasAttribute('open')) closeItem(other);
        });
        if (wasOpen) closeItem(item);
        else openItem(item);
      });
    });

    if (smooth) {
      gsap.set(faqItems.map((item) => item.querySelector('.faq__a')), { height: 0, opacity: 0 });

      gsap.fromTo(
        faqItems,
        { y: 36, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.1,
          onComplete: () => gsap.set(faqItems, { clearProps: 'transform' }),
          scrollTrigger: {
            trigger: '.faq__list',
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        }
      );
    }
  }

  /* ---------- spotlight ---------- */
  if (isFinePointer && !prefersReduced) {
    document.querySelectorAll('.card, .platform, .shot, .faq__item').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
      });
    });
  }

  /* ---------- mobile menu ---------- */
  const burger = document.getElementById('burger');
  const mobileMenu = document.getElementById('mobileMenu');

  if (burger && mobileMenu) {
    const closeMenu = () => {
      burger.classList.remove('nav__burger--open');
      mobileMenu.classList.remove('mobile-menu--open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    };

    const openMenu = () => {
      burger.classList.add('nav__burger--open');
      mobileMenu.classList.add('mobile-menu--open');
      burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    };

    burger.addEventListener('click', () => {
      if (mobileMenu.classList.contains('mobile-menu--open')) closeMenu();
      else openMenu();
    });

    mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  }

  /* ---------- back to top ---------- */
  const toTop = document.getElementById('toTop');

  if (toTop) {
    ScrollTrigger.create({
      start: 320,
      end: 'max',
      onToggle: (self) => toTop.classList.toggle('to-top--visible', self.isActive),
    });

    toTop.addEventListener('click', () => lenis.scrollTo(0, { duration: 1.6 }));
  }

  /* ---------- footer reveal ---------- */
  gsap.fromTo(
    '.footer',
    { y: 36, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.footer',
        start: 'top 92%',
        toggleActions: 'play none none none',
      },
    }
  );

  /* ---------- refresh ---------- */
  ScrollTrigger.refresh();

  if (prefersReduced) {
    gsap.set('[data-reveal], [data-card], [data-reveal-word], .hero__line-inner', { clearProps: 'all', opacity: 1, transform: 'none' });
  }
})();
