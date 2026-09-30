import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* =====================================================================
   НАСТРОЙКИ СВОЕЙ МОДЕЛИ
   Положи файл в папку models/ рядом с index.html:
     models/phone.glb   (лучший вариант)
     models/phone.gltf
     models/phone.fbx
   Скрипт сам: найдёт модель, повернёт её "экраном вперёд", масштабирует
   и подставит скриншоты клиента на экран (меш/материал с именем
   screen / display / lcd / oled / panel).
   Если скрин на экране перевёрнут — меняй эти три параметра.
   ===================================================================== */
const MODEL_FILES = ['models/phone.glb', 'models/phone.gltf', 'models/phone.fbx'];
const SCREEN_FLIP_Y = true; // для твоей модели iPhone 13 Pro Max нужен true. null = авто (glb: false, fbx: true)
const SCREEN_ROTATE = 0; // поворот скрина в радианах: Math.PI / 2, Math.PI ...
const SCREEN_MIRROR_X = false; // true, если скрин отзеркален

const canvas = document.getElementById('phoneCanvas');
if (canvas) init();

function init() {
  console.info('[divegram] phone3d v7 загружен');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- renderer ---------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    canvas.remove();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 60);
  camera.position.set(0, 0, 12);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(-3, 4, 6);
  scene.add(keyLight);

  const pinkLight = new THREE.PointLight(0xe05db5, 30, 18);
  pinkLight.position.set(-4, 2, 4);
  scene.add(pinkLight);

  const violetLight = new THREE.PointLight(0x9b6dd7, 28, 18);
  violetLight.position.set(4, -2, 3.5);
  scene.add(violetLight);

  /* ---------- helpers ---------- */
  function roundedRect(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r);
    s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h);
    s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r);
    s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }

  function screenGeometry(w, h, r) {
    const g = new THREE.ShapeGeometry(roundedRect(w, h, r), 32);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
    }
    uv.needsUpdate = true;
    return g;
  }

  /* ---------- textures ---------- */
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const screens = [1, 2, 3].map((n) => {
    const tex = loader.load(`img/screens/screen-${n}.png`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    return tex;
  });

  const logoTex = loader.load('img/logo.svg');
  logoTex.colorSpace = THREE.SRGBColorSpace;
  logoTex.anisotropy = maxAniso;

  const sheenCanvas = document.createElement('canvas');
  sheenCanvas.width = 256;
  sheenCanvas.height = 256;
  const sctx = sheenCanvas.getContext('2d');
  const sg = sctx.createLinearGradient(0, 0, 256, 256);
  sg.addColorStop(0.0, 'rgba(255,255,255,0)');
  sg.addColorStop(0.38, 'rgba(255,255,255,0)');
  sg.addColorStop(0.5, 'rgba(255,255,255,0.20)');
  sg.addColorStop(0.62, 'rgba(255,255,255,0)');
  sg.addColorStop(1.0, 'rgba(255,255,255,0)');
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 256, 256);
  const sheenTex = new THREE.CanvasTexture(sheenCanvas);
  sheenTex.wrapS = THREE.RepeatWrapping;
  sheenTex.wrapT = THREE.RepeatWrapping;
  sheenTex.repeat.set(1.4, 1.4);

  /* ---------- phone root ---------- */
  const W = 1.5;
  const H = 3.25;
  const R = 0.24;
  const D = 0.15;
  const BEV = 0.016;
  const FRONT = D / 2 + BEV;

  const phone = new THREE.Group();
  const spin = new THREE.Group();
  phone.add(spin);
  scene.add(phone);

  /* встроенная модель (используется, пока нет своей или если она не загрузилась) */
  const procedural = new THREE.Group();
  spin.add(procedural);

  const bodyGeo = new THREE.ExtrudeGeometry(roundedRect(W - BEV * 2, H - BEV * 2, R - BEV), {
    depth: D,
    bevelEnabled: true,
    bevelThickness: BEV,
    bevelSize: BEV,
    bevelSegments: 3,
    curveSegments: 48,
  });
  bodyGeo.translate(0, 0, -D / 2);

  const backMat = new THREE.MeshPhysicalMaterial({
    color: 0x32406b,
    metalness: 0.7,
    roughness: 0.42,
    clearcoat: 0.2,
    clearcoatRoughness: 0.6,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xb3bdd8, metalness: 1, roughness: 0.3 });
  procedural.add(new THREE.Mesh(bodyGeo, [backMat, frameMat]));

  const bezel = new THREE.Mesh(
    screenGeometry(W - 0.02, H - 0.02, R - 0.01),
    new THREE.MeshBasicMaterial({ color: 0x020104 })
  );
  bezel.position.z = FRONT + 0.001;
  procedural.add(bezel);

  const SW = 1.42;
  const SH = SW / (582 / 1280);
  const SR = 0.19;
  const screenMat = new THREE.MeshBasicMaterial({ map: screens[0], toneMapped: false });
  screenMat.name = 'screen';
  const screen = new THREE.Mesh(screenGeometry(SW, SH, SR), screenMat);
  screen.name = 'Screen';
  screen.position.z = FRONT + 0.003;
  procedural.add(screen);

  const sheen = new THREE.Mesh(
    screenGeometry(SW, SH, SR),
    new THREE.MeshBasicMaterial({
      map: sheenTex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    })
  );
  sheen.name = 'Sheen';
  sheen.position.z = FRONT + 0.005;
  procedural.add(sheen);

  const island = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.048, 0.25, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  island.rotation.z = Math.PI / 2;
  island.position.set(0, SH / 2 - 0.1, FRONT + 0.007);
  procedural.add(island);

  const bandMat = new THREE.MeshBasicMaterial({ color: 0x1a2038 });
  [
    [-W / 2 - 0.001, H / 2 - 0.55],
    [W / 2 + 0.001, H / 2 - 0.55],
    [-W / 2 - 0.001, -H / 2 + 0.55],
    [W / 2 + 0.001, -H / 2 + 0.55],
  ].forEach(([x, y]) => {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, D + 0.02), bandMat);
    band.position.set(x, y, 0);
    procedural.add(band);
  });

  const btnMat = new THREE.MeshStandardMaterial({ color: 0x9aa6c6, metalness: 1, roughness: 0.3 });
  [
    [-W / 2, 0.88, 0.14],
    [-W / 2, 0.58, 0.26],
    [-W / 2, 0.22, 0.26],
    [W / 2, 0.62, 0.44],
    [W / 2, -0.5, 0.2],
  ].forEach(([x, y, len]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, len, 0.06), btnMat);
    b.position.set(x, y, 0);
    procedural.add(b);
  });

  const back = new THREE.Group();
  back.rotation.y = Math.PI;
  back.position.z = -FRONT;
  procedural.add(back);

  const PL_W = W - 0.09;
  const PL_H = 0.86;
  const PL_Y = H / 2 - 0.045 - PL_H / 2;
  const PL_D = 0.05;

  const plateau = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roundedRect(PL_W, PL_H, 0.18), {
      depth: PL_D,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 4,
      curveSegments: 40,
    }),
    new THREE.MeshPhysicalMaterial({
      color: 0x3d4c7d,
      metalness: 0.6,
      roughness: 0.34,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
    })
  );
  plateau.position.set(0, PL_Y, 0);
  back.add(plateau);

  const ringMat = new THREE.MeshStandardMaterial({ color: 0xc5cde3, metalness: 1, roughness: 0.18 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x05040c,
    metalness: 0.2,
    roughness: 0.03,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
  });
  const irisMat = new THREE.MeshStandardMaterial({
    color: 0x120a2c,
    emissive: 0x4a2a9a,
    emissiveIntensity: 0.55,
    metalness: 0.2,
    roughness: 0.1,
  });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xd9c8ff });
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff1cf });
  const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const zTop = PL_D + 0.01;

  function disc(radius, height, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 56), mat);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, PL_Y + y, z + height / 2);
    back.add(m);
  }

  [
    [-0.4, 0.2],
    [-0.4, -0.2],
    [-0.06, 0],
  ].forEach(([lx, ly]) => {
    disc(0.17, 0.05, ringMat, lx, ly, zTop);
    disc(0.14, 0.056, glassMat, lx, ly, zTop);
    disc(0.075, 0.06, irisMat, lx, ly, zTop);
    disc(0.02, 0.064, glintMat, lx + 0.035, ly + 0.035, zTop);
  });

  disc(0.05, 0.02, flashMat, 0.34, 0.22, zTop);
  disc(0.062, 0.02, glassMat, 0.34, -0.2, zTop);
  disc(0.018, 0.02, blackMat, 0.54, 0.24, zTop);

  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.56),
    new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, toneMapped: false })
  );
  logo.position.set(0, -0.32, 0.003);
  back.add(logo);

  /* ---------- своя модель (glb / gltf / fbx) ---------- */
  let screenTextures = screens;
  let screenMaterials = [screenMat];
  let currentScreen = 0;

  function applyScreen() {
    screenMaterials.forEach((m) => {
      m.map = screenTextures[currentScreen];
      m.needsUpdate = true;
    });
  }

  function setScreen(i) {
    if (i === currentScreen) return;
    currentScreen = i;
    applyScreen();
  }

  async function fetchModel() {
    for (const url of MODEL_FILES) {
      try {
        const head = await fetch(url, { method: 'HEAD' });
        if (!head.ok) continue;
        if (url.endsWith('.fbx')) {
          const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
          return { root: await new FBXLoader().loadAsync(url), fbx: true, url };
        }
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        const gltf = await new GLTFLoader().loadAsync(url);
        return { root: gltf.scene, fbx: false, url };
      } catch (err) {
        console.warn('[divegram] не удалось загрузить', url, err);
      }
    }
    return null;
  }

  const SCREEN_NAME = /screen|display|lcd|oled|panel|wallpaper|экран/i;
  const SCREEN_SKIP = /back|cam|lens|speaker|button|frame|body|glass_back/i;

  function findScreen(root) {
    let byMaterial = null;
    let byMesh = null;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m, idx) => {
        if (!byMaterial && m && SCREEN_NAME.test(m.name || '') && !SCREEN_SKIP.test(m.name || '')) {
          byMaterial = { mesh: o, index: idx };
        }
      });
      if (!byMesh && SCREEN_NAME.test(o.name || '') && !SCREEN_SKIP.test(o.name || '')) {
        byMesh = { mesh: o, index: 0 };
      }
    });
    return byMaterial || byMesh;
  }

  function fitModel(root) {
    /* 1. самая длинная ось -> высота (Y), самая короткая -> толщина (Z) */
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const order = [0, 1, 2].sort((a, b) => size.getComponent(b) - size.getComponent(a));
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    const vx = axes[order[1]].clone();
    const vy = axes[order[0]].clone();
    const vz = axes[order[2]].clone();
    const basis = new THREE.Matrix4().makeBasis(vx, vy, vz);
    if (basis.determinant() < 0) {
      vx.negate();
      basis.makeBasis(vx, vy, vz);
    }

    const inner = new THREE.Group();
    inner.add(root);
    inner.quaternion.setFromRotationMatrix(basis.clone().transpose());

    const outer = new THREE.Group();
    outer.add(inner);
    outer.updateMatrixWorld(true);

    /* 2. масштаб под высоту H и центр в нуле */
    const box2 = new THREE.Box3().setFromObject(outer);
    const s = H / box2.getSize(new THREE.Vector3()).y;
    inner.scale.setScalar(s);
    outer.updateMatrixWorld(true);
    const box3 = new THREE.Box3().setFromObject(outer);
    inner.position.sub(box3.getCenter(new THREE.Vector3()));
    outer.updateMatrixWorld(true);
    return outer;
  }

  function useCustomModel({ root, fbx, url }) {
    const names = [];
    root.traverse((o) => {
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        names.push(`${o.name || '(mesh)'} [${mats.map((m) => (m && m.name) || '-').join(', ')}]`);
      }
    });
    console.info('[divegram] модель', url, '— меши/материалы:\n' + names.join('\n'));

    const outer = fitModel(root);

    /* экран */
    const found = findScreen(root);
    screenTextures = screens.map((t) => {
      const c = t.clone();
      c.flipY = SCREEN_FLIP_Y === null ? fbx : SCREEN_FLIP_Y;
      c.center.set(0.5, 0.5);
      c.rotation = SCREEN_ROTATE;
      if (SCREEN_MIRROR_X) {
        c.wrapS = THREE.RepeatWrapping;
        c.repeat.x = -1;
      }
      c.needsUpdate = true;
      return c;
    });

    screenMaterials = [];
    if (found) {
      const mat = new THREE.MeshBasicMaterial({
        map: screenTextures[currentScreen],
        toneMapped: false,
        side: THREE.DoubleSide,
      });
      if (Array.isArray(found.mesh.material)) found.mesh.material[found.index] = mat;
      else found.mesh.material = mat;
      screenMaterials.push(mat);

      /* экран должен смотреть на камеру: если он сзади — разворачиваем */
      outer.updateMatrixWorld(true);
      const c = new THREE.Box3().setFromObject(found.mesh).getCenter(new THREE.Vector3());
      if (c.z < 0) outer.rotation.y = Math.PI;
    } else {
      /* экран в модели не найден: кладём плоскость со скринами на переднюю грань */
      const b = new THREE.Box3().setFromObject(outer);
      const k = (b.max.y - b.min.y) / H;
      const mat = new THREE.MeshBasicMaterial({
        map: screens[currentScreen],
        toneMapped: false,
        side: THREE.DoubleSide,
      });
      const plane = new THREE.Mesh(screenGeometry(SW * k * 0.98, SH * k * 0.98, SR * k), mat);
      plane.position.z = b.max.z + 0.002;
      outer.add(plane);
      screenTextures = screens;
      screenMaterials.push(mat);
      console.warn('[divegram] экран в модели не найден, использую плоскость. Имена смотри выше.');
    }

    procedural.visible = false;
    spin.add(outer);
    applyScreen();
    usingCustom = true;
  }

  let usingCustom = false;
  fetchModel().then((m) => {
    if (m) useCustomModel(m);
  });

  /* ---------- scroll choreography ----------
     hero -> about -> features -> exit (телефон улетает и исчезает)  */
  const stops = [
    { x: 0.245, y: 0, tilt: -0.05, screen: 0, alpha: 1, scale: 1 },
    { x: -0.255, y: 0, tilt: 0.05, screen: 1, alpha: 1, scale: 1 },
    { x: 0.255, y: 0, tilt: -0.04, screen: 2, alpha: 1, scale: 1 },
    { x: 0.5, y: 1.0, tilt: 0.25, screen: 0, alpha: 0, scale: 0.45 },
  ];
  const SEGMENTS = stops.length - 1;

  let positions = [0, 1, 2, 3];
  let tangents = [1, 1, 1, 1];
  let visW = 1;
  let mobile = false;

  function sectionScroll(id, mode) {
    const el = document.getElementById(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    if (mode === 'center') return top + r.height / 2 - window.innerHeight / 2;
    /* конец секции: нижняя граница на 60% высоты экрана — телефон уже улетел */
    if (mode === 'end') return top + r.height - window.innerHeight * 0.6;
    return top;
  }

  function layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    mobile = w < 900;

    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    visW = visH * camera.aspect;

    const maxScroll = Math.max(0, document.documentElement.scrollHeight - h);
    const raw = [
      0,
      sectionScroll('about', 'center'),
      sectionScroll('features', 'center'),
      sectionScroll('features', 'end'),
    ];
    let prev = -1;
    positions = raw.map((v, i) => {
      let y = v == null ? (i * maxScroll) / SEGMENTS : v;
      y = Math.min(Math.max(y, 0), maxScroll);
      y = Math.max(y, prev + 1);
      prev = y;
      return y;
    });

    /* касательные для гладкой кривой S(scroll): скорость не рвётся на стыках секций */
    const d = [];
    for (let k = 0; k < SEGMENTS; k++) d.push(1 / (positions[k + 1] - positions[k]));
    tangents = [d[0]];
    for (let k = 1; k < SEGMENTS; k++) tangents.push((2 * d[k - 1] * d[k]) / (d[k - 1] + d[k]));
    tangents.push(d[SEGMENTS - 1]);
  }

  layout();
  window.addEventListener('resize', layout);
  window.addEventListener('load', layout);
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(document.body);

  function progressAt(y) {
    if (y <= positions[0]) return 0;
    if (y >= positions[SEGMENTS]) return SEGMENTS;
    let k = 0;
    while (y >= positions[k + 1]) k++;
    const len = positions[k + 1] - positions[k];
    const u = (y - positions[k]) / len;
    const u2 = u * u;
    const u3 = u2 * u;
    return (
      k * (2 * u3 - 3 * u2 + 1) +
      (k + 1) * (-2 * u3 + 3 * u2) +
      len * ((u3 - 2 * u2 + u) * tangents[k] + (u3 - u2) * tangents[k + 1])
    );
  }

  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;

  /* ---------- pointer ---------- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  });

  /* ---------- loop ---------- */
  let P = 0;
  let time = 0;
  let intro = reduced ? 1 : 0;
  let last = performance.now();

  function tick(now) {
    requestAnimationFrame(tick);

    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;

    const target = progressAt(window.scrollY);
    const vel = target - P;
    P += vel * (reduced ? 1 : 1 - Math.exp(-dt * 6));

    /* S — гладкая "координата скролла" (0 hero, 1 about, 2 features, 3 конец).
       ВСЕ параметры — плавные функции от S без углов, поэтому нет резких отскоков,
       а любой пиксель скролла что-то меняет: телефон никогда не замирает. */
    const S = P;
    const Sm = Math.min(S, 2);

    /* 0 -> 1 -> 0 между секциями, с нулевой скоростью на краях (нет "V"-изломов) */
    const arc = 0.5 - 0.5 * Math.cos(TAU * Sm);

    intro = Math.min(1, intro + dt / 2.2);
    const ie = 1 - Math.pow(1 - intro, 3);

    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;

    /* испарение после блока features: растворяется, размывается и чуть всплывает */
    const e = smooth(clamp((S - 2.3) / 0.6, 0, 1));

    const alpha = (1 - 0.4 * arc) * (1 - e) * ie;
    const shown = alpha > 0.01;
    canvas.style.opacity = shown ? String(alpha * (mobile ? 0.45 : 1)) : '0';
    canvas.style.filter = e > 0.01 ? `blur(${(e * 16).toFixed(1)}px)` : 'none';
    if (!shown) {
      phone.visible = false;
      return;
    }
    phone.visible = true;

    /* позиция: маятник справа -> слева -> справа (плавный разворот на краях) */
    const drift = clamp(vel * 1.2, -0.4, 0.4);
    const x = mobile ? 0 : 0.25 * Math.cos(Math.PI * Sm) * visW;
    const y =
      Math.sin(time * 0.9) * 0.06 +
      Math.sin(S * TAU + 0.4) * 0.16 +
      arc * 0.12 +
      e * 0.45 +
      (mobile ? 0.15 : 0);
    phone.position.set(x, y, -arc * 1.0);

    const pulse = 1 + Math.sin(S * TAU * 2) * 0.03 + e * 0.1;
    phone.scale.setScalar((mobile ? 0.78 : 1) * pulse * (0.001 + ie * 0.999));

    /* вращение: постоянное направление, полный оборот на секцию */
    spin.rotation.y =
      S * TAU +
      vel * 1.0 +
      (1 - ie) * Math.PI * 1.2 +
      Math.sin(time * 0.55) * 0.16 +
      mouse.x * 0.3;
    spin.rotation.x =
      Math.sin(S * TAU + 1.2) * 0.12 + mouse.y * 0.12 + drift * 0.4 + Math.sin(time * 0.7) * 0.03;
    spin.rotation.z = Math.sin(S * Math.PI + 0.3) * 0.08 - drift * 0.12;

    /* скрин меняется, пока телефон повёрнут задней стороной (S = 0.5, 1.5, 2.5) */
    setScreen(Math.floor(S + 0.5) % screens.length);

    sheenTex.offset.x = spin.rotation.y * 0.35;
    sheenTex.offset.y = spin.rotation.x * 0.5;

    pinkLight.position.x = -4 + Math.sin(time * 0.5) * 1.4;
    violetLight.position.y = -2 + Math.cos(time * 0.4) * 1.4;

    renderer.render(scene, camera);
  }

  requestAnimationFrame(tick);
}
