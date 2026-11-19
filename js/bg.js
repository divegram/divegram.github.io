/* Анимированный градиентный фон в стиле ShaderGradient (розово-фиолетовая гамма иконки сайта).
   Свой лёгкий WebGL-шейдер: без three.js, React и внешних скриптов, поэтому работает под строгим CSP.
   - рендерится в уменьшенном разрешении (градиент мягкий, разницы не видно, зато быстро на телефонах)
   - ограничивает FPS, ставится на паузу в фоновой вкладке
   - учитывает prefers-reduced-motion (один статичный кадр)
   - если WebGL недоступен, остаётся CSS-градиент .bg-glow */
(() => {
  const canvas = document.getElementById('bgShader');
  if (!canvas) return;

  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowPower = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;

  const RENDER_SCALE = lowPower ? 0.35 : 0.5; /* доля от CSS-размера */
  const FRAME_MS = 1000 / (lowPower ? 30 : 45);
  const STATIC_TIME = 9.0;

  const VERT = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    uniform vec2 uRes;
    uniform float uTime;
    uniform float uDark;
    uniform float uScroll;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    /* simplex noise 3D (Ashima Arts / Stefan Gustavson, MIT) */
    float snoise(vec3 v) {
      const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);

      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);

      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;

      i = mod289(i);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));

      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);

      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);

      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);

      vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      float asp = uRes.x / uRes.y;
      vec2 p = (uv - 0.5) * vec2(asp, 1.0);

      /* на узких экранах чуть увеличиваем детализацию, чтобы градиент не выглядел плоским */
      float sc = 0.62 * (asp < 1.0 ? 1.0 + (1.0 - asp) * 0.55 : 1.0);
      p.y += uScroll * 0.00012;

      float t = uTime * 0.055;

      /* domain warping: тянем координаты шумом, получаем плавные «шёлковые» волны */
      vec2 q = vec2(
        snoise(vec3(p * sc, t)),
        snoise(vec3(p * sc + 4.7, t + 3.1))
      );
      vec2 r = vec2(
        snoise(vec3(p * sc * 1.3 + q * 0.75 + 1.7, t * 1.2)),
        snoise(vec3(p * sc * 1.3 + q * 0.75 + 8.3, t * 1.1 + 2.0))
      );
      float n = snoise(vec3(p * sc * 0.9 + r * 0.7, t * 0.8));
      float k = clamp(0.5 + (n * 0.5 + 0.06 * r.x) * 0.95, 0.0, 1.0);

      /* палитра из иконки: #B731EA / #D34BED / #e05db5 / #7c4cc4 */
      vec3 c0 = mix(vec3(0.980, 0.976, 0.969), vec3(0.075, 0.047, 0.118), uDark); /* фон сайта */
      vec3 c1 = mix(vec3(0.925, 0.851, 0.980), vec3(0.200, 0.070, 0.400), uDark); /* глубокий фиолетовый */
      vec3 c2 = mix(vec3(0.863, 0.659, 0.949), vec3(0.400, 0.110, 0.640), uDark); /* фиолетовый */
      vec3 c3 = mix(vec3(0.965, 0.702, 0.863), vec3(0.640, 0.180, 0.560), uDark); /* розовый */

      vec3 col = c0;
      col = mix(col, c1, smoothstep(0.05, 0.50, k));
      col = mix(col, c2, smoothstep(0.35, 0.78, k));
      col = mix(col, c3, smoothstep(0.60, 1.00, k));

      /* мягкие тёмные края в тёмной теме, чтобы текст по центру читался лучше */
      float vig = 0.86 + 0.14 * smoothstep(1.15, 0.15, length(p));
      col *= mix(1.0, vig, uDark);

      /* дизеринг против бандинга на плавных градиентах */
      float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      col += (dither - 0.5) / 255.0;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  let gl = null;
  let program = null;
  let loc = {};
  let raf = 0;
  let lastFrame = 0;
  let startTime = performance.now() - Math.random() * 20000; /* каждый визит начинается с другой точки */
  let scrollY = window.scrollY || 0;
  let targetDark = root.dataset.theme === 'light' ? 0 : 1;
  let dark = targetDark;
  let running = false;

  const fail = () => {
    cancelAnimationFrame(raf);
    running = false;
    canvas.remove(); /* останется CSS-градиент .bg-glow */
  };

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('[divegram] shader:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const setup = () => {
    gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    });
    if (!gl) return false;

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); /* один большой треугольник */

    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    loc = {
      res: gl.getUniformLocation(program, 'uRes'),
      time: gl.getUniformLocation(program, 'uTime'),
      dark: gl.getUniformLocation(program, 'uDark'),
      scroll: gl.getUniformLocation(program, 'uScroll'),
    };
    return true;
  };

  const resize = () => {
    const w = Math.max(2, Math.round(canvas.clientWidth * RENDER_SCALE));
    const h = Math.max(2, Math.round(canvas.clientHeight * RENDER_SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      if (gl) gl.viewport(0, 0, w, h);
    }
  };

  const draw = (now) => {
    if (!gl || gl.isContextLost()) return;
    dark += (targetDark - dark) * 0.12;
    if (Math.abs(targetDark - dark) < 0.002) dark = targetDark;

    gl.uniform2f(loc.res, canvas.width, canvas.height);
    gl.uniform1f(loc.time, reduced ? STATIC_TIME : (now - startTime) / 1000);
    gl.uniform1f(loc.dark, dark);
    gl.uniform1f(loc.scroll, scrollY);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (now - lastFrame < FRAME_MS) return;
    lastFrame = now;
    draw(now);
  };

  const start = () => {
    if (running || reduced || document.hidden) return;
    running = true;
    raf = requestAnimationFrame(frame);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  /* при reduced-motion анимации нет: перерисовываем только когда что-то реально поменялось */
  const drawOnce = () => {
    resize();
    draw(performance.now());
  };

  if (!setup()) return fail();
  resize();
  draw(performance.now());
  canvas.classList.add('bg-shader--ready');
  root.classList.add('has-shader');

  start();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (reduced) drawOnce();
    }, 120);
  });

  /* плавная смена темы: следим за data-theme на <html> */
  new MutationObserver(() => {
    targetDark = root.dataset.theme === 'light' ? 0 : 1;
    if (reduced) { dark = targetDark; drawOnce(); }
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    stop();
  });

  canvas.addEventListener('webglcontextrestored', () => {
    if (!setup()) return fail();
    resize();
    draw(performance.now());
    start();
  });
})();
