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
  if (reduced) {
    canvas.remove();
    return;
  }

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
    const tex = loader.load(`img/screens/screen-${n}.jpg`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    return tex;
  });

  const H = 3.25;
  const SW = 1.42;
  const SH = SW / (582 / 1280);
  const SR = 0.19;

  /* ---------- своя модель (glb / gltf / fbx) ---------- */
  let screenTextures = screens;
  let screenMaterials = [];
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

    spin.add(outer);
    applyScreen();
    intro = 0;
  }

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
  let intro = 0;
  let last = performance.now();

  function tick(now) {
    requestAnimationFrame(tick);

    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;

    const target = progressAt(window.scrollY);
    const vel = target - P;
    P += vel * (1 - Math.exp(-dt * 6));

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


    pinkLight.position.x = -4 + Math.sin(time * 0.5) * 1.4;
    violetLight.position.y = -2 + Math.cos(time * 0.4) * 1.4;

    renderer.render(scene, camera);
  }

  requestAnimationFrame(tick);
}
