import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Tracking shot: the coach stays in frame while the road moves beneath it.
export function mountRoad(host) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b9c6cc');
  scene.fog = new THREE.FogExp2('#b9c6cc', 0.0055);
  const pmrem = new THREE.PMREMGenerator(renderer),
    room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.55;
  room.dispose();
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(39, 1, 0.2, 650);
  camera.position.set(24, 10, 28);
  camera.lookAt(-5, 2, 0);
  scene.add(new THREE.HemisphereLight('#d9e8f7', '#65573e', 2));
  const sun = new THREE.DirectionalLight('#ffe0ad', 3.4);
  sun.position.set(-25, 45, -30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -35,
    right: 35,
    top: 30,
    bottom: -30,
    near: 1,
    far: 130,
  });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  let seed = 17;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const materials = [];
  const mat = (color, roughness = 0.7, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.push(m);
    return m;
  };
  const paint = mat('#641423', 0.25, 0.65),
    trim = mat('#191d22', 0.35, 0.2),
    chrome = mat('#a5afb5', 0.2, 0.9),
    rubber = mat('#161819', 0.94),
    glass = mat('#142d3a', 0.12, 0.7),
    gold = mat('#b99b66', 0.3, 0.6);
  const mesh = (geometry, material, x = 0, y = 0, z = 0, parent = scene) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w, h, d, material, x, y, z, parent = scene, r = 0.02) =>
    mesh(new RoundedBoxGeometry(w, h, d, 3, r), material, x, y, z, parent);
  function texture(kind) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d'),
      image = ctx.createImageData(256, 256);
    for (let i = 0; i < image.data.length; i += 4) {
      const n = random() * 25;
      const base = kind === 'road' ? [49, 51, 52] : [92, 99, 65];
      image.data[i] = base[0] + n;
      image.data[i + 1] = base[1] + n;
      image.data[i + 2] = base[2] + n;
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(kind === 'road' ? 85 : 45, kind === 'road' ? 3 : 45);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    return t;
  }
  const asphalt = texture('road'),
    grass = texture('grass');
  const groundMat = mat('#ffffff', 1);
  groundMat.map = grass;
  mesh(new THREE.BoxGeometry(600, 0.3, 600), groundMat, 0, -0.36, 0);
  const roadMat = mat('#ffffff', 0.98);
  roadMat.map = asphalt;
  mesh(new THREE.BoxGeometry(600, 0.12, 9), roadMat, 0, -0.14, 0);
  const shoulder = mat('#a49d8e', 1);
  for (const side of [-1, 1])
    mesh(new THREE.BoxGeometry(600, 0.08, 0.75), shoulder, 0, -0.16, side * 4.9);
  const white = mat('#e5e1cf', 0.92),
    yellow = mat('#d8b34c', 0.9);
  for (const side of [-1, 1])
    mesh(new THREE.BoxGeometry(600, 0.015, 0.11), white, 0, -0.065, side * 4.25);
  const moving = new THREE.Group();
  scene.add(moving);
  for (let x = -240; x < 240; x += 10)
    mesh(new THREE.BoxGeometry(4, 0.02, 0.12), white, x, -0.06, 0, moving);
  // Coach: full-sized silhouette, curved body, continuous glazing and real axle proportions.
  const bus = new THREE.Group();
  bus.position.set(4, 0, 2.15);
  scene.add(bus);
  box(12.2, 2.65, 2.55, paint, 0, 2.05, 0, bus, 0.25);
  box(11.7, 0.22, 2.42, paint, -0.1, 3.43, 0, bus, 0.1);
  for (const side of [-1, 1]) {
    box(10.65, 1.13, 0.075, glass, -0.18, 2.76, side * 1.272, bus, 0.045);
    box(11.3, 0.09, 0.035, gold, -0.15, 1.85, side * 1.292, bus);
    box(11.35, 0.14, 0.07, trim, -0.12, 0.88, side * 1.28, bus);
    for (let x = -4.8; x < 4.9; x += 1.18) box(0.065, 1.14, 0.09, trim, x, 2.76, side * 1.29, bus);
    for (let x = -4.5; x < 3.7; x += 1.75) {
      box(0.018, 0.65, 0.016, trim, x, 1.28, side * 1.291, bus);
      box(0.22, 0.035, 0.026, chrome, x + 0.6, 1.56, side * 1.306, bus);
    }
    box(0.7, 0.36, 0.035, trim, 4.9, 1.15, side * 1.29, bus, 0.08);
    box(0.12, 0.12, 0.035, gold, -5.4, 1, side * 1.3, bus);
    box(0.12, 0.12, 0.035, gold, 3.5, 1, side * 1.3, bus);
  }
  const windshield = box(0.1, 1.55, 2.25, glass, 6.05, 2.57, 0, bus, 0.075);
  windshield.rotation.z = 0.11;
  box(0.12, 0.12, 2.22, chrome, 6.12, 1.54, 0, bus);
  box(0.09, 0.35, 1.15, trim, 6.16, 1.15, 0, bus, 0.04);
  for (let z = -0.4; z <= 0.4; z += 0.13)
    box(0.11, 0.018, 0.9, chrome, 6.22, 1.07 + z * 0.5, 0, bus);
  const light = mat('#fff0d1', 0.15);
  light.emissive = new THREE.Color('#fff0d1');
  light.emissiveIntensity = 2;
  for (const side of [-1, 1]) {
    box(0.15, 0.17, 0.54, light, 6.11, 1.35, side * 0.86, bus, 0.06);
    box(0.55, 0.15, 0.09, trim, 5.2, 2.75, side * 1.52, bus, 0.04);
    box(0.36, 0.56, 0.18, paint, 5.5, 2.6, side * 1.67, bus, 0.08);
    box(0.015, 0.42, 0.16, chrome, 5.31, 2.6, side * 1.67, bus);
  }
  const wheels = [];
  for (const x of [-3.8, -2.55, 3.8])
    for (const side of [-1, 1]) {
      const wheel = new THREE.Group();
      wheel.position.set(x, 0.56, side * 1.21);
      bus.add(wheel);
      wheels.push(wheel);
      const tire = mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.34, 40), rubber, 0, 0, 0, wheel);
      tire.rotation.x = Math.PI / 2;
      const rim = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.36, 32), chrome, 0, 0, 0, wheel);
      rim.rotation.x = Math.PI / 2;
      const hub = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.38, 24), trim, 0, 0, 0, wheel);
      hub.rotation.x = Math.PI / 2;
      for (let a = 0; a < 8; a++) {
        const theta = (a * Math.PI) / 4;
        mesh(
          new THREE.SphereGeometry(0.038, 8, 6),
          trim,
          Math.cos(theta) * 0.245,
          Math.sin(theta) * 0.245,
          side * 0.19,
          wheel,
        );
      }
    }
  // Natural uneven terrain and varied deciduous trees replace repeated cone primitives.
  const hillMat = mat('#6d795a', 1);
  for (let i = 0; i < 16; i++) {
    const geo = new THREE.SphereGeometry(1, 36, 20);
    const hill = mesh(geo, hillMat, (i - 8) * 45, -15, -70 - random() * 130);
    hill.scale.set(45 + random() * 45, 22 + random() * 35, 40 + random() * 40);
    hill.castShadow = false;
  }
  const trunkMat = mat('#544937', 1),
    leaves = [mat('#465943', 1), mat('#53654a', 1), mat('#667653', 1)];
  const leafGeometry = new THREE.IcosahedronGeometry(1, 2),
    trunkGeometry = new THREE.CylinderGeometry(0.12, 0.22, 3, 7);
  const trees = new THREE.Group();
  scene.add(trees);
  for (let i = 0; i < 85; i++) {
    const tree = new THREE.Group();
    tree.position.set(random() * 440 - 220, 0, (i % 2 ? -1 : 1) * (12 + random() * 40));
    trees.add(tree);
    const size = 0.8 + random() * 1.5;
    tree.scale.setScalar(size);
    mesh(trunkGeometry, trunkMat, 0, 1.3, 0, tree);
    for (let j = 0; j < 4; j++) {
      const crown = mesh(
        leafGeometry,
        leaves[i % 3],
        (random() - 0.5) * 1.6,
        3 + random() * 1.7,
        (random() - 0.5) * 1.6,
        tree,
      );
      crown.scale.set(1.3 + random() * 0.8, 1.5 + random(), 1.3 + random() * 0.7);
    }
  }
  // Guardrail and roadside reflectors give scale and motion cues.
  const rail = mat('#929b9b', 0.45, 0.65);
  for (const side of [-1, 1]) {
    mesh(new THREE.BoxGeometry(600, 0.25, 0.08), rail, 0, 0.75, side * 6.5);
    for (let x = -230; x < 230; x += 8) {
      mesh(new THREE.BoxGeometry(0.1, 0.85, 0.13), rail, x, 0.32, side * 6.5, moving);
      box(0.1, 0.16, 0.08, white, x, 0.93, side * 6.5, moving);
    }
  }
  const resize = () => {
    camera.aspect = host.clientWidth / Math.max(host.clientHeight, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  let visible = true,
    last = 0,
    elapsed = 0,
    frame;
  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    last = 0;
  });
  io.observe(host);
  function animate(now) {
    frame = requestAnimationFrame(animate);
    if (!visible || document.hidden) {
      last = 0;
      return;
    }
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    elapsed += dt;
    const distance = elapsed * 5;
    moving.position.x = -(distance % 40);
    trees.children.forEach((tree) => {
      tree.position.x -= dt * 5;
      if (tree.position.x < -220) tree.position.x += 440;
    });
    asphalt.offset.x = (distance / 600) * 85;
    grass.offset.x = (distance / 600) * 45;
    wheels.forEach((w) => (w.rotation.z = -distance / 0.56));
    bus.position.y = Math.sin(elapsed * 2) * 0.009;
    camera.position.y = 10 + Math.sin(elapsed * 0.17) * 0.18;
    renderer.render(scene, camera);
  }
  renderer.render(scene, camera);
  host.append(renderer.domElement);
  host.classList.add('scene-ready');
  frame = requestAnimationFrame(animate);
  addEventListener(
    'pagehide',
    () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      const geometries = new Set();
      scene.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      asphalt.dispose();
      grass.dispose();
      environment.dispose();
      renderer.dispose();
    },
    { once: true },
  );
}
