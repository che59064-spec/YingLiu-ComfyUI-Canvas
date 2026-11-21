/* 映流 · 3D 导演台：影棚级摆位预演。摆人、道具、机位取景、灯光氛围、截图成图卡。 */
(function () {
  'use strict';

  const PALETTE = ['#5b8def', '#e8b84b', '#58b98a', '#d977a9', '#9b7bde', '#48b8c9'];
  const ASPECTS = {'16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4};
  const ASPECT_LABELS = {'16:9': '16:9 横屏', '9:16': '9:16 竖屏', '1:1': '1:1 方图', '4:3': '4:3 横屏', '3:4': '3:4 竖屏'};
  const DEG = Math.PI / 180;
  const POSES = {
    stand: {label: '站立', rootY: 0, lShoulder: [0, 0, -7], lElbow: [-8, 0, 0], rShoulder: [0, 0, 7], rElbow: [-8, 0, 0], lHip: [0, 0, -2], rHip: [0, 0, 2]},
    tpose: {label: 'T 字', rootY: 0, lShoulder: [0, 0, -90], rShoulder: [0, 0, 90]},
    walk: {label: '走路', rootY: 0, torso: [3, 0, 0], lShoulder: [22, 0, -7], lElbow: [-20, 0, 0], rShoulder: [-24, 0, 7], rElbow: [-16, 0, 0], lHip: [-24, 0, -2], lKnee: [12, 0, 0], rHip: [22, 0, 2], rKnee: [6, 0, 0]},
    run: {label: '跑步', rootY: 0, torso: [12, 0, 0], lShoulder: [58, 0, -10], lElbow: [-80, 0, 0], rShoulder: [-58, 0, 10], rElbow: [-80, 0, 0], lHip: [-52, 0, -3], lKnee: [58, 0, 0], rHip: [38, 0, 3], rKnee: [42, 0, 0]},
    crouch: {label: '蹲下', rootY: -0.25, torso: [18, 0, 0], lShoulder: [-24, 0, -10], lElbow: [-50, 0, 0], rShoulder: [-24, 0, 10], rElbow: [-50, 0, 0], lHip: [-72, 0, -4], lKnee: [96, 0, 0], rHip: [-72, 0, 4], rKnee: [96, 0, 0]},
    wave: {label: '招手', rootY: 0, rShoulder: [0, 0, 142], rElbow: [0, 0, 32], lShoulder: [0, 0, -7], lElbow: [-8, 0, 0], head: [0, 0, -5]},
    point: {label: '指向前方', rootY: 0, rShoulder: [-88, 0, 8], rElbow: [0, 0, 0], lShoulder: [0, 0, -7], lElbow: [-8, 0, 0]},
    akimbo: {label: '叉腰', rootY: 0, lShoulder: [0, 0, -42], lElbow: [0, 0, 74], rShoulder: [0, 0, 42], rElbow: [0, 0, -74]},
    sit: {label: '坐下', rootY: -0.46, torso: [4, 0, 0], lShoulder: [-18, 0, -10], lElbow: [-46, 0, 0], rShoulder: [-18, 0, 10], rElbow: [-46, 0, 0], lHip: [-88, 0, -6], lKnee: [88, 0, 0], rHip: [-88, 0, 6], rKnee: [88, 0, 0]},
    kneel: {label: '单膝跪', rootY: -0.5, torso: [6, 0, 0], lShoulder: [-14, 0, -8], lElbow: [-34, 0, 0], rShoulder: [-14, 0, 8], rElbow: [-34, 0, 0], lHip: [-92, 0, -4], lKnee: [96, 0, 0], rHip: [-18, 0, 4], rKnee: [112, 0, 0]},
    cross: {label: '抱臂', rootY: 0, torso: [-2, 0, 0], lShoulder: [-34, 0, -34], lElbow: [-96, 0, 26], rShoulder: [-34, 0, 34], rElbow: [-96, 0, -26], head: [2, 0, 0]},
    lean: {label: '倚靠', rootY: 0, torso: [0, 0, 9], head: [0, 0, -7], lShoulder: [0, 0, -16], lElbow: [-14, 0, 0], rShoulder: [-30, 0, 26], rElbow: [-70, 0, 0], lHip: [0, 0, -6], rHip: [10, 0, 8], rKnee: [16, 0, 0]},
    think: {label: '思考', rootY: 0, torso: [4, 0, 0], head: [8, 0, -4], rShoulder: [-58, 0, 26], rElbow: [-118, 0, 0], lShoulder: [-20, 0, -16], lElbow: [-64, 0, 20], lHip: [0, 0, -2], rHip: [0, 0, 4]}
  };
  const PROP_TYPES = {
    box: {label: '方块', color: '#6b7688', size: [1, 1, 1]},
    cylinder: {label: '圆柱', color: '#7a6a58', size: [1, 1, 1]},
    sphere: {label: '球体', color: '#6f7f8c', size: [1, 1, 1]},
    table: {label: '桌子', color: '#8a7355', size: [1.6, 0.8, 0.9]},
    chair: {label: '椅子', color: '#8a7355', size: [0.5, 0.9, 0.5]},
    sofa: {label: '沙发', color: '#6b7688', size: [2, 0.85, 0.85]},
    wall: {label: '隔墙', color: '#59636f', size: [2.4, 2.2, 0.12]},
    doorway: {label: '门框', color: '#8a7355', size: [1.2, 2.2, 0.18]},
    stairs: {label: '台阶', color: '#59636f', size: [1.5, 0.8, 1.6]},
    platform: {label: '地台', color: '#6f7f8c', size: [3, 0.3, 2]}
  };
  const FOCALS = [18, 24, 35, 50, 75];
  const SHOTS = {
    wide: {label: '远景', dist: 9.5, fov: 52},
    full: {label: '全景', dist: 6.2, fov: 40},
    medium: {label: '中景', dist: 4.0, fov: 40},
    close: {label: '近景', dist: 2.6, fov: 50},
    extreme: {label: '特写', dist: 1.7, fov: 64}
  };
  const QUALITY = {
    low: {label: '流畅', ratio: 1, shadow: 512, particles: 140},
    medium: {label: '均衡', ratio: 1.5, shadow: 1024, particles: 260},
    high: {label: '精细', ratio: 2, shadow: 2048, particles: 420}
  };
  const ENV_DEFAULT = {
    grid: true, wireframe: false, frustums: true,
    lightAngle: 38, lightHeight: 52, lightIntensity: 3.4, lightColor: '#fff1de', ambient: 1.5,
    fog: 0.45, particles: 0.5, glow: 1.0, floor: 0.55, quality: 'high'
  };

  let THREE = null;
  let threePromise = null;
  let editor = null;
  let uiBound = false;
  let poseThumbs = null;
  let GEO = null;

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const clamp = (value, min, max, fallback = min) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };
  const sid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const clone = value => JSON.parse(JSON.stringify(value));
  const deg = value => (Number(value) || 0) * DEG;
  const round = value => Math.round(Number(value) * 10) / 10;
  const isColor = value => /^#[0-9a-f]{6}$/i.test(String(value || ''));

  function defaultStage() {
    return {
      version: 1,
      actors: [{id: sid('actor'), name: '角色1', color: PALETTE[0], x: 0, y: 0, z: 0, rotation: 0, scale: 1, pose: 'stand', visible: true, locked: false}],
      cameras: [{id: sid('camera'), name: '机位1', position: [4.1, 2.1, 4.7], target: [0, 1.05, 0], fov: 40}],
      activeCamera: 'free',
      aspect: '16:9',
      props: [],
      motion: {duration: 5, easing: 'smooth', start: null, end: null},
      environment: {...ENV_DEFAULT}
    };
  }

  function normalizeEnvironment(source) {
    const env = source && typeof source === 'object' ? source : {};
    return {
      grid: env.grid !== false,
      wireframe: env.wireframe === true,
      frustums: env.frustums !== false,
      lightAngle: clamp(env.lightAngle, 0, 360, ENV_DEFAULT.lightAngle),
      lightHeight: clamp(env.lightHeight, 8, 85, ENV_DEFAULT.lightHeight),
      lightIntensity: clamp(env.lightIntensity, 0, 7, ENV_DEFAULT.lightIntensity),
      lightColor: isColor(env.lightColor) ? String(env.lightColor) : ENV_DEFAULT.lightColor,
      ambient: clamp(env.ambient, 0, 4, ENV_DEFAULT.ambient),
      fog: clamp(env.fog, 0, 1, ENV_DEFAULT.fog),
      particles: clamp(env.particles, 0, 1, ENV_DEFAULT.particles),
      glow: clamp(env.glow, 0, 2, ENV_DEFAULT.glow),
      floor: clamp(env.floor, 0, 1, ENV_DEFAULT.floor),
      quality: QUALITY[env.quality] ? env.quality : ENV_DEFAULT.quality
    };
  }

  function normalize(stage) {
    const base = defaultStage();
    if (!stage || typeof stage !== 'object') return base;
    const usedActors = new Set();
    const actors = (Array.isArray(stage.actors) ? stage.actors : []).slice(0, 12).map((actor, index) => {
      let id = String(actor?.id || '');
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || usedActors.has(id)) id = sid('actor');
      usedActors.add(id);
      return {
        id,
        name: String(actor?.name || `角色${index + 1}`).slice(0, 24),
        color: isColor(actor?.color) ? String(actor.color) : PALETTE[index % PALETTE.length],
        x: clamp(actor?.x, -14, 14, 0),
        y: clamp(actor?.y, 0, 10, 0),
        z: clamp(actor?.z, -14, 14, 0),
        rotation: clamp(actor?.rotation, -Math.PI * 4, Math.PI * 4, 0),
        scale: clamp(actor?.scale, 0.6, 1.4, 1),
        pose: POSES[actor?.pose] ? actor.pose : 'stand',
        visible: actor?.visible !== false,
        locked: actor?.locked === true
      };
    });
    const usedProps = new Set();
    const props = (Array.isArray(stage.props) ? stage.props : []).slice(0, 16).map((prop, index) => {
      let id = String(prop?.id || '');
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || usedProps.has(id)) id = sid('prop');
      usedProps.add(id);
      const type = Object.hasOwn(PROP_TYPES, prop?.type) ? prop.type : 'box';
      return {
        id,
        name: String(prop?.name || `${PROP_TYPES[type].label}${index + 1}`).slice(0, 24),
        type,
        color: isColor(prop?.color) ? String(prop.color) : PROP_TYPES[type].color,
        x: clamp(prop?.x, -14, 14, 0),
        y: clamp(prop?.y, 0, 10, 0),
        z: clamp(prop?.z, -14, 14, 0),
        rotation: clamp(prop?.rotation, -Math.PI * 4, Math.PI * 4, 0),
        scale: clamp(prop?.scale, 0.4, 3, 1),
        width: clamp(prop?.width, 0.1, 10, PROP_TYPES[type].size[0]),
        height: clamp(prop?.height, 0.1, 10, PROP_TYPES[type].size[1]),
        depth: clamp(prop?.depth, 0.1, 10, PROP_TYPES[type].size[2]),
        visible: prop?.visible !== false,
        locked: prop?.locked === true
      };
    });
    const usedCameras = new Set();
    let cameras = (Array.isArray(stage.cameras) ? stage.cameras : []).slice(0, 8).map((camera, index) => {
      let id = String(camera?.id || '');
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || usedCameras.has(id)) id = sid('camera');
      usedCameras.add(id);
      const position = Array.isArray(camera?.position) && camera.position.length >= 3
        ? camera.position.slice(0, 3).map(value => clamp(value, -40, 40, 0))
        : base.cameras[0].position.slice();
      const target = Array.isArray(camera?.target) && camera.target.length >= 3
        ? camera.target.slice(0, 3).map(value => clamp(value, -40, 40, 0))
        : base.cameras[0].target.slice();
      return {
        id,
        name: String(camera?.name || `机位${index + 1}`).slice(0, 24),
        position,
        target,
        fov: clamp(camera?.fov, 18, 85, 40)
      };
    });
    if (!cameras.length) cameras = [{...base.cameras[0], id: 'camera-default'}];
    return {
      version: 1,
      actors,
      cameras,
      activeCamera: stage.activeCamera === 'free' ? 'free' : cameras.some(camera => camera.id === stage.activeCamera) ? stage.activeCamera : 'free',
      aspect: ASPECTS[stage.aspect] ? stage.aspect : '16:9',
      props,
      motion: normalizeMotion(stage.motion),
      environment: normalizeEnvironment(stage.environment)
    };
  }

  function normalizeMotion(source) {
    const frame = value => {
      if (!value || !Array.isArray(value.actors) || !Array.isArray(value.props) || !value.camera) return null;
      const scene = normalize({actors: value.actors, props: value.props, cameras: [value.camera]});
      return {actors: scene.actors, props: scene.props, camera: scene.cameras[0]};
    };
    return {duration: clamp(source?.duration, 1, 30, 5), easing: source?.easing === 'linear' ? 'linear' : 'smooth', start: frame(source?.start), end: frame(source?.end)};
  }

  function motionFrame(motion, time) {
    let amount = clamp(time / motion.duration, 0, 1, 0);
    if (motion.easing === 'smooth') amount = amount * amount * (3 - 2 * amount);
    const mix = (a, b) => a + (b - a) * amount;
    const objects = kind => motion.start[kind].map(a => {
      const b = motion.end[kind].find(item => item.id === a.id);
      const item = {...(amount === 1 ? b : a)};
      for (const key of ['x', 'y', 'z', 'rotation', 'scale', ...(kind === 'props' ? ['width', 'height', 'depth'] : [])]) item[key] = mix(a[key], b[key]);
      return item;
    });
    const a = motion.start.camera, b = motion.end.camera;
    return {amount, actors: objects('actors'), props: objects('props'), camera: {
      position: a.position.map((value, i) => mix(value, b.position[i])),
      target: a.target.map((value, i) => mix(value, b.target[i])), fov: mix(a.fov, b.fov)
    }};
  }

  function loadThree() {
    if (THREE) return Promise.resolve(THREE);
    if (!threePromise) threePromise = import('/vendor/three.module.js').then(module => {
      THREE = module;
      return module;
    }).catch(error => {
      threePromise = null;
      throw error;
    });
    return threePromise;
  }

  /* ---------- 共享几何体：所有人偶复用，避免重复构建 ---------- */
  function geometries() {
    if (GEO) return GEO;
    GEO = {
      pelvis: new THREE.CapsuleGeometry(0.13, 0.12, 6, 18),
      chest: new THREE.CapsuleGeometry(0.16, 0.26, 6, 20),
      neck: new THREE.CylinderGeometry(0.05, 0.058, 0.1, 14),
      head: new THREE.SphereGeometry(0.125, 26, 20),
      shoulder: new THREE.SphereGeometry(0.068, 18, 14),
      upperArm: new THREE.CapsuleGeometry(0.055, 0.19, 6, 16),
      elbow: new THREE.SphereGeometry(0.055, 16, 12),
      forearm: new THREE.CapsuleGeometry(0.047, 0.17, 6, 16),
      hand: new THREE.SphereGeometry(0.062, 16, 12),
      hip: new THREE.SphereGeometry(0.078, 18, 14),
      thigh: new THREE.CapsuleGeometry(0.078, 0.22, 6, 18),
      knee: new THREE.SphereGeometry(0.068, 16, 12),
      shin: new THREE.CapsuleGeometry(0.06, 0.23, 6, 18),
      foot: new THREE.BoxGeometry(0.115, 0.07, 0.25),
      propBox: new THREE.BoxGeometry(1, 1, 1),
      propCyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 28),
      propSphere: new THREE.SphereGeometry(0.5, 28, 20),
      propTop: new THREE.BoxGeometry(1.6, 0.08, 0.9),
      propLeg: new THREE.CylinderGeometry(0.05, 0.05, 0.72, 12),
      propWall: new THREE.BoxGeometry(2.4, 2.2, 0.12)
    };
    return GEO;
  }

  function buildMannequin(actor) {
    const g = geometries();
    const root = new THREE.Group();
    root.userData.actorId = actor.id;
    const base = new THREE.Color(actor.color);
    const bodyMat = new THREE.MeshStandardMaterial({color: base, roughness: 0.5, metalness: 0.08, envMapIntensity: 0.7});
    const accentMat = new THREE.MeshStandardMaterial({color: base.clone().multiplyScalar(0.62), roughness: 0.38, metalness: 0.16, envMapIntensity: 0.9});
    const joints = {};
    const add = (parent, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    add(root, g.pelvis, bodyMat, 0, 0.95, 0, 1.16, 1, 0.82);

    const torso = new THREE.Group();
    torso.position.set(0, 0.98, 0);
    root.add(torso);
    joints.torso = torso;
    add(torso, g.chest, bodyMat, 0, 0.27, 0, 1.04, 1, 0.82);
    add(torso, g.neck, accentMat, 0, 0.5, 0);

    const head = new THREE.Group();
    head.position.set(0, 0.56, 0);
    torso.add(head);
    joints.head = head;
    add(head, g.head, bodyMat, 0, 0.13, 0, 0.94, 1.06, 0.96);

    function arm(side) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.21, 0.42, 0);
      torso.add(shoulder);
      joints[side < 0 ? 'lShoulder' : 'rShoulder'] = shoulder;
      add(shoulder, g.shoulder, accentMat, 0, 0, 0);
      add(shoulder, g.upperArm, bodyMat, 0, -0.15, 0);
      const elbow = new THREE.Group();
      elbow.position.set(0, -0.3, 0);
      shoulder.add(elbow);
      joints[side < 0 ? 'lElbow' : 'rElbow'] = elbow;
      add(elbow, g.elbow, accentMat, 0, 0, 0);
      add(elbow, g.forearm, bodyMat, 0, -0.135, 0);
      add(elbow, g.hand, accentMat, 0, -0.27, 0, 0.86, 1.12, 0.7);
    }
    arm(-1);
    arm(1);

    function leg(side) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.105, 0.95, 0);
      root.add(hip);
      joints[side < 0 ? 'lHip' : 'rHip'] = hip;
      add(hip, g.hip, accentMat, 0, 0, 0);
      add(hip, g.thigh, bodyMat, 0, -0.215, 0);
      const knee = new THREE.Group();
      knee.position.set(0, -0.43, 0);
      hip.add(knee);
      joints[side < 0 ? 'lKnee' : 'rKnee'] = knee;
      add(knee, g.knee, accentMat, 0, 0, 0);
      add(knee, g.shin, bodyMat, 0, -0.215, 0);
      add(knee, g.foot, accentMat, 0, -0.475, 0.055);
    }
    leg(-1);
    leg(1);

    root.userData.joints = joints;
    root.userData.bodyMaterials = [bodyMat, accentMat];
    applyPose(root, actor.pose || 'stand');
    return root;
  }

  function buildProp(prop) {
    const g = geometries();
    const root = new THREE.Group();
    root.userData.propId = prop.id;
    const mat = new THREE.MeshStandardMaterial({color: new THREE.Color(prop.color), roughness: 0.62, metalness: 0.1, envMapIntensity: 0.6});
    const add = (geometry, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      return mesh;
    };
    if (prop.type === 'box') add(g.propBox, 0, 0.5, 0);
    else if (prop.type === 'cylinder') add(g.propCyl, 0, 0.5, 0);
    else if (prop.type === 'sphere') add(g.propSphere, 0, 0.5, 0);
    else if (prop.type === 'wall') add(g.propWall, 0, 1.1, 0);
    else if (prop.type === 'table') {
      add(g.propTop, 0, 0.76, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g.propLeg, sx * 0.72, 0.36, sz * 0.36);
    } else if (prop.type === 'chair') {
      add(g.propBox, 0, 0.43, 0, 0.5, 0.08, 0.5);
      add(g.propBox, 0, 0.68, -0.21, 0.5, 0.44, 0.08);
      for (const x of [-0.2, 0.2]) for (const z of [-0.2, 0.2]) add(g.propBox, x, 0.2, z, 0.06, 0.4, 0.06);
    } else if (prop.type === 'sofa') {
      add(g.propBox, 0, 0.25, 0, 2, 0.3, 0.85);
      add(g.propBox, 0, 0.65, -0.325, 2, 0.4, 0.2);
      for (const x of [-0.9, 0.9]) add(g.propBox, x, 0.525, 0, 0.2, 0.25, 0.85);
      for (const x of [-0.4, 0.4]) add(g.propBox, x, 0.44, 0.1, 0.78, 0.08, 0.6);
      for (const x of [-0.8, 0.8]) for (const z of [-0.3, 0.3]) add(g.propBox, x, 0.05, z, 0.12, 0.1, 0.12);
    } else if (prop.type === 'doorway') {
      for (const x of [-0.54, 0.54]) add(g.propBox, x, 1.1, 0, 0.12, 2.2, 0.18);
      add(g.propBox, 0, 2.14, 0, 0.96, 0.12, 0.18);
    } else if (prop.type === 'stairs') {
      for (let i = 0; i < 4; i++) add(g.propBox, 0, (i + 1) * 0.1, 0.6 - i * 0.4, 1.5, (i + 1) * 0.2, 0.4);
    } else if (prop.type === 'platform') {
      add(g.propBox, 0, 0.15, 0, 3, 0.3, 2);
    }
    root.userData.bodyMaterials = [mat];
    return root;
  }

  function applyPose(root, poseName) {
    const pose = POSES[poseName] || POSES.stand;
    const joints = root.userData.joints;
    for (const key of Object.keys(joints)) {
      const rotation = pose[key] || [0, 0, 0];
      joints[key].rotation.set(deg(rotation[0]), deg(rotation[1]), deg(rotation[2]));
    }
    root.position.y = pose.rootY || 0;
  }

  function disposeMaterials(root) {
    root.traverse(object => {
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      materials.forEach(material => material.dispose?.());
    });
    root.parent?.remove(root);
  }

  function disposeDeep(root) {
    root.traverse(object => {
      object.geometry?.dispose?.();
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      materials.forEach(material => material.dispose?.());
    });
    root.parent?.remove(root);
  }

  /* ---------- 程序化影棚环境贴图（一次烘焙，逐帧复用） ---------- */
  function makeEnvTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#20293a');
    grad.addColorStop(0.42, '#2b3547');
    grad.addColorStop(0.55, '#333d4f');
    grad.addColorStop(0.72, '#161b24');
    grad.addColorStop(1, '#0a0d12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
    const warm = ctx.createRadialGradient(150, 96, 8, 150, 96, 150);
    warm.addColorStop(0, 'rgba(255,214,160,.55)');
    warm.addColorStop(1, 'rgba(255,214,160,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, 512, 256);
    const cool = ctx.createRadialGradient(400, 120, 8, 400, 120, 160);
    cool.addColorStop(0, 'rgba(120,170,255,.34)');
    cool.addColorStop(1, 'rgba(120,170,255,0)');
    ctx.fillStyle = cool;
    ctx.fillRect(0, 0, 512, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function makePoolTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 6, 128, 128, 126);
    grad.addColorStop(0, 'rgba(255,226,180,.85)');
    grad.addColorStop(0.4, 'rgba(255,206,150,.28)');
    grad.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function bindUi() {
    if (uiBound) return;
    uiBound = true;
    const view = $('#stage-view');
    if (!view) return;
    $('#stage-prop-type').innerHTML = propOptions('box');
    view.addEventListener('click', onUiClick);
    view.addEventListener('dblclick', onUiDoubleClick);
    view.addEventListener('input', onUiInput);
    view.addEventListener('change', onUiChange);
    view.addEventListener('toggle', event => {
      if (!editor || !event.target.isConnected) return;
      if (event.target.hasAttribute('data-stage-precise')) editor.preciseOpen = event.target.open;
      if (event.target.id === 'stage-motion') {
        $('[data-stage-action="motion-open"]')?.setAttribute('aria-expanded', String(event.target.open));
        resizeStage();
      }
    }, true);
    $('#stage-canvas')?.addEventListener('pointerdown', onPointerDown);
    $('#stage-canvas')?.addEventListener('wheel', onWheel, {passive: false});
    $('#stage-canvas')?.addEventListener('contextmenu', event => event.preventDefault());
    $('#stage-capture-modal')?.addEventListener('click', event => {
      if (event.target.id === 'stage-capture-modal') { closeCapture(); return; }
      onUiClick(event);
    });
    $('#stage-capture-modal')?.addEventListener('input', onUiInput);
    $('#stage-capture-modal')?.addEventListener('change', onUiChange);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', () => resizeStage());
  }

  function open(card, host) {
    if (!card || card.type !== 'stage') return;
    if (editor) close(true);
    const view = $('#stage-view');
    if (!view) return;
    const stage = normalize(card.stage);
    card.stage = stage;
    editor = {
      card,
      host: host || {},
      stage,
      view,
      selected: null,
      tab: 'props',
      viewMode: 'free',
      topDown: false,
      transformMode: 'move',
      dockSection: 'lens',
      preciseOpen: false,
      orbit: {theta: Math.PI * 0.28, phi: Math.PI * 0.42, radius: 4.6, target: null},
      orbitGoal: {theta: Math.PI * 0.28, phi: Math.PI * 0.42, radius: 4.6, target: null},
      history: [],
      historyIndex: 0,
      gesture: null,
      dirty: false,
      renderer: null,
      scene: null,
      camera: null,
      actorGroup: null,
      propGroup: null,
      helpers: {},
      labels: new Map(),
      raycaster: null,
      pointer: null,
      labelVector: null,
      resizeObserver: null,
      frame: 0,
      captureBusy: false,
      motionPreview: null,
      motionJob: null,
      envMap: null,
      envRT: null,
      envTexture: null,
      poolTexture: null,
      particles: null,
      particleSeed: null,
      lastTime: 0,
      mode2d: false,
      canvas2d: null,
      ctx2d: null
    };
    bindUi();
    view.hidden = false;
    view.classList.add('is-open', 'is-loading');
    document.documentElement.classList.add('stage-open');
    $('#stage-title') && ($('#stage-title').textContent = card.name || '导演台');
    const props = $('#stage-props-body');
    if (props) props.innerHTML = '<div class="stage-empty"><strong>正在准备 3D 舞台</strong><p>第一次打开会载入本地 3D 组件。</p></div>';
    $('#stage-capture-modal')?.setAttribute('hidden', '');
    resetHistory();
    syncChrome();
    renderTools();
    refreshMotionTargets();
    const session = editor;
    loadThree().then(() => {
      if (!editor || editor !== session) return;
      try {
        initThree();
      } catch (error) {
        console.warn('WebGL 不可用，切换到 2D 兼容模式', error);
        init2D();
      }
      rebuildScene();
      buildTree();
      renderProps();
      renderDock();
      syncView();
      view.classList.remove('is-loading');
      requestAnimationFrame(resizeStage);
    }).catch(error => {
      console.error(error);
      if (!editor || editor !== session) return;
      init2D();
      rebuildScene();
      buildTree();
      renderProps();
      renderDock();
      syncView();
      view.classList.remove('is-loading');
      requestAnimationFrame(resizeStage);
      host?.toast?.('3D 组件未载入，已切换到 2D 兼容模式');
    });
  }

  function close(force = false) {
    if (!editor) return;
    const current = editor;
    cancelMotionExport();
    editor = null;
    cancelAnimationFrame(current.frame);
    current.resizeObserver?.disconnect();
    if (current.renderer) {
      current.renderer.dispose();
      current.renderer.forceContextLoss?.();
      current.renderer.domElement?.remove();
    }
    current.canvas2d?.remove();
    if (current.scene) disposeDeep(current.scene);
    current.envRT?.dispose?.();
    current.envTexture?.dispose?.();
    current.poolTexture?.dispose?.();
    if (GEO) {
      Object.values(GEO).forEach(geometry => geometry.dispose?.());
      GEO = null;
    }
    current.labels?.forEach(label => label.remove());
    current.labels?.clear();
    const view = current.view;
    if (view) {
      view.classList.remove('is-open', 'is-loading', 'is-2d', 'previewing', 'is-exporting');
      view.hidden = true;
    }
    const labels = $('#stage-labels');
    if (labels) labels.hidden = false;
    $('#stage-capture-modal')?.setAttribute('hidden', '');
    document.documentElement.classList.remove('stage-open');
    if (!force && current.dirty) current.host?.onChange?.();
  }

  function initThree() {
    const host = $('#stage-canvas');
    if (!host) throw new Error('导演台画布没有准备好');
    const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
    const quality = QUALITY[editor.stage.environment.quality] || QUALITY.high;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.ratio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.domElement.className = 'stage-webgl';
    host.insertBefore(renderer.domElement, host.firstChild);

    const scene = new THREE.Scene();
    const envTexture = makeEnvTexture();
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envRT = pmrem.fromEquirectangular(envTexture);
    pmrem.dispose();
    scene.background = envTexture;
    scene.environment = envRT.texture;
    scene.fog = new THREE.Fog('#161b24', 18, 46);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 140);

    const hemi = new THREE.HemisphereLight(0xc8d8ff, 0x0a0c10, 1.5);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff1de, 3.4);
    key.castShadow = true;
    key.shadow.mapSize.set(quality.shadow, quality.shadow);
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 40;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    key.shadow.camera.updateProjectionMatrix();
    scene.add(key);
    scene.add(key.target);
    const fill = new THREE.DirectionalLight(0x8fb4ff, 0.85);
    fill.position.set(-7, 4, -3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffc98a, 0.9);
    rim.position.set(0, 5, -8);
    scene.add(rim);

    const floorMat = new THREE.MeshStandardMaterial({color: 0x0e1219, roughness: 0.32, metalness: 0.28, envMapIntensity: 0.9});
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const poolTexture = makePoolTexture();
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 15),
      new THREE.MeshBasicMaterial({map: poolTexture, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false})
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.012;
    scene.add(pool);

    const grid = new THREE.GridHelper(30, 30, 0x46536b, 0x232a35);
    grid.position.y = 0.004;
    grid.material.transparent = true;
    grid.material.opacity = 0.55;
    scene.add(grid);

    const shaft = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 11, 32, 1, true),
      new THREE.MeshBasicMaterial({color: 0xffd9a0, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide})
    );
    scene.add(shaft);

    const actorGroup = new THREE.Group();
    scene.add(actorGroup);
    const propGroup = new THREE.Group();
    scene.add(propGroup);
    const frustums = new THREE.Group();
    scene.add(frustums);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.4, 56),
      new THREE.MeshBasicMaterial({color: 0xf0a43a, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false})
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.visible = false;
    scene.add(ring);

    const particleCount = 420;
    const positions = new Float32Array(particleCount * 3);
    const seed = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = Math.random() * 7;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 22;
      seed[i * 3] = Math.random() * Math.PI * 2;
      seed[i * 3 + 1] = 0.12 + Math.random() * 0.3;
      seed[i * 3 + 2] = 0.3 + Math.random() * 0.7;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({
      color: 0xffe6c0, size: 0.045, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    }));
    particles.frustumCulled = false;
    scene.add(particles);

    editor.renderer = renderer;
    editor.scene = scene;
    editor.camera = camera;
    editor.raycaster = new THREE.Raycaster();
    editor.pointer = new THREE.Vector2();
    editor.labelVector = new THREE.Vector3();
    editor.actorGroup = actorGroup;
    editor.propGroup = propGroup;
    editor.envTexture = envTexture;
    editor.envRT = envRT;
    editor.envMap = envRT.texture;
    editor.poolTexture = poolTexture;
    editor.particles = particles;
    editor.particleSeed = seed;
    editor.helpers = {grid, floor, floorMat, pool, ring, key, hemi, fill, rim, shaft, frustums};
    editor.orbit.target = new THREE.Vector3(0, 1.05, 0);
    editor.orbitGoal.target = new THREE.Vector3(0, 1.05, 0);
    editor.resizeObserver = new ResizeObserver(() => resizeStage());
    const viewport = $('#stage-viewport');
    if (viewport) editor.resizeObserver.observe(viewport);
    applyEnvironment();
    snapOrbit();
    resizeStage();
    loop(0);
  }

  /* ---------- 2D 兼容模式：无 WebGL 时仍可摆位与截图 ---------- */
  function init2D() {
    const host = $('#stage-canvas');
    if (!host) return;
    editor.mode2d = true;
    editor.view?.classList.add('is-2d');
    const canvas = document.createElement('canvas');
    canvas.className = 'stage-webgl stage-2d';
    host.insertBefore(canvas, host.firstChild);
    editor.canvas2d = canvas;
    editor.ctx2d = canvas.getContext('2d');
    editor.camera = {fov: 45, aspect: 1, position: {x: 0, y: 0, z: 0}, updateProjectionMatrix() {}, lookAt() {}};
    editor.orbit.target = {x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; }, copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; }, addScaledVector() { return this; }, clone() { return {x: this.x, y: this.y, z: this.z}; }};
    editor.orbitGoal.target = editor.orbit.target;
    editor.resizeObserver = new ResizeObserver(() => resizeStage());
    const viewport = $('#stage-viewport');
    if (viewport) editor.resizeObserver.observe(viewport);
    resizeStage();
    loop(0);
  }

  function loop(time) {
    if (!editor) return;
    editor.frame = requestAnimationFrame(loop);
    const dt = Math.min(0.05, editor.lastTime ? (time - editor.lastTime) / 1000 : 0.016);
    editor.lastTime = time;
    if (editor.mode2d) { draw2D(); return; }
    const preview = editor.motionPreview;
    if (preview) {
      if (preview.playing && !editor.motionJob) {
        preview.time = Math.min(editor.stage.motion.duration, (time - preview.startedAt) / 1000);
        applyMotionFrame(preview.time); updateMotionReadout();
        if (preview.time >= editor.stage.motion.duration) { preview.playing = false; renderMotionControls(); }
      }
    } else stepOrbit(dt);
    updateParticles(dt);
    editor.renderer.render(editor.scene, preview?.camera || editor.camera);
    if (!preview) updateLabels();
  }

  function stepOrbit(dt) {
    if (!editor || editor.viewMode !== 'free') return;
    const orbit = editor.orbit;
    const goal = editor.orbitGoal;
    const alpha = 1 - Math.exp(-dt * 11);
    orbit.theta += (goal.theta - orbit.theta) * alpha;
    orbit.phi += (goal.phi - orbit.phi) * alpha;
    orbit.radius += (goal.radius - orbit.radius) * alpha;
    orbit.target.lerp(goal.target, alpha);
    applyOrbit();
  }

  function snapOrbit() {
    if (!editor || editor.mode2d) return;
    const orbit = editor.orbit;
    const goal = editor.orbitGoal;
    orbit.theta = goal.theta;
    orbit.phi = goal.phi;
    orbit.radius = goal.radius;
    orbit.target.copy(goal.target);
    applyOrbit();
  }

  function updateParticles(dt) {
    const points = editor.particles;
    if (!points || !points.visible) return;
    const attr = points.geometry.getAttribute('position');
    const seed = editor.particleSeed;
    const count = attr.count;
    const t = editor.lastTime * 0.001;
    for (let i = 0; i < count; i++) {
      let y = attr.array[i * 3 + 1] + seed[i * 3 + 1] * dt;
      if (y > 7) y = 0;
      attr.array[i * 3 + 1] = y;
      attr.array[i * 3] += Math.sin(t * seed[i * 3 + 2] + seed[i * 3]) * dt * 0.12;
    }
    attr.needsUpdate = true;
  }

  function resizeStage() {
    if (!editor || !editor.camera) return;
    const wrap = $('#stage-viewport');
    const host = $('#stage-canvas');
    if (!wrap || !host) return;
    const pad = 26;
    if ((editor.viewMode === 'camera' || editor.motionPreview) && !editor.mode2d) {
      const ratio = ASPECTS[editor.stage.aspect] || 16 / 9;
      let width = Math.max(160, wrap.clientWidth - pad * 2);
      let height = width / ratio;
      if (height > wrap.clientHeight - pad * 2) {
        height = Math.max(160, wrap.clientHeight - pad * 2);
        width = height * ratio;
      }
      host.style.width = `${Math.round(width)}px`;
      host.style.height = `${Math.round(height)}px`;
      host.style.left = `${Math.round((wrap.clientWidth - width) / 2)}px`;
      host.style.top = `${Math.round((wrap.clientHeight - height) / 2)}px`;
      editor.camera.aspect = ratio;
    } else {
      host.style.width = '100%';
      host.style.height = '100%';
      host.style.left = '0px';
      host.style.top = '0px';
      editor.camera.aspect = Math.max(0.1, wrap.clientWidth / Math.max(1, wrap.clientHeight));
    }
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    if (editor.mode2d) {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      editor.canvas2d.width = Math.round(width * ratio);
      editor.canvas2d.height = Math.round(height * ratio);
      editor.canvas2d.style.width = '100%';
      editor.canvas2d.style.height = '100%';
      editor.ctx2d.setTransform(ratio, 0, 0, ratio, 0, 0);
      editor.viewWidth = width;
      editor.viewHeight = height;
      draw2D();
      updateBadge();
      return;
    }
    editor.renderer.setSize(width, height, false);
    editor.renderer.domElement.style.width = '100%';
    editor.renderer.domElement.style.height = '100%';
    editor.camera.updateProjectionMatrix();
    if (editor.viewMode === 'camera') syncShotCamera();
    updateLabels();
    updateBadge();
  }

  function applyOrbit() {
    if (!editor || editor.mode2d || editor.viewMode !== 'free') return;
    const orbit = editor.orbit;
    const sin = Math.sin(orbit.phi);
    editor.camera.position.set(
      orbit.target.x + orbit.radius * sin * Math.sin(orbit.theta),
      orbit.target.y + orbit.radius * Math.cos(orbit.phi),
      orbit.target.z + orbit.radius * sin * Math.cos(orbit.theta)
    );
    editor.camera.lookAt(orbit.target);
    editor.camera.fov = 45;
    editor.camera.updateProjectionMatrix();
    editor.camera.updateMatrixWorld();
  }

  function syncShotCamera() {
    if (!editor || editor.mode2d || editor.viewMode !== 'camera') return false;
    const camera = resolveShotCamera();
    if (!camera) return false;
    editor.camera.fov = camera.fov;
    editor.camera.aspect = ASPECTS[editor.stage.aspect] || 16 / 9;
    editor.camera.position.fromArray(camera.position);
    editor.camera.lookAt(new THREE.Vector3().fromArray(camera.target));
    editor.camera.updateProjectionMatrix();
    editor.camera.updateMatrixWorld();
    return true;
  }

  function resolveShotCamera() {
    if (!editor) return null;
    return editor.stage.cameras.find(camera => camera.id === editor.stage.activeCamera) || editor.stage.cameras[0] || null;
  }

  function setView(mode) {
    if (!editor) return;
    if (mode === 'camera' && !resolveShotCamera()) {
      editor.host?.toast?.('先添加一个机位');
      return;
    }
    editor.viewMode = mode === 'camera' ? 'camera' : 'free';
    if (editor.viewMode === 'camera') {
      editor.stage.activeCamera = resolveShotCamera().id;
      editor.topDown = false;
    }
    syncView();
    markDirty();
  }

  function syncView(refreshPanels = true) {
    if (!editor) return;
    $$('[data-stage-view]').forEach(button => {
      const active = button.dataset.stageView === editor.viewMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    syncCameraSelect();
    const guides = $('#stage-guides');
    if (guides) guides.hidden = editor.viewMode !== 'camera';
    resizeStage();
    if (editor.viewMode === 'camera') syncShotCamera(); else if (!editor.mode2d) { applyOrbit(); }
    if (editor.helpers.frustums) editor.helpers.frustums.visible = editor.viewMode === 'free' && editor.stage.environment.frustums !== false && !editor.mode2d;
    updateBadge();
    updateSelectionVisuals();
    buildTree();
    if (refreshPanels) { renderProps(); renderDock(); }
    renderTools();
    renderMotionControls();
  }

  function syncCameraSelect() {
    if (!editor) return;
    const select = $('#stage-camera-select');
    if (!select) return;
    select.hidden = editor.viewMode !== 'camera';
    select.innerHTML = editor.stage.cameras.map(camera => `<option value="${esc(camera.id)}"${camera.id === editor.stage.activeCamera ? ' selected' : ''}>${esc(camera.name)}</option>`).join('');
  }

  function updateBadge() {
    if (!editor) return;
    const badge = $('#stage-badge');
    if (!badge) return;
    const mode = editor.mode2d ? '2D 兼容' : editor.topDown ? '俯视' : editor.viewMode === 'camera' ? '机位' : '自由';
    if (editor.viewMode === 'camera') {
      const camera = resolveShotCamera();
      badge.textContent = `${camera?.name || '机位'} · ${Math.round(camera?.fov || 40)}° · ${editor.stage.aspect}`;
    } else {
      badge.textContent = `${mode}视角 · ${editor.stage.aspect}`;
    }
  }

  /* ---------- 灯光 / 氛围 / 显示：实时应用 ---------- */
  function applyEnvironment() {
    if (!editor || editor.mode2d) return;
    const env = editor.stage.environment;
    const h = editor.helpers;
    const azimuth = deg(env.lightAngle);
    const elevation = deg(env.lightHeight);
    const radius = 10;
    h.key.position.set(Math.cos(azimuth) * Math.cos(elevation) * radius, Math.sin(elevation) * radius, Math.sin(azimuth) * Math.cos(elevation) * radius);
    h.key.target.position.set(0, 0.8, 0);
    h.key.intensity = env.lightIntensity;
    h.key.color.set(env.lightColor);
    h.hemi.intensity = env.ambient;
    h.rim.intensity = 0.5 + env.glow * 0.4;
    h.fill.intensity = 0.4 + env.ambient * 0.3;

    const fogAmount = env.fog;
    editor.scene.fog.near = 30 - fogAmount * 22;
    editor.scene.fog.far = 60 - fogAmount * 34;

    editor.renderer.toneMappingExposure = 0.72 + env.glow * 0.5;
    h.shaft.material.opacity = 0.02 + env.glow * 0.045;
    h.shaft.material.color.set(env.lightColor);
    const dir = new THREE.Vector3().subVectors(h.key.target.position, h.key.position).normalize();
    const mid = new THREE.Vector3().copy(h.key.position).addScaledVector(dir, 5.5);
    h.shaft.position.copy(mid);
    h.shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);

    h.floorMat.roughness = 0.66 - env.floor * 0.6;
    h.floorMat.metalness = env.floor * 0.42;
    h.floorMat.envMapIntensity = 0.4 + env.floor * 1.0;
    h.pool.material.opacity = 0.18 + env.floor * 0.5;

    h.grid.visible = env.grid !== false;
    const quality = QUALITY[env.quality] || QUALITY.high;
    const count = Math.round(quality.particles * env.particles);
    h.particlesVisible = count;
    editor.particles.geometry.setDrawRange(0, count);
    editor.particles.visible = count > 0;
    editor.particles.material.opacity = 0.28 + env.glow * 0.24;

    setWireframe(env.wireframe === true);
    if (h.frustums) h.frustums.visible = editor.viewMode === 'free' && env.frustums !== false;
    invalidateShadows();
  }

  function setWireframe(on) {
    if (!editor || editor.mode2d) return;
    for (const group of [editor.actorGroup, editor.propGroup]) {
      group?.children.forEach(root => (root.userData.bodyMaterials || []).forEach(material => { material.wireframe = on; }));
    }
  }

  function invalidateShadows() {
    if (editor?.renderer) editor.renderer.shadowMap.needsUpdate = true;
  }

  function setQuality() {
    if (!editor || editor.mode2d) return;
    const quality = QUALITY[editor.stage.environment.quality] || QUALITY.high;
    editor.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.ratio));
    const key = editor.helpers.key;
    if (key.shadow.mapSize.x !== quality.shadow) {
      key.shadow.mapSize.set(quality.shadow, quality.shadow);
      key.shadow.map?.dispose();
      key.shadow.map = null;
    }
    resizeStage();
    applyEnvironment();
  }

  /* ---------- 场景重建 ---------- */
  function rebuildScene() {
    if (!editor) return;
    if (editor.mode2d) { rebuildLabels(); draw2D(); return; }
    const group = editor.actorGroup;
    while (group.children.length) disposeMaterials(group.children[0]);
    for (const actor of editor.stage.actors) {
      const root = buildMannequin(actor);
      root.position.set(actor.x, actor.y + (POSES[actor.pose]?.rootY || 0), actor.z);
      root.rotation.y = actor.rotation;
      root.scale.setScalar(actor.scale);
      root.visible = actor.visible;
      group.add(root);
    }
    const propGroup = editor.propGroup;
    while (propGroup.children.length) disposeMaterials(propGroup.children[0]);
    for (const prop of editor.stage.props) {
      const root = buildProp(prop);
      root.position.set(prop.x, prop.y, prop.z);
      root.rotation.y = prop.rotation;
      const size = PROP_TYPES[prop.type].size;
      root.scale.set(prop.width / size[0] * prop.scale, prop.height / size[1] * prop.scale, prop.depth / size[2] * prop.scale);
      root.visible = prop.visible;
      propGroup.add(root);
    }
    rebuildLabels();
    buildFrustums();
    setWireframe(editor.stage.environment.wireframe === true);
    updateSelectionVisuals();
    updateLabels();
    invalidateShadows();
  }

  function rebuildLabels() {
    const labels = $('#stage-labels');
    if (labels) labels.innerHTML = '';
    editor.labels.clear();
    if (editor.mode2d) return;
    for (const actor of editor.stage.actors) {
      const label = document.createElement('div');
      label.className = 'stage-label';
      label.innerHTML = `<span class="stage-label-dot" style="--dot:${esc(actor.color)}"></span><span>${esc(actor.name)}</span>`;
      labels?.appendChild(label);
      editor.labels.set(actor.id, label);
    }
  }

  function buildFrustums() {
    const group = editor.helpers.frustums;
    if (!group) return;
    while (group.children.length) disposeDeep(group.children[0]);
    const aspect = ASPECTS[editor.stage.aspect] || 16 / 9;
    editor.stage.cameras.forEach((camera, index) => {
      const active = camera.id === editor.stage.activeCamera;
      const color = active ? 0xf0a43a : new THREE.Color(PALETTE[index % PALETTE.length]).getHex();
      const holder = new THREE.Group();
      holder.position.fromArray(camera.position);
      holder.lookAt(new THREE.Vector3().fromArray(camera.target));
      holder.rotateY(Math.PI); // Group.lookAt 朝 +Z，相机几何体朝 -Z。
      const near = 0.28;
      const far = 2.8;
      const tan = Math.tan(deg(camera.fov) / 2);
      const nh = near * tan, nw = nh * aspect;
      const fh = far * tan, fw = fh * aspect;
      const corners = [
        [-nw, nh, -near], [nw, nh, -near], [nw, -nh, -near], [-nw, -nh, -near],
        [-fw, fh, -far], [fw, fh, -far], [fw, -fh, -far], [-fw, -fh, -far]
      ];
      const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      const positions = [];
      for (const [a, b] of edges) positions.push(...corners[a], ...corners[b]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({color, transparent: true, opacity: active ? 0.95 : 0.5}));
      holder.add(lines);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.24), new THREE.MeshStandardMaterial({color, roughness: 0.4, metalness: 0.3, emissive: color, emissiveIntensity: active ? 0.5 : 0.14}));
      body.position.set(0, 0, 0.12);
      holder.add(body);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.12, 16), new THREE.MeshStandardMaterial({color: 0x11151c, roughness: 0.3, metalness: 0.5}));
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 0, -0.04);
      holder.add(lens);
      group.add(holder);
    });
    group.visible = editor.viewMode === 'free' && editor.stage.environment.frustums !== false;
  }

  function updateSelectionVisuals() {
    if (!editor || editor.mode2d) { if (editor?.mode2d) draw2D(); return; }
    const ring = editor.helpers.ring;
    const actor = selectedActor();
    const prop = selectedProp();
    const focus = actor || prop;
    if (ring) {
      if (focus && focus.visible && editor.viewMode === 'free') {
        ring.visible = true;
        ring.position.set(focus.x, 0.02, focus.z);
        ring.scale.setScalar(actor ? actor.scale : prop.scale);
        ring.material.color.set(actor ? 0xf0a43a : 0x48b8c9);
      } else {
        ring.visible = false;
      }
    }
    for (const root of editor.actorGroup?.children || []) {
      const active = actor && root.userData.actorId === actor.id;
      (root.userData.bodyMaterials || []).forEach(material => {
        if (material.emissive) material.emissive.set(active ? 0x1b3a5c : 0x000000);
      });
    }
    for (const root of editor.propGroup?.children || []) {
      const active = prop && root.userData.propId === prop.id;
      (root.userData.bodyMaterials || []).forEach(material => {
        if (material.emissive) material.emissive.set(active ? 0x123a3f : 0x000000);
      });
    }
  }

  function updateLabels() {
    if (!editor || editor.mode2d || !editor.camera) return;
    const host = $('#stage-canvas');
    if (!host) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    const show = editor.viewMode === 'free';
    for (const actor of editor.stage.actors) {
      const label = editor.labels.get(actor.id);
      if (!label) continue;
      if (!show || !actor.visible) { label.style.display = 'none'; continue; }
      const vector = editor.labelVector.set(actor.x, actor.y + (POSES[actor.pose]?.rootY || 0) + 1.95 * actor.scale, actor.z);
      vector.project(editor.camera);
      if (vector.z > 1) { label.style.display = 'none'; continue; }
      label.style.display = 'flex';
      label.style.transform = `translate(-50%,-100%) translate(${((vector.x * 0.5 + 0.5) * width).toFixed(1)}px,${((-vector.y * 0.5 + 0.5) * height).toFixed(1)}px)`;
    }
  }

  /* ---------- 2D 绘制 ---------- */
  function draw2D() {
    const ctx = editor?.ctx2d;
    if (!ctx) return;
    const width = editor.viewWidth || 800;
    const height = editor.viewHeight || 600;
    const env = editor.stage.environment;
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#1a2130');
    bg.addColorStop(1, '#0b0e13');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    const scale = Math.min(width, height) / 16;
    const cx = width / 2, cy = height / 2;
    const toScreen = (x, z) => [cx + x * scale, cy + z * scale];
    if (env.grid !== false) {
      ctx.strokeStyle = 'rgba(120,140,170,.16)';
      ctx.lineWidth = 1;
      for (let i = -8; i <= 8; i++) {
        const [gx] = toScreen(i, 0);
        const [, gz] = toScreen(0, i);
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, gz); ctx.lineTo(width, gz); ctx.stroke();
      }
    }
    if (env.frustums !== false) {
      editor.stage.cameras.forEach((camera, index) => {
        const [px, py] = toScreen(camera.position[0], camera.position[2]);
        const [tx, ty] = toScreen(camera.target[0], camera.target[2]);
        const angle = Math.atan2(ty - py, tx - px);
        const spread = deg(camera.fov) * 0.6;
        const len = 3.4 * scale;
        const active = camera.id === editor.stage.activeCamera;
        ctx.fillStyle = active ? 'rgba(240,164,58,.16)' : 'rgba(91,141,239,.1)';
        ctx.strokeStyle = active ? 'rgba(240,164,58,.8)' : 'rgba(91,141,239,.5)';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(angle - spread) * len, py + Math.sin(angle - spread) * len);
        ctx.lineTo(px + Math.cos(angle + spread) * len, py + Math.sin(angle + spread) * len);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = active ? '#f0a43a' : PALETTE[index % PALETTE.length];
        ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
      });
    }
    for (const prop of editor.stage.props) {
      if (!prop.visible) continue;
      const [px, py] = toScreen(prop.x, prop.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-prop.rotation);
      ctx.fillStyle = prop.color;
      ctx.globalAlpha = 0.85;
      const w = prop.width * prop.scale * scale, d = prop.depth * prop.scale * scale;
      if (prop.type === 'sphere' || prop.type === 'cylinder') { ctx.beginPath(); ctx.ellipse(0, 0, w / 2, d / 2, 0, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-w / 2, -d / 2, w, d);
      if (editor.selected?.type === 'prop' && editor.selected.id === prop.id) {
        ctx.strokeStyle = '#f0a43a'; ctx.lineWidth = 2;
        ctx.strokeRect(-w / 2 - 3, -d / 2 - 3, w + 6, d + 6);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e8edf6'; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(prop.name, 0, -d / 2 - 8);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    for (const actor of editor.stage.actors) {
      if (!actor.visible) continue;
      const [px, py] = toScreen(actor.x, actor.z);
      const selected = editor.selected?.type === 'actor' && editor.selected.id === actor.id;
      const r = 0.34 * actor.scale * scale;
      if (selected) {
        ctx.strokeStyle = '#f0a43a';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, r + 5, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = actor.color;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      const [hx, hy] = [px + Math.sin(actor.rotation) * r * 1.5, py - Math.cos(actor.rotation) * r * 1.5];
      ctx.strokeStyle = actor.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = '#e8edf6';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(actor.name, px, py - r - 8);
    }
    ctx.fillStyle = 'rgba(232,237,246,.5)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('2D 兼容模式 · 俯视摆位（无 WebGL）', 12, height - 12);
  }

  /* ---------- 选择 ---------- */
  function findActor(id) { return editor?.stage.actors.find(actor => actor.id === id) || null; }
  function findCamera(id) { return editor?.stage.cameras.find(camera => camera.id === id) || null; }
  function findProp(id) { return editor?.stage.props.find(prop => prop.id === id) || null; }
  function findActorRoot(id) { return editor?.actorGroup?.children.find(root => root.userData.actorId === id) || null; }
  function findPropRoot(id) { return editor?.propGroup?.children.find(root => root.userData.propId === id) || null; }
  function selectedActor() { return editor?.selected?.type === 'actor' ? findActor(editor.selected.id) : null; }
  function selectedCamera() { return editor?.selected?.type === 'camera' ? findCamera(editor.selected.id) : null; }
  function selectedProp() { return editor?.selected?.type === 'prop' ? findProp(editor.selected.id) : null; }

  function selectObject(type, id) {
    if (!editor) return;
    editor.selected = type && id ? {type, id} : null;
    if (editor.selected?.type !== 'actor') editor.tab = 'props';
    updateSelectionVisuals();
    updateLabels();
    buildTree();
    renderProps();
    renderDock();
  }
  function selectActor(id) { if (findActor(id)) selectObject('actor', id); }
  function selectCamera(id) { if (findCamera(id)) selectObject('camera', id); }
  function selectProp(id) { if (findProp(id)) selectObject('prop', id); }

  function buildTree() {
    if (!editor) return;
    const wrap = $('#stage-tree-groups');
    if (!wrap) return;
    const count = $('#stage-scene-count');
    if (count) count.textContent = `${editor.stage.actors.length} 角色 · ${editor.stage.cameras.length} 机位 · ${editor.stage.props.length} 道具`;
    const cameraRows = [
      `<div class="stage-row${editor.viewMode === 'free' ? ' active' : ''}" data-stage-camera="free"><svg><use href="#i-camera"/></svg><span class="stage-row-name">自由机位</span><span class="stage-row-tag">视角</span></div>`,
      ...editor.stage.cameras.map(camera => `<div class="stage-row${editor.selected?.type === 'camera' && editor.selected.id === camera.id ? ' active' : ''}" data-stage-camera="${esc(camera.id)}" title="双击进入这个机位"><svg><use href="#i-camera"/></svg><span class="stage-row-name">${esc(camera.name)}</span>${editor.stage.activeCamera === camera.id ? '<span class="stage-row-tag on">当前</span>' : ''}</div>`)
    ].join('');
    const actorRows = editor.stage.actors.map(actor => `<div class="stage-row${editor.selected?.type === 'actor' && editor.selected.id === actor.id ? ' active' : ''}${actor.visible ? '' : ' muted'}" data-stage-actor="${esc(actor.id)}"><span class="stage-row-dot" style="--dot:${esc(actor.color)}"></span><span class="stage-row-name">${esc(actor.name)}</span><span class="stage-row-actions"><button type="button" data-stage-visible="${esc(actor.id)}" title="${actor.visible ? '隐藏' : '显示'}" aria-label="${actor.visible ? '隐藏' : '显示'}"><svg><use href="#i-${actor.visible ? 'eye' : 'eye-off'}"/></svg></button><button type="button" data-stage-lock="${esc(actor.id)}" title="${actor.locked ? '解锁' : '锁定'}" aria-label="${actor.locked ? '解锁' : '锁定'}"><svg><use href="#i-${actor.locked ? 'lock' : 'unlock'}"/></svg></button></span></div>`).join('');
    const propRows = editor.stage.props.map(prop => `<div class="stage-row${editor.selected?.type === 'prop' && editor.selected.id === prop.id ? ' active' : ''}${prop.visible ? '' : ' muted'}" data-stage-prop="${esc(prop.id)}"><span class="stage-row-dot" style="--dot:${esc(prop.color)}"></span><span class="stage-row-name">${esc(prop.name)}</span><span class="stage-row-actions"><button type="button" data-stage-prop-visible="${esc(prop.id)}" title="${prop.visible ? '隐藏' : '显示'}" aria-label="${prop.visible ? '隐藏' : '显示'}"><svg><use href="#i-${prop.visible ? 'eye' : 'eye-off'}"/></svg></button><button type="button" data-stage-prop-lock="${esc(prop.id)}" title="${prop.locked ? '解锁' : '锁定'}" aria-label="${prop.locked ? '解锁' : '锁定'}"><svg><use href="#i-${prop.locked ? 'lock' : 'unlock'}"/></svg></button></span></div>`).join('');
    wrap.innerHTML = `<div class="stage-group"><div class="stage-group-head"><span>相机</span></div>${cameraRows}</div><div class="stage-group"><div class="stage-group-head"><span>角色</span><span>${editor.stage.actors.length}</span></div>${actorRows || '<p class="stage-empty-inline">还没有角色</p>'}</div><div class="stage-group"><div class="stage-group-head"><span>道具</span><span>${editor.stage.props.length}</span></div>${propRows || '<p class="stage-empty-inline">还没有道具</p>'}</div>`;
    const poseTab = $('[data-stage-tab="pose"]');
    if (poseTab) poseTab.disabled = editor.selected?.type !== 'actor';
  }

  function aspectOptions(selected) {
    return Object.entries(ASPECT_LABELS).map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('');
  }

  function renderProps() {
    if (!editor) return;
    $$('[data-stage-tab]').forEach(tab => {
      const active = tab.dataset.stageTab === editor.tab;
      tab.classList.toggle('active', active); tab.setAttribute('aria-pressed', String(active));
    });
    const body = $('#stage-props-body');
    if (!body) return;
    const actor = selectedActor();
    const camera = selectedCamera();
    const prop = selectedProp();
    if (editor.tab === 'pose' && actor) { body.innerHTML = poseHtml(actor); ensurePoseThumbs(); return; }
    if (actor || prop) {
      const item = actor || prop;
      body.innerHTML = actor ? actorHtml(actor) : propHtml(prop);
      if (item.locked) $$('input[type="number"], input[type="range"], select', body).forEach(input => { input.disabled = true; });
      return;
    }
    if (camera) { body.innerHTML = cameraHtml(camera); return; }
    body.innerHTML = `<div class="stage-empty"><strong>场景</strong><p>点角色改属性和姿势；点道具调遮挡；选中机位调整取景，双击机位进入机位视角。下方控制台可实时调灯光、氛围与镜头。</p><div class="stage-stats"><span><b>${editor.stage.actors.length}</b>角色</span><span><b>${editor.stage.cameras.length}</b>机位</span><span><b>${countShots()}</b>截图</span></div><label class="stage-field"><span>画幅</span><select data-stage-aspect>${aspectOptions(editor.stage.aspect)}</select></label><p class="stage-note">截图会成为独立图片卡，可连接到工作流作为参考素材；也可一次输出全部机位的独立截图。</p></div>`;
  }

  function propOptions(type = '') {
    const groups = {'基础形体': ['box', 'cylinder', 'sphere'], '家具': ['table', 'chair', 'sofa'], '布景': ['wall', 'doorway', 'stairs', 'platform']};
    return Object.entries(groups).map(([label, types]) => `<optgroup label="${label}">${types.map(key => `<option value="${key}"${key === type ? ' selected' : ''}>${PROP_TYPES[key].label}</option>`).join('')}</optgroup>`).join('');
  }

  function positionFields(item, kind) {
    return `<div class="stage-field-row triple">${['x', 'y', 'z'].map(axis => `<label class="stage-field"><span>${axis.toUpperCase()}${axis === 'y' ? ' 离地' : ''} (m)</span><input type="number" step="0.01" min="${axis === 'y' ? 0 : -14}" max="${axis === 'y' ? 10 : 14}" data-stage-${kind}-field="${axis}" value="${item[axis].toFixed(2)}"></label>`).join('')}</div>`;
  }

  function quickTransformHtml(item, kind) {
    return [['y', '离地', 0, 10, 0.01, item.y, 'm'], ['rotationDeg', '朝向', -720, 720, 1, round(item.rotation / DEG), '°'], ['scalePct', '大小', kind === 'actor' ? 60 : 40, kind === 'actor' ? 140 : 300, 1, Math.round(item.scale * 100), '%']].map(([key, label, min, max, step, value, unit]) =>
      `<label class="stage-field"><span>${label}<output>${value}${unit}</output></span><input type="range" min="${min}" max="${max}" step="${step}" data-stage-${kind}-field="${key}" value="${value}"></label>`).join('');
  }

  function actorHtml(actor) {
    const shown = round(actor.rotation / DEG);
    return `<div class="stage-prop-head"><span class="stage-row-dot" style="--dot:${esc(actor.color)}"></span><strong>${esc(actor.name)}</strong><button type="button" class="stage-link" data-stage-action="duplicate" title="复制 · Ctrl+D">复制</button><button type="button" class="stage-link danger" data-stage-action="delete-actor">删除</button></div>
      <label class="stage-field"><span>名称</span><input data-stage-actor-field="name" maxlength="24" value="${esc(actor.name)}"></label>
      <div class="stage-field"><span>颜色</span><div class="stage-colors">${PALETTE.map(color => `<button type="button" class="stage-color${color === actor.color ? ' active' : ''}" data-stage-color="${color}" style="--swatch:${color}" aria-label="更换角色颜色"></button>`).join('')}</div></div>
      <div class="stage-field"><span>常用姿势</span><div class="stage-quick-poses">${['stand', 'walk', 'sit', 'wave'].map(key => `<button type="button" data-stage-pose="${key}" class="${actor.pose === key ? 'active' : ''}" aria-pressed="${actor.pose === key}"${actor.locked ? ' disabled' : ''}>${POSES[key].label}</button>`).join('')}</div></div>
      ${quickTransformHtml(actor, 'actor')}
      <details class="stage-precise" data-stage-precise${editor.preciseOpen ? ' open' : ''}><summary>精确位置与角度</summary>
        ${positionFields(actor, 'actor')}
        <label class="stage-field"><span>朝向 (°)</span><input type="number" min="-720" max="720" step="0.1" data-stage-actor-field="rotationDeg" value="${shown}"></label>
      </details>
      <div class="stage-check-row"><label><input type="checkbox" data-stage-actor-field="visible"${actor.visible ? ' checked' : ''}>显示</label><label><input type="checkbox" data-stage-actor-field="locked"${actor.locked ? ' checked' : ''}>锁定</label></div>
      <p class="stage-note">拖动移动；Alt 拖动或 Q/E 旋转；方向键微调（Shift 大步）。截图前可切到机位视角看取景。</p>`;
  }

  function propHtml(prop) {
    const shown = round(prop.rotation / DEG);
    return `<div class="stage-prop-head"><span class="stage-row-dot" style="--dot:${esc(prop.color)}"></span><strong>${esc(prop.name)}</strong><button type="button" class="stage-link" data-stage-action="duplicate" title="复制 · Ctrl+D">复制</button><button type="button" class="stage-link danger" data-stage-action="delete-prop">删除</button></div>
      <label class="stage-field"><span>名称</span><input data-stage-prop-field="name" maxlength="24" value="${esc(prop.name)}"></label>
      <div class="stage-field"><span>类型</span><select data-stage-prop-field="type">${propOptions(prop.type)}</select></div>
      <div class="stage-field"><span>颜色</span><div class="stage-colors">${['#6b7688', '#8a7355', '#59636f', '#7a6a58', '#6f7f8c', '#9b7bde'].map(color => `<button type="button" class="stage-color${color === prop.color ? ' active' : ''}" data-stage-prop-color="${color}" style="--swatch:${color}" aria-label="更换道具颜色"></button>`).join('')}</div></div>
      ${quickTransformHtml(prop, 'prop')}
      <details class="stage-precise" data-stage-precise${editor.preciseOpen ? ' open' : ''}><summary>精确位置、尺寸与角度</summary>
        ${positionFields(prop, 'prop')}
        <div class="stage-field-row triple">${[['width', '宽'], ['height', '高'], ['depth', '深']].map(([key, label]) => `<label class="stage-field"><span>${label} (m)</span><input type="number" min="${0.1 * prop.scale}" max="${10 * prop.scale}" step="any" data-stage-prop-field="${key}" value="${Number((prop[key] * prop.scale).toFixed(3))}"></label>`).join('')}</div>
        <label class="stage-field"><span>朝向 (°)</span><input type="number" min="-720" max="720" step="0.1" data-stage-prop-field="rotationDeg" value="${shown}"></label>
      </details>
      <div class="stage-check-row"><label><input type="checkbox" data-stage-prop-field="visible"${prop.visible ? ' checked' : ''}>显示</label><label><input type="checkbox" data-stage-prop-field="locked"${prop.locked ? ' checked' : ''}>锁定</label></div>
      <p class="stage-note">宽高深可独立调整，大小控制等比缩放。拖动摆放，Shift 拖动吸附到 0.1 m / 15°；Ctrl+D 复制。</p>`;
  }

  function cameraHtml(camera) {
    const active = editor.stage.activeCamera === camera.id;
    return `<div class="stage-prop-head"><svg><use href="#i-camera"/></svg><strong>${esc(camera.name)}</strong><button type="button" class="stage-link danger" data-stage-action="delete-camera"${editor.stage.cameras.length < 2 ? ' disabled' : ''}>删除</button></div>
      <label class="stage-field"><span>名称</span><input data-stage-camera-field="name" maxlength="24" value="${esc(camera.name)}"></label>
      <label class="stage-field"><span>视野 <output>${Math.round(camera.fov)}° · 约 ${focalLength(camera.fov)}mm</output></span><input type="range" min="18" max="85" step="1" data-stage-camera-field="fov" value="${Math.round(camera.fov)}"></label>
      <label class="stage-field"><span>画幅</span><select data-stage-aspect>${aspectOptions(editor.stage.aspect)}</select></label>
      <button type="button" class="stage-wide-button" data-stage-action="align-camera">用当前画面设置这个机位</button>
      <details class="stage-precise" data-stage-precise${editor.preciseOpen ? ' open' : ''}><summary>精确机位与注视点</summary>
        ${['position', 'target'].map(key => `<div class="stage-field"><span>${key === 'position' ? '机位位置' : '注视点'} (m)</span><div class="stage-field-row triple">${['X', 'Y', 'Z'].map((axis, index) => `<label class="stage-field"><span>${axis}</span><input type="number" step="0.01" min="-40" max="40" data-stage-camera-field="${key}" data-axis="${index}" value="${camera[key][index]}"></label>`).join('')}</div></div>`).join('')}
        <p class="stage-note">焦距按 24 mm 传感器高度换算；画幅改变水平视野，不模拟景深。</p>
      </details>
      <button type="button" class="stage-wide-button primary" data-stage-action="enter-camera">${active && editor.viewMode === 'camera' ? '正在这个机位' : '切到此机位'}</button>
      <p class="stage-note">在自由视角摆好画面后套用机位；下方“镜头”可点选景别和焦距，调整时直接显示取景效果。</p>`;
  }

  function poseHtml(actor) {
    return `<div class="stage-prop-head"><span class="stage-row-dot" style="--dot:${esc(actor.color)}"></span><strong>${esc(actor.name)} · 姿势</strong></div>
      <p class="stage-note">点一下套用，共 ${Object.keys(POSES).length} 种预设。</p>
      <div class="stage-pose-grid">${Object.entries(POSES).map(([key, pose]) => `<button type="button" class="stage-pose${actor.pose === key ? ' active' : ''}" data-stage-pose="${key}" aria-pressed="${actor.pose === key}"${actor.locked ? ' disabled' : ''}><span class="stage-pose-thumb">${poseThumbs?.[key] ? `<img src="${poseThumbs[key]}" alt="">` : '<span class="stage-pose-loading"></span>'}</span><span>${esc(pose.label)}</span></button>`).join('')}</div>
      <p class="stage-note">姿势只保存预设名，项目文件不会变大。</p>`;
  }

  function focalLength(fov) { return Math.round(12 / Math.tan((Number(fov) || 40) * DEG / 2)); }
  function fovFromFocal(mm) { return clamp(2 * Math.atan(12 / mm) / DEG, 18, 85, 40); }

  function countShots() {
    const stageId = editor?.card.id;
    if (!stageId) return 0;
    const project = editor.host?.project?.();
    return project ? project.cards.filter(card => card.fromStage?.stageId === stageId).length : 0;
  }

  /* ---------- 永久控制台 ---------- */
  function renderDock() {
    if (!editor) return;
    const dock = $('#stage-dock');
    if (!dock) return;
    const env = editor.stage.environment;
    const camera = activeShotCamera();
    const height = camera ? camera.position[1] : 2;
    const pitch = camera ? cameraPitch(camera) : 0;
    const slider = (key, label, min, max, step, value, unit = '') =>
      `<label class="dock-slider"><span>${label}<output data-dock-out="${key}">${value}${unit}</output></span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-stage-env="${key}" aria-label="${label}"></label>`;
    const section = editor.dockSection === undefined ? 'lens' : editor.dockSection;
    const panel = key => `id="stage-dock-${key}" data-stage-dock-panel="${key}"${section === key ? '' : ' hidden'}`;
    dock.innerHTML = `
      <div class="dock-toolbar">
        <div class="dock-sections" role="group" aria-label="舞台调整">${[['lens', '镜头'], ['light', '灯光'], ['atmosphere', '氛围'], ['display', '显示'], ['actions', '更多']].map(([key, label]) => `<button type="button" class="dock-button${section === key ? ' active' : ''}" data-stage-dock="${key}" aria-pressed="${section === key}" aria-expanded="${section === key}" aria-controls="stage-dock-${key}">${label}</button>`).join('')}</div>
        <div class="stage-motion-buttons">
          <button type="button" id="stage-undo" class="dock-button" data-stage-action="undo" title="撤销 · Ctrl+Z" ${editor.historyIndex <= 0 ? 'disabled' : ''}><svg><use href="#i-undo"/></svg>撤销</button>
          <button type="button" id="stage-redo" class="dock-button" data-stage-action="redo" title="重做 · Ctrl+Y" ${editor.historyIndex >= editor.history.length - 1 ? 'disabled' : ''}><svg><use href="#i-redo"/></svg>重做</button>
          <button type="button" class="dock-button primary" data-stage-action="capture-open"><svg><use href="#i-camera"/></svg>截图到画布</button>
        </div>
      </div>
      <div class="dock-cluster" ${panel('light')}>
        <div class="dock-head"><svg><use href="#i-sun"/></svg>灯光</div>
        ${slider('lightAngle', '方向', 0, 360, 1, Math.round(env.lightAngle), '°')}
        ${slider('lightHeight', '高度', 8, 85, 1, Math.round(env.lightHeight), '°')}
        ${slider('lightIntensity', '强度', 0, 7, 0.1, round(env.lightIntensity), '')}
        <label class="dock-color"><span>色温</span><input type="color" value="${env.lightColor}" data-stage-env="lightColor" aria-label="灯光颜色"></label>
      </div>
      <div class="dock-cluster" ${panel('atmosphere')}>
        <div class="dock-head"><svg><use href="#i-sparkle"/></svg>氛围</div>
        ${slider('ambient', '环境光', 0, 4, 0.1, round(env.ambient), '')}
        ${slider('fog', '雾', 0, 1, 0.01, round(env.fog), '')}
        ${slider('particles', '尘埃', 0, 1, 0.01, round(env.particles), '')}
        ${slider('glow', '辉光', 0, 2, 0.01, round(env.glow), '')}
        ${slider('floor', '地面反射', 0, 1, 0.01, round(env.floor), '')}
      </div>
      <div class="dock-cluster dock-lens" ${panel('lens')}>
        <div class="dock-head"><svg><use href="#i-camera"/></svg>镜头${camera ? ` · ${esc(camera.name)}` : ''}</div>
        <div class="dock-presets">${FOCALS.map(mm => `<button type="button" data-stage-focal="${mm}" class="${camera && Math.abs(focalLength(camera.fov) - mm) <= 2 ? 'active' : ''}">${mm}mm</button>`).join('')}</div>
        <div class="dock-presets">${Object.entries(SHOTS).map(([key, shot]) => `<button type="button" data-stage-shot="${key}">${shot.label}</button>`).join('')}</div>
        ${slider('camHeight', '机位高度', 0.3, 7, 0.1, round(height), 'm')}
        ${slider('camPitch', '俯仰', -45, 45, 1, Math.round(pitch), '°')}
        <button type="button" class="dock-button" data-stage-action="aim-camera"><svg><use href="#i-focus"/></svg>对准人物</button>
      </div>
      <div class="dock-cluster" ${panel('display')}>
        <div class="dock-head"><svg><use href="#i-grid"/></svg>显示</div>
        <div class="dock-toggles">
          <button type="button" data-stage-action="grid" class="${env.grid ? 'active' : ''}" aria-pressed="${env.grid}">网格</button>
          <button type="button" data-stage-action="wireframe" class="${env.wireframe ? 'active' : ''}" aria-pressed="${env.wireframe}">线框</button>
          <button type="button" data-stage-action="frustums" class="${env.frustums ? 'active' : ''}" aria-pressed="${env.frustums}">视锥</button>
        </div>
        <label class="dock-select"><span>画质</span><select data-stage-env="quality" aria-label="画质">${Object.entries(QUALITY).map(([key, value]) => `<option value="${key}"${key === env.quality ? ' selected' : ''}>${value.label}</option>`).join('')}</select></label>
      </div>
      <div class="dock-cluster dock-actions" ${panel('actions')}>
        <div class="dock-head"><svg><use href="#i-stage"/></svg>场景操作</div>
        <div class="dock-buttons">
          <button type="button" class="dock-button" data-stage-action="randomize"><svg><use href="#i-sparkle"/></svg>随机摆位</button>
          <button type="button" class="dock-button" data-stage-action="reset-scene"><svg><use href="#i-refresh"/></svg>重置场景</button>
          <button type="button" class="dock-button" data-stage-action="export-stage"><svg><use href="#i-download"/></svg>导出场景数据</button>
        </div>
      </div>`;
  }

  function cameraPitch(camera) {
    const dx = camera.target[0] - camera.position[0];
    const dy = camera.target[1] - camera.position[1];
    const dz = camera.target[2] - camera.position[2];
    const horizontal = Math.hypot(dx, dz) || 0.001;
    return Math.atan2(dy, horizontal) / DEG;
  }

  function setDockOutput(key, text) {
    const out = $(`[data-dock-out="${key}"]`);
    if (out) out.textContent = text;
  }

  function updateEnvField(input) {
    const env = editor.stage.environment;
    const key = input.dataset.stageEnv;
    switch (key) {
      case 'lightAngle': env.lightAngle = clamp(input.value, 0, 360, 38); setDockOutput(key, `${Math.round(env.lightAngle)}°`); break;
      case 'lightHeight': env.lightHeight = clamp(input.value, 8, 85, 52); setDockOutput(key, `${Math.round(env.lightHeight)}°`); break;
      case 'lightIntensity': env.lightIntensity = clamp(input.value, 0, 7, 3.4); setDockOutput(key, `${round(env.lightIntensity)}`); break;
      case 'lightColor': env.lightColor = isColor(input.value) ? input.value : env.lightColor; break;
      case 'ambient': env.ambient = clamp(input.value, 0, 4, 1.5); setDockOutput(key, `${round(env.ambient)}`); break;
      case 'fog': env.fog = clamp(input.value, 0, 1, 0.45); setDockOutput(key, `${round(env.fog)}`); break;
      case 'particles': env.particles = clamp(input.value, 0, 1, 0.5); setDockOutput(key, `${round(env.particles)}`); break;
      case 'glow': env.glow = clamp(input.value, 0, 2, 1); setDockOutput(key, `${round(env.glow)}`); break;
      case 'floor': env.floor = clamp(input.value, 0, 1, 0.55); setDockOutput(key, `${round(env.floor)}`); break;
      case 'quality': env.quality = QUALITY[input.value] ? input.value : 'high'; setQuality(); markDirty(false); return;
      case 'camHeight': setCameraHeight(clamp(input.value, 0.3, 7, 2)); setDockOutput(key, `${round(clamp(input.value, 0.3, 7, 2))}m`); markDirty(false); return;
      case 'camPitch': setCameraPitch(clamp(input.value, -45, 45, 0)); setDockOutput(key, `${Math.round(clamp(input.value, -45, 45, 0))}°`); markDirty(false); return;
    }
    applyEnvironment();
    markDirty(false);
  }

  function activeShotCamera() {
    return selectedCamera() || resolveShotCamera();
  }

  function setCameraHeight(value) {
    const camera = activeShotCamera();
    if (!camera) return;
    camera.position[1] = round(value);
    afterCameraEdit(camera);
  }

  function setCameraPitch(value) {
    const camera = activeShotCamera();
    if (!camera) return;
    const dx = camera.target[0] - camera.position[0];
    const dz = camera.target[2] - camera.position[2];
    const horizontal = Math.hypot(dx, dz) || 0.001;
    camera.target[1] = clamp(round(camera.position[1] + Math.tan(deg(value)) * horizontal), -40, 40, 0);
    afterCameraEdit(camera);
  }

  function afterCameraEdit(camera) {
    if (!editor.mode2d && editor.camera) {
      const switching = editor.viewMode !== 'camera' || editor.stage.activeCamera !== camera.id;
      editor.stage.activeCamera = camera.id; editor.viewMode = 'camera'; editor.topDown = false;
      if (switching) syncView(false); else syncShotCamera();
    }
    buildFrustums();
    updateBadge();
    invalidateShadows();
  }

  function applyFocal(mm) {
    const camera = activeShotCamera();
    if (!camera) { editor.host?.toast?.('先添加一个机位'); return; }
    camera.fov = round(fovFromFocal(mm));
    afterCameraEdit(camera);
    renderProps();
    renderDock();
    pushHistory();
    markDirty();
  }

  function applyShot(key) {
    const shot = SHOTS[key];
    const camera = activeShotCamera();
    if (!shot || !camera) { editor.host?.toast?.('先添加一个机位'); return; }
    let direction = camera.position.map((value, index) => value - camera.target[index]);
    if (Math.hypot(...direction) < Math.sqrt(0.001)) direction = [1, 0.4, 1];
    const distance = Math.hypot(...direction);
    camera.position = camera.target.map((value, index) => clamp(round(value + direction[index] / distance * shot.dist), -40, 40, 0));
    camera.fov = shot.fov;
    afterCameraEdit(camera);
    renderProps();
    renderDock();
    pushHistory();
    markDirty();
  }

  function aimCamera() {
    const camera = activeShotCamera();
    if (!camera) { editor.host?.toast?.('先添加一个机位'); return; }
    const actor = selectedActor() || editor.stage.actors.find(item => item.visible) || editor.stage.actors[0];
    if (!actor) { editor.host?.toast?.('先添加一个角色'); return; }
    camera.target = [round(actor.x), round(actor.y + (POSES[actor.pose]?.rootY || 0) + 1.05 * actor.scale), round(actor.z)];
    afterCameraEdit(camera);
    renderProps();
    renderDock();
    pushHistory();
    markDirty();
    editor.host?.toast?.(`机位已对准 ${actor.name}`);
  }

  /* ---------- 姿势缩略图 ---------- */
  function ensurePoseThumbs() {
    if (poseThumbs || !editor?.renderer || editor.mode2d) return;
    try { poseThumbs = buildPoseThumbs(); fillPoseThumbs(); }
    catch (error) { console.warn('姿势预览生成失败', error); poseThumbs = {}; }
  }

  function fillPoseThumbs() {
    if (!poseThumbs) return;
    $$('.stage-pose').forEach(button => {
      const key = button.dataset.stagePose;
      const holder = $('.stage-pose-thumb', button);
      if (holder && poseThumbs[key] && !$('img', holder)) holder.innerHTML = `<img src="${poseThumbs[key]}" alt="">`;
    });
  }

  function buildPoseThumbs() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1a1e26');
    const camera = new THREE.PerspectiveCamera(30, 0.75, 0.1, 50);
    camera.position.set(1.8, 1.5, 3.4);
    camera.lookAt(0, 1, 0);
    scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x1a1d24, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 6, 4);
    scene.add(key);
    const root = buildMannequin({id: sid('thumb'), color: '#8fa8c8', pose: 'stand'});
    scene.add(root);
    const width = 96, height = 128;
    const target = new THREE.WebGLRenderTarget(width, height);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    const buffer = new Uint8Array(width * height * 4);
    const flipped = new Uint8ClampedArray(width * height * 4);
    const result = {};
    const shadowState = editor.renderer.shadowMap.enabled;
    editor.renderer.shadowMap.enabled = false;
    for (const name of Object.keys(POSES)) {
      applyPose(root, name);
      editor.renderer.setRenderTarget(target);
      editor.renderer.render(scene, camera);
      editor.renderer.readRenderTargetPixels(target, 0, 0, width, height, buffer);
      editor.renderer.setRenderTarget(null);
      for (let y = 0; y < height; y++) flipped.set(buffer.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
      context.putImageData(new ImageData(new Uint8ClampedArray(flipped), width, height), 0, 0);
      result[name] = canvas.toDataURL('image/png');
    }
    editor.renderer.shadowMap.enabled = shadowState;
    editor.renderer.shadowMap.needsUpdate = true;
    target.dispose();
    disposeMaterials(root);
    return result;
  }

  function renderTools() {
    if (!editor) return;
    $$('[data-stage-tool]').forEach(button => {
      const active = editor.viewMode === 'free' && button.dataset.stageTool === editor.transformMode;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
      button.disabled = !editor.camera && !editor.mode2d;
    });
    const top = $('[data-stage-action="top-down"]');
    if (top) {
      top.disabled = editor.mode2d || !editor.camera;
      top.classList.toggle('active', editor.topDown); top.setAttribute('aria-pressed', String(editor.topDown));
    }
    const hint = $('#stage-tool-hint');
    if (hint) hint.textContent = editor.mode2d ? '俯视摆位 · 拖动对象 · Shift 吸附' : editor.viewMode === 'camera' ? '正在取景 · 点移动或旋转返回摆位' : editor.transformMode === 'rotate' ? '左右拖动对象转向 · Shift 吸附 15°' : '拖空白转视角 · 右键平移 · 滚轮缩放';
  }

  /* ---------- UI 事件 ---------- */
  function onUiClick(event) {
    if (!editor) return;
    const action = event.target.closest('[data-stage-action]');
    const name = action?.dataset.stageAction;
    if (editor.motionJob && !['motion-cancel', 'close'].includes(name)) return;
    if (name?.startsWith('motion-')) {
      event.preventDefault();
      switch (name) {
        case 'motion-open': { const panel = $('#stage-motion'); if (panel) panel.open = true; refreshMotionTargets(); renderMotionControls(); $('#stage-motion-preset')?.focus(); break; }
        case 'motion-preset': applyMotionPreset(); break;
        case 'motion-start': recordMotionEndpoint('start'); break;
        case 'motion-end': recordMotionEndpoint('end'); break;
        case 'motion-load-start': loadMotionEndpoint('start'); break;
        case 'motion-load-end': loadMotionEndpoint('end'); break;
        case 'motion-play': {
          const preview = editor.motionPreview;
          const time = !preview || preview.time >= editor.stage.motion.duration ? 0 : preview.time;
          previewMotion(time, !preview?.playing); break;
        }
        case 'motion-stop': stopMotionPreview(); break;
        case 'motion-export': exportMotion(); break;
        case 'motion-cancel': cancelMotionExport(); break;
      }
      return;
    }
    if (editor.motionPreview && name !== 'close') return;
    if (action) {
      event.preventDefault();
      switch (name) {
        case 'close': close(); break;
        case 'reset-view': resetView(); break;
        case 'undo': undo(); break;
        case 'redo': redo(); break;
        case 'grid': toggleEnvFlag('grid'); break;
        case 'wireframe': toggleEnvFlag('wireframe'); break;
        case 'frustums': toggleEnvFlag('frustums'); break;
        case 'top-down': toggleTopDown(); break;
        case 'add-actor': addActor(); break;
        case 'add-camera': addCamera(); break;
        case 'add-prop': addProp($('#stage-prop-type')?.value || 'box'); break;
        case 'capture-open': openCapture(); break;
        case 'capture-close': closeCapture(); break;
        case 'capture-do': doCapture(); break;
        case 'delete-actor': deleteSelectedActor(); break;
        case 'delete-camera': deleteSelectedCamera(); break;
        case 'delete-prop': deleteSelectedProp(); break;
        case 'duplicate': duplicateSelected(); break;
        case 'align-camera': alignCamera(); break;
        case 'enter-camera': enterCamera(); break;
        case 'aim-camera': aimCamera(); break;
        case 'randomize': randomizeScene(); break;
        case 'reset-scene': resetScene(); break;
        case 'export-stage': exportStage(); break;
      }
      return;
    }
    const tool = event.target.closest('[data-stage-tool]');
    if (tool && ['move', 'rotate'].includes(tool.dataset.stageTool)) {
      editor.transformMode = tool.dataset.stageTool;
      if (editor.viewMode !== 'free') setView('free'); else renderTools();
      return;
    }
    const section = event.target.closest('[data-stage-dock]');
    if (section && ['lens', 'light', 'atmosphere', 'display', 'actions'].includes(section.dataset.stageDock)) {
      const key = section.dataset.stageDock;
      editor.dockSection = (editor.dockSection === undefined ? 'lens' : editor.dockSection) === key ? null : key;
      renderDock(); resizeStage(); $(`[data-stage-dock="${key}"]`)?.focus(); return;
    }
    const viewButton = event.target.closest('[data-stage-view]');
    if (viewButton) { setView(viewButton.dataset.stageView); return; }
    const tab = event.target.closest('[data-stage-tab]');
    if (tab) { if (tab.disabled) return; editor.tab = tab.dataset.stageTab; renderProps(); return; }
    const visible = event.target.closest('[data-stage-visible]');
    if (visible) { event.stopPropagation(); toggleActorFlag(visible.dataset.stageVisible, 'visible'); return; }
    const locked = event.target.closest('[data-stage-lock]');
    if (locked) { event.stopPropagation(); toggleActorFlag(locked.dataset.stageLock, 'locked'); return; }
    const propVisible = event.target.closest('[data-stage-prop-visible]');
    if (propVisible) { event.stopPropagation(); togglePropFlag(propVisible.dataset.stagePropVisible, 'visible'); return; }
    const propLocked = event.target.closest('[data-stage-prop-lock]');
    if (propLocked) { togglePropFlag(propLocked.dataset.stagePropLock, 'locked'); return; }
    const actorRow = event.target.closest('[data-stage-actor]');
    if (actorRow) { selectActor(actorRow.dataset.stageActor); return; }
    const propRow = event.target.closest('[data-stage-prop]');
    if (propRow) { selectProp(propRow.dataset.stageProp); return; }
    const cameraRow = event.target.closest('[data-stage-camera]');
    if (cameraRow) {
      const id = cameraRow.dataset.stageCamera;
      if (id === 'free') { editor.selected = null; editor.tab = 'props'; setView('free'); buildTree(); renderProps(); }
      else selectCamera(id);
      return;
    }
    const color = event.target.closest('[data-stage-color]');
    if (color) { setActorColor(selectedActor(), color.dataset.stageColor); return; }
    const propColor = event.target.closest('[data-stage-prop-color]');
    if (propColor) { setPropColor(selectedProp(), propColor.dataset.stagePropColor); return; }
    const pose = event.target.closest('[data-stage-pose]');
    if (pose) { setActorPose(pose.dataset.stagePose); $(`[data-stage-pose="${pose.dataset.stagePose}"]`)?.focus(); return; }
    const focal = event.target.closest('[data-stage-focal]');
    if (focal) { applyFocal(Number(focal.dataset.stageFocal)); return; }
    const shot = event.target.closest('[data-stage-shot]');
    if (shot) { applyShot(shot.dataset.stageShot); return; }
  }

  function onUiDoubleClick(event) {
    if (!editor || editor.motionPreview || editor.motionJob) return;
    const actorRow = event.target.closest('[data-stage-actor]');
    if (actorRow) { focusActor(actorRow.dataset.stageActor); return; }
    const cameraRow = event.target.closest('[data-stage-camera]');
    if (cameraRow && cameraRow.dataset.stageCamera !== 'free') {
      const camera = findCamera(cameraRow.dataset.stageCamera);
      if (camera) {
        editor.selected = {type: 'camera', id: camera.id};
        editor.stage.activeCamera = camera.id;
        editor.viewMode = 'camera';
        editor.topDown = false;
        syncView();
        markDirty();
      }
    }
  }

  function onUiInput(event) {
    if (!editor || editor.motionJob) return;
    if (event.target.id === 'stage-motion-time') { previewMotion(Number(event.target.value)); return; }
    if (editor.motionPreview) return;
    if (event.target.type === 'number' && (event.target.value === '' || !event.target.validity.valid)) return;
    if (event.target.dataset.stageEnv) { updateEnvField(event.target); return; }
    if (event.target.dataset.stageActorField) { updateActorField(event.target); if (selectedActor()) syncTransformInputs(selectedActor()); return; }
    if (event.target.dataset.stagePropField) { updatePropField(event.target); if (selectedProp()) syncPropInputs(selectedProp()); return; }
    if (event.target.dataset.stageCameraField) { updateCameraField(event.target); return; }
  }

  function onUiChange(event) {
    if (!editor || editor.motionJob) return;
    if (['stage-motion-format', 'stage-motion-target'].includes(event.target.id)) { refreshMotionTargets(); return; }
    if (editor.motionPreview) return;
    if (['stage-motion-duration', 'stage-motion-easing'].includes(event.target.id)) {
      if (event.target.id === 'stage-motion-duration') editor.stage.motion.duration = clamp(event.target.value || editor.stage.motion.duration, 1, 30, 5);
      else editor.stage.motion.easing = event.target.value === 'linear' ? 'linear' : 'smooth';
      pushHistory(); markDirty(); renderMotionControls(); return;
    }
    const aspect = event.target.closest('[data-stage-aspect]');
    if (aspect) { setAspect(aspect.value); return; }
    if (event.target.id === 'stage-camera-select') {
      editor.stage.activeCamera = event.target.value;
      syncShotCamera();
      buildFrustums();
      updateBadge();
      buildTree();
      renderDock();
      pushHistory();
      markDirty();
      return;
    }
    if (event.target.id === 'stage-capture-size' || event.target.id === 'stage-capture-mode') { updateCaptureDimensions(); return; }
    if (event.target.dataset.stagePropField === 'type') {
      const prop = selectedProp();
      if (prop && !prop.locked && Object.hasOwn(PROP_TYPES, event.target.value)) {
        prop.type = event.target.value; prop.color = PROP_TYPES[prop.type].color;
        [prop.width, prop.height, prop.depth] = PROP_TYPES[prop.type].size;
        rebuildScene(); buildTree(); renderProps(); pushHistory(); markDirty();
      } else renderProps();
      return;
    }
    if (event.target.dataset.stageEnv || event.target.dataset.stageActorField || event.target.dataset.stageCameraField || event.target.dataset.stagePropField) {
      pushHistory(); markDirty();
      if (event.target.type === 'number') {
        if (selectedActor()) syncTransformInputs(selectedActor(), event.target);
        if (selectedProp()) syncPropInputs(selectedProp(), event.target);
        const camera = selectedCamera();
        const key = event.target.dataset.stageCameraField;
        if (camera && ['position', 'target'].includes(key)) event.target.value = camera[key][Number(event.target.dataset.axis)];
      }
      if (event.target.dataset.stageActorField === 'locked' || event.target.dataset.stagePropField === 'locked' || ['camHeight', 'camPitch'].includes(event.target.dataset.stageEnv)) renderProps();
    }
  }

  function updateActorField(input) {
    const actor = selectedActor();
    if (!actor || (actor.locked && (input.type === 'number' || input.type === 'range'))) return;
    switch (input.dataset.stageActorField) {
      case 'name': actor.name = String(input.value || '').trim().slice(0, 24) || '角色'; updateActorLabel(actor); buildTree(); break;
      case 'x': actor.x = clamp(input.value, -14, 14, 0); applyActorTransform(actor); break;
      case 'z': actor.z = clamp(input.value, -14, 14, 0); applyActorTransform(actor); break;
      case 'y': actor.y = clamp(input.value, 0, 10, 0); applyActorTransform(actor); break;
      case 'rotationDeg': actor.rotation = deg(clamp(input.value, -720, 720, 0)); applyActorTransform(actor); setOutput(input, `${Math.round(Number(input.value))}°`); break;
      case 'scalePct': actor.scale = clamp(Number(input.value) / 100, 0.6, 1.4, 1); applyActorTransform(actor); setOutput(input, `${Math.round(Number(input.value))}%`); break;
      case 'visible': actor.visible = input.checked; applyActorTransform(actor); buildTree(); break;
      case 'locked': actor.locked = input.checked; buildTree(); break;
    }
    markDirty(false);
  }

  function updatePropField(input) {
    const prop = selectedProp();
    if (!prop || (prop.locked && (input.type === 'number' || input.type === 'range'))) return;
    switch (input.dataset.stagePropField) {
      case 'name': prop.name = String(input.value || '').trim().slice(0, 24) || '道具'; buildTree(); break;
      case 'x': prop.x = clamp(input.value, -14, 14, 0); applyPropTransform(prop); break;
      case 'z': prop.z = clamp(input.value, -14, 14, 0); applyPropTransform(prop); break;
      case 'y': prop.y = clamp(input.value, 0, 10, 0); applyPropTransform(prop); break;
      case 'width': case 'height': case 'depth':
        prop[input.dataset.stagePropField] = clamp(Number(input.value) / prop.scale, 0.1, 10, 1);
        applyPropTransform(prop); break;
      case 'rotationDeg': prop.rotation = deg(clamp(input.value, -720, 720, 0)); applyPropTransform(prop); break;
      case 'scalePct': prop.scale = clamp(Number(input.value) / 100, 0.4, 3, 1); applyPropTransform(prop); syncPropInputs(prop); setOutput(input, `${Math.round(prop.scale * 100)}%`); break;
      case 'visible': prop.visible = input.checked; applyPropTransform(prop); buildTree(); break;
      case 'locked': prop.locked = input.checked; buildTree(); break;
    }
    markDirty(false);
  }

  function updateCameraField(input) {
    const camera = selectedCamera();
    if (!camera) return;
    if (input.dataset.stageCameraField === 'name') {
      camera.name = String(input.value || '').trim().slice(0, 24) || '机位';
      updateBadge(); syncCameraSelect(); buildTree(); renderDock();
    } else if (input.dataset.stageCameraField === 'fov') {
      camera.fov = clamp(input.value, 18, 85, 40);
      afterCameraEdit(camera);
      setOutput(input, `${Math.round(camera.fov)}° · 约 ${focalLength(camera.fov)}mm`);
      renderDock();
    } else if (['position', 'target'].includes(input.dataset.stageCameraField)) {
      camera[input.dataset.stageCameraField][Number(input.dataset.axis)] = clamp(input.value, -40, 40, 0);
      afterCameraEdit(camera);
      renderDock();
    }
    markDirty(false);
  }

  function setOutput(input, text) {
    const output = input.closest('label')?.querySelector('output');
    if (output) output.textContent = text;
  }

  function applyActorTransform(actor) {
    const root = findActorRoot(actor.id);
    if (root) {
      root.position.set(actor.x, actor.y + (POSES[actor.pose]?.rootY || 0), actor.z);
      root.rotation.y = actor.rotation;
      root.scale.setScalar(actor.scale);
      root.visible = actor.visible;
    }
    updateActorLabel(actor);
    updateSelectionVisuals();
    updateLabels();
    invalidateShadows();
    if (editor.mode2d) draw2D();
  }

  function applyPropTransform(prop) {
    const root = findPropRoot(prop.id);
    if (root) {
      root.position.set(prop.x, prop.y, prop.z);
      root.rotation.y = prop.rotation;
      const size = PROP_TYPES[prop.type].size;
      root.scale.set(prop.width / size[0] * prop.scale, prop.height / size[1] * prop.scale, prop.depth / size[2] * prop.scale);
      root.visible = prop.visible;
    }
    updateSelectionVisuals();
    invalidateShadows();
    if (editor.mode2d) draw2D();
  }

  function updateActorLabel(actor) {
    const label = editor?.labels?.get(actor.id);
    if (label) {
      const name = label.querySelector('span:last-child');
      if (name) name.textContent = actor.name;
      const dot = label.querySelector('.stage-label-dot');
      if (dot) dot.style.setProperty('--dot', actor.color);
    }
  }

  function toggleActorFlag(id, flag) {
    const actor = findActor(id);
    if (!actor) return;
    actor[flag] = !actor[flag];
    applyActorTransform(actor);
    buildTree(); renderProps(); pushHistory(); markDirty();
  }

  function togglePropFlag(id, flag) {
    const prop = findProp(id);
    if (!prop) return;
    prop[flag] = !prop[flag];
    applyPropTransform(prop);
    buildTree(); renderProps(); pushHistory(); markDirty();
  }

  function setActorColor(actor, color) {
    if (!actor || !isColor(color)) return;
    actor.color = color;
    const root = findActorRoot(actor.id);
    const base = new THREE.Color(color);
    (root?.userData.bodyMaterials || []).forEach((material, index) => material.color.copy(index === 0 ? base : base.clone().multiplyScalar(0.62)));
    updateActorLabel(actor);
    buildTree(); renderProps(); pushHistory(); markDirty();
    if (editor.mode2d) draw2D();
  }

  function setPropColor(prop, color) {
    if (!prop || !isColor(color)) return;
    prop.color = color;
    (findPropRoot(prop.id)?.userData.bodyMaterials || []).forEach(material => material.color.set(color));
    buildTree(); renderProps(); pushHistory(); markDirty();
    if (editor.mode2d) draw2D();
  }

  function setActorPose(poseName) {
    const actor = selectedActor();
    if (!actor || actor.locked || !Object.hasOwn(POSES, poseName)) return;
    actor.pose = poseName;
    const root = findActorRoot(actor.id);
    if (root) {
      applyPose(root, poseName);
      root.position.set(actor.x, actor.y + (POSES[poseName].rootY || 0), actor.z);
      root.rotation.y = actor.rotation;
      root.scale.setScalar(actor.scale);
      root.visible = actor.visible;
    }
    updateSelectionVisuals(); updateLabels(); renderProps(); invalidateShadows(); pushHistory(); markDirty();
    if (editor.mode2d) draw2D();
  }

  function deleteSelectedActor() {
    const actor = selectedActor();
    if (!actor) return;
    editor.stage.actors = editor.stage.actors.filter(item => item.id !== actor.id);
    editor.selected = null; editor.tab = 'props';
    rebuildScene(); buildTree(); renderProps(); renderDock(); pushHistory(); markDirty();
    editor.host?.toast?.(`已移除 ${actor.name}`);
  }

  function deleteSelectedProp() {
    const prop = selectedProp();
    if (!prop) return;
    editor.stage.props = editor.stage.props.filter(item => item.id !== prop.id);
    editor.selected = null;
    rebuildScene(); buildTree(); renderProps(); pushHistory(); markDirty();
    editor.host?.toast?.(`已移除 ${prop.name}`);
  }

  function deleteSelectedCamera() {
    const camera = selectedCamera();
    if (!camera) return;
    if (editor.stage.cameras.length < 2) { editor.host?.toast?.('至少保留一个机位'); return; }
    editor.stage.cameras = editor.stage.cameras.filter(item => item.id !== camera.id);
    editor.selected = null;
    if (editor.stage.activeCamera === camera.id) {
      editor.stage.activeCamera = editor.stage.cameras[0]?.id || 'free';
      if (editor.viewMode === 'camera' && !editor.stage.cameras.length) editor.viewMode = 'free';
    }
    syncView(); rebuildScene(); buildTree(); renderProps(); pushHistory(); markDirty();
  }

  function addActor() {
    if (!editor) return;
    if (editor.stage.actors.length >= 12) { editor.host?.toast?.('一个舞台最多 12 个角色'); return; }
    let index = 1;
    const names = new Set(editor.stage.actors.map(actor => actor.name));
    while (names.has(`角色${index}`)) index++;
    const count = editor.stage.actors.length;
    const actor = {
      id: sid('actor'), name: `角色${index}`, color: PALETTE[count % PALETTE.length],
      x: count === 0 ? 0 : ((count % 3) - 1) * 1.15, y: 0, z: count === 0 ? 0 : Math.floor(count / 3) * 0.95,
      rotation: 0, scale: 1, pose: 'stand', visible: true, locked: false
    };
    editor.stage.actors.push(actor);
    editor.selected = {type: 'actor', id: actor.id};
    editor.tab = 'props';
    rebuildScene(); buildTree(); renderProps(); renderDock(); pushHistory(); markDirty();
    editor.host?.toast?.(`已添加 ${actor.name}`);
  }

  function addProp(type) {
    if (!editor) return;
    if (editor.stage.props.length >= 16) { editor.host?.toast?.('一个舞台最多 16 个道具'); return; }
    const kind = Object.hasOwn(PROP_TYPES, type) ? type : 'box';
    let index = 1;
    const names = new Set(editor.stage.props.map(prop => prop.name));
    while (names.has(`${PROP_TYPES[kind].label}${index}`)) index++;
    const count = editor.stage.props.length;
    const prop = {
      id: sid('prop'), name: `${PROP_TYPES[kind].label}${index}`, type: kind, color: PROP_TYPES[kind].color,
      x: 1.6 + (count % 3) * 0.9, y: 0, z: -1.4 + Math.floor(count / 3) * 0.9,
      width: PROP_TYPES[kind].size[0], height: PROP_TYPES[kind].size[1], depth: PROP_TYPES[kind].size[2],
      rotation: 0, scale: 1, visible: true, locked: false
    };
    editor.stage.props.push(prop);
    editor.selected = {type: 'prop', id: prop.id};
    editor.tab = 'props';
    rebuildScene(); buildTree(); renderProps(); renderDock(); pushHistory(); markDirty();
    editor.host?.toast?.(`已添加 ${prop.name}`);
  }

  function duplicateSelected() {
    const source = selectedActor() || selectedProp();
    if (!source) return;
    const type = editor.selected.type;
    const list = type === 'actor' ? editor.stage.actors : editor.stage.props;
    const limit = type === 'actor' ? 12 : 16;
    if (list.length >= limit) { editor.host?.toast?.(`最多 ${limit} 个${type === 'actor' ? '角色' : '道具'}`); return; }
    const baseName = source.name.slice(0, 18);
    let index = 1;
    while (list.some(item => item.name === `${baseName} 副本${index}`)) index++;
    const copy = {...clone(source), id: sid(type), name: `${baseName} 副本${index}`, locked: false};
    copy.x = source.x > 13.5 ? source.x - 0.5 : source.x + 0.5;
    copy.z = source.z > 13.5 ? source.z - 0.5 : source.z + 0.5;
    list.push(copy);
    editor.selected = {type, id: copy.id}; editor.tab = 'props';
    rebuildScene(); buildTree(); renderProps(); renderDock(); pushHistory(); markDirty();
    editor.host?.toast?.(`已复制 ${source.name}`);
  }

  function addCamera() {
    if (!editor) return;
    if (editor.stage.cameras.length >= 8) { editor.host?.toast?.('一个舞台最多 8 个机位'); return; }
    let index = 1;
    const names = new Set(editor.stage.cameras.map(camera => camera.name));
    while (names.has(`机位${index}`)) index++;
    let position, target, fov;
    if (editor.mode2d) {
      position = [4.1, 2.1, 4.7]; target = [0, 1.05, 0]; fov = 40;
    } else {
      const direction = new THREE.Vector3();
      editor.camera.getWorldDirection(direction);
      const aim = editor.camera.position.clone().addScaledVector(direction, 5);
      position = editor.camera.position.toArray().map(round);
      target = aim.toArray().map(round);
      fov = clamp(editor.camera.fov, 18, 85, 40);
    }
    const camera = {id: sid('camera'), name: `机位${index}`, position, target, fov};
    editor.stage.cameras.push(camera);
    editor.stage.activeCamera = camera.id;
    editor.selected = {type: 'camera', id: camera.id};
    editor.viewMode = 'camera';
    editor.topDown = false;
    syncView(); pushHistory(); markDirty();
    editor.host?.toast?.(`已添加 ${camera.name}`);
  }

  function resetView() {
    if (!editor) return;
    editor.topDown = false;
    if (editor.viewMode === 'camera') {
      const camera = resolveShotCamera();
      if (camera) { camera.position = [4.1, 2.1, 4.7]; camera.target = [0, 1.05, 0]; camera.fov = 40; }
      syncShotCamera(); buildFrustums();
    } else if (!editor.mode2d) {
      editor.orbitGoal.theta = Math.PI * 0.28;
      editor.orbitGoal.phi = Math.PI * 0.42;
      editor.orbitGoal.radius = 4.6;
      editor.orbitGoal.target.set(0, 1.05, 0);
      snapOrbit();
    }
    renderProps(); renderDock(); renderTools(); updateBadge(); updateLabels(); pushHistory(); markDirty();
  }

  function toggleEnvFlag(key) {
    if (!editor) return;
    const env = editor.stage.environment;
    env[key] = !env[key];
    applyEnvironment();
    renderDock();
    if (editor.mode2d) draw2D();
    pushHistory(); markDirty();
  }

  function toggleTopDown() {
    if (!editor) return;
    if (editor.viewMode === 'camera') { editor.viewMode = 'free'; }
    editor.topDown = !editor.topDown;
    if (!editor.mode2d) {
      if (editor.topDown) {
        editor.orbitGoal.phi = 0.06;
        editor.orbitGoal.radius = Math.max(editor.orbitGoal.radius, 9);
        editor.orbitGoal.target.set(0, 0, 0);
      } else {
        editor.orbitGoal.phi = Math.PI * 0.42;
        editor.orbitGoal.radius = 4.6;
        editor.orbitGoal.target.set(0, 1.05, 0);
      }
      snapOrbit();
    }
    syncView();
    markDirty();
  }

  function alignCamera() {
    if (!editor) return;
    const camera = selectedCamera();
    if (!camera) return;
    if (editor.mode2d) { editor.host?.toast?.('2D 兼容模式下请直接拖动角色摆位'); return; }
    if (editor.viewMode !== 'free') { editor.host?.toast?.('先切回自由视角，把画面调到想拍的位置，再对齐机位'); return; }
    camera.position = editor.camera.position.toArray().map(round);
    camera.target = editor.orbit.target.toArray().map(round);
    camera.fov = clamp(editor.camera.fov, 18, 85, 40);
    buildFrustums(); renderProps(); renderDock(); buildTree(); pushHistory(); markDirty();
    editor.host?.toast?.('机位已对齐到当前视角');
  }

  function enterCamera() {
    if (!editor) return;
    const camera = selectedCamera();
    if (!camera) return;
    editor.stage.activeCamera = camera.id;
    editor.viewMode = 'camera';
    editor.topDown = false;
    syncView(); pushHistory(); markDirty();
  }

  function focusActor(id) {
    const actor = findActor(id);
    if (!actor || !editor) return;
    if (editor.viewMode === 'camera') { editor.viewMode = 'free'; syncView(); }
    if (editor.mode2d) { draw2D(); return; }
    editor.topDown = false;
    editor.orbitGoal.target.set(actor.x, actor.y + (POSES[actor.pose]?.rootY || 0) + 1.05 * actor.scale, actor.z);
    editor.orbitGoal.radius = Math.min(editor.orbitGoal.radius, 3.4);
    editor.orbitGoal.theta = Math.PI * 0.28;
    editor.orbitGoal.phi = Math.PI * 0.42;
    snapOrbit();
    updateLabels();
  }

  function setAspect(value) {
    if (!editor || !ASPECTS[value]) return;
    editor.stage.aspect = value;
    resizeStage(); buildFrustums(); syncAspectControls(); updateBadge(); renderDock(); pushHistory(); markDirty();
  }

  function syncAspectControls() {
    if (!editor) return;
    $$('[data-stage-aspect]').forEach(select => { select.innerHTML = aspectOptions(editor.stage.aspect); select.value = editor.stage.aspect; });
    updateCaptureDimensions();
  }

  function randomizeScene() {
    if (!editor) return;
    const env = editor.stage.environment;
    env.lightAngle = Math.round(Math.random() * 360);
    env.lightHeight = Math.round(28 + Math.random() * 45);
    env.lightColor = ['#fff1de', '#ffe0c0', '#dce8ff', '#ffd9e6', '#e6fff0'][Math.floor(Math.random() * 5)];
    env.glow = round(0.7 + Math.random() * 0.9);
    env.fog = round(0.2 + Math.random() * 0.6);
    editor.stage.actors.forEach((actor, index) => {
      if (actor.locked) return;
      const angle = (index / Math.max(1, editor.stage.actors.length)) * Math.PI * 2 + Math.random() * 0.6;
      const radius = 0.6 + Math.random() * 2.2;
      actor.x = round(Math.cos(angle) * radius);
      actor.z = round(Math.sin(angle) * radius);
      actor.rotation = round(Math.random() * Math.PI * 2);
      actor.pose = Object.keys(POSES)[Math.floor(Math.random() * Object.keys(POSES).length)];
      actor.color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    });
    applyEnvironment(); rebuildScene(); buildTree(); renderProps(); renderDock(); pushHistory(); markDirty();
    editor.host?.toast?.('已随机构图，可继续微调');
  }

  function resetScene() {
    if (!editor) return;
    editor.stage.environment = {...ENV_DEFAULT};
    editor.topDown = false;
    applyEnvironment(); setQuality();
    if (!editor.mode2d) {
      editor.orbitGoal.theta = Math.PI * 0.28;
      editor.orbitGoal.phi = Math.PI * 0.42;
      editor.orbitGoal.radius = 4.6;
      editor.orbitGoal.target.set(0, 1.05, 0);
      snapOrbit();
    }
    renderDock(); renderProps(); renderTools(); updateBadge(); updateLabels(); pushHistory(); markDirty();
    editor.host?.toast?.('灯光与视角已重置');
  }

  function exportStage() {
    if (!editor) return;
    const data = JSON.stringify(snapshot(), null, 2);
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${editor.card.name || '导演台'}-舞台.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    editor.host?.toast?.('舞台数据已导出为 JSON');
  }

  function motionProblem(state = editor) {
    if (!state || state.mode2d || !state.camera) return '视频预演需要 3D 模式，请等待舞台就绪后操作。';
    const motion = state.stage.motion;
    if (!motion?.start || !motion.end) return '先记录起点和终点，再预演或输出。';
    for (const frame of [motion.start, motion.end]) for (const kind of ['actors', 'props']) {
      if (frame[kind].length !== state.stage[kind].length || frame[kind].some(item => !state.stage[kind].some(current => current.id === item.id && current.type === item.type))) return '场景对象已变化，请重新记录起点和终点。';
    }
    return '';
  }

  function motionStatus(text) {
    const status = $('#stage-motion-status');
    if (status) status.textContent = text;
  }

  function renderMotionControls() {
    if (!editor) return;
    const motion = editor.stage.motion;
    if (!motion) return;
    const preview = editor.motionPreview, busy = !!editor.motionJob;
    for (const key of ['start', 'end']) {
      const label = $(`#stage-motion-${key}-state`);
      if (label) label.textContent = motion[key] ? '已记录' : '未记录';
      const record = $(`[data-stage-action="motion-${key}"]`);
      const load = $(`[data-stage-action="motion-load-${key}"]`);
      if (record) record.disabled = busy || !!preview || editor.mode2d || !editor.camera;
      if (load) load.disabled = busy || !motion[key] || editor.mode2d || !editor.camera;
    }
    for (const key of ['duration', 'easing']) {
      const input = $(`#stage-motion-${key}`);
      if (input) { if (document.activeElement !== input) input.value = motion[key]; input.disabled = busy || !!preview; }
    }
    for (const selector of ['#stage-motion-preset', '#stage-motion-strength', '[data-stage-action="motion-preset"]']) {
      const control = $(selector);
      if (control) control.disabled = busy || !!preview || editor.mode2d || !editor.camera;
    }
    for (const key of ['format', 'target', 'first-field', 'last-field']) {
      const input = $(`#stage-motion-${key}`);
      if (input) input.disabled = busy;
    }
    const play = $('[data-stage-action="motion-play"]');
    if (play) { play.disabled = busy || !!motionProblem(); play.textContent = preview?.playing ? '暂停' : '播放'; }
    const stop = $('[data-stage-action="motion-stop"]');
    if (stop) stop.disabled = busy || !preview;
    const output = $('[data-stage-action="motion-export"]');
    if (output) output.disabled = busy || !!motionProblem();
    const cancel = $('[data-stage-action="motion-cancel"]');
    if (cancel) { cancel.hidden = !busy; cancel.disabled = busy && editor.motionJob.saving; }
    const scrub = $('#stage-motion-time');
    if (scrub) { scrub.max = motion.duration; scrub.disabled = busy || !!motionProblem(); scrub.value = preview?.time || 0; }
    updateMotionReadout();
    for (const selector of ['.stage-body', '#stage-dock', '.stage-view-switch', '#stage-camera-select', '[data-stage-action="reset-view"]']) {
      const node = $(selector, editor.view || document);
      if (node) node.inert = !!preview || busy;
    }
    editor.view?.classList.toggle('previewing', !!preview);
    editor.view?.classList.toggle('is-exporting', busy);
  }

  function updateMotionReadout() {
    const time = editor?.motionPreview?.time || 0;
    const readout = $('#stage-motion-readout');
    if (readout) readout.textContent = `${time.toFixed(2)} / ${(editor?.stage.motion?.duration || 5).toFixed(2)} s`;
    const scrub = $('#stage-motion-time');
    if (scrub) scrub.value = time;
  }

  function refreshMotionTargets() {
    if (!editor) return;
    const type = $('#stage-motion-format')?.value === 'frames' ? 'image' : 'video';
    const target = $('#stage-motion-target');
    if (!target) return;
    const selected = target.value;
    const workflows = (editor.host?.workflows?.() || []).filter(item => item.fields?.some(field => field.type === type));
    target.innerHTML = `<option value="">不连接工作流</option>${workflows.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}`;
    target.value = workflows.some(item => item.id === selected) ? selected : '';
    const binding = $('#stage-motion-binding-summary');
    if (binding) binding.textContent = target.value ? `连接到：${workflows.find(item => item.id === target.value).name}（展开检查输入）` : '连接工作流（可选）';
    const fields = workflows.find(item => item.id === target.value)?.fields?.filter(field => field.type === type) || [];
    for (const key of ['first', 'last']) {
      const input = $(`#stage-motion-${key}-field`);
      if (!input) continue;
      const previous = input.value;
      input.innerHTML = `<option value="">不连接此素材</option>${fields.map(field => `<option value="${esc(field.id)}"${field.occupied ? ' disabled' : ''}>${esc(field.nodeTitle || field.label || field.id)}${field.occupied ? '（已有参考）' : ''}</option>`).join('')}`;
      input.value = fields.some(field => field.id === previous && !field.occupied) ? previous : '';
      if (type === 'video' && key === 'first' && fields.length === 1 && !fields[0].occupied) input.value = fields[0].id;
    }
    const label = $('#stage-motion-first-label');
    if (label) label.textContent = type === 'video' ? '视频输入' : '首帧输入';
    const last = $('#stage-motion-last-slot');
    if (last) last.hidden = type === 'video';
  }

  function currentMotionEndpoint() {
    const shot = editor.viewMode === 'camera' ? resolveShotCamera() : {
      position: editor.camera.position.toArray(), target: editor.orbit.target.toArray(), fov: editor.camera.fov
    };
    const scene = normalize({actors: editor.stage.actors, props: editor.stage.props, cameras: [shot]});
    return {actors: scene.actors, props: scene.props, camera: scene.cameras[0]};
  }

  function recordMotionEndpoint(key) {
    if (!editor || editor.mode2d || !editor.camera || editor.motionPreview || editor.motionJob) return;
    editor.stage.motion[key] = currentMotionEndpoint();
    pushHistory(); markDirty(); renderMotionControls();
    motionStatus(`已记录${key === 'start' ? '起点' : '终点'}的机位、位置和姿势。`);
  }

  function applyMotionPreset() {
    if (!editor || editor.mode2d || !editor.camera || editor.motionPreview || editor.motionJob) return;
    const key = $('#stage-motion-preset')?.value, strength = Number($('#stage-motion-strength')?.value);
    if (!['push', 'pull', 'left', 'right', 'rise'].includes(key) || ![0.15, 0.3, 0.5].includes(strength)) { motionStatus('请选择运镜方式与幅度。'); return; }
    const start = currentMotionEndpoint(), end = clone(start), camera = end.camera;
    const offset = camera.position.map((value, i) => value - camera.target[i]);
    const distance = Math.hypot(...offset);
    if (distance < 0.2) { motionStatus('机位离注视点太近，请先拉远一点。'); return; }
    if (key === 'push' || key === 'pull') {
      const factor = key === 'push' ? 1 - strength : 1 + strength;
      camera.position = camera.target.map((value, i) => value + offset[i] * factor);
    } else {
      const horizontal = Math.hypot(offset[0], offset[2]);
      const right = horizontal > 0.001 ? [offset[2] / horizontal, 0, -offset[0] / horizontal] : [1, 0, 0];
      const shift = key === 'rise' ? [0, distance * strength, 0] : right.map(value => value * distance * strength * (key === 'left' ? -1 : 1));
      camera.position = camera.position.map((value, i) => value + shift[i]);
      camera.target = camera.target.map((value, i) => value + shift[i]);
    }
    if ([...camera.position, ...camera.target].some(value => !Number.isFinite(value) || Math.abs(value) > 40)) { motionStatus('运镜超出场景范围，请减小幅度或把机位移近场景。'); return; }
    const motion = editor.stage.motion;
    if ((motion.start || motion.end) && !window.confirm('用当前画面生成新的运镜起终点？已有的起终点将被替换，可撤销；场景摆位不变。')) return;
    motion.start = start; motion.end = end;
    pushHistory(); markDirty();
    previewMotion(0, true);
    motionStatus('已从当前画面生成运镜。退出预演后可手动修改起终点；撤销可恢复原方案。');
  }

  function loadMotionEndpoint(key) {
    if (!editor || editor.mode2d || !editor.camera || editor.motionJob) return;
    const frame = editor.stage.motion[key];
    if (!frame) return;
    stopMotionPreview();
    for (const kind of ['actors', 'props']) {
      if (frame[kind].length !== editor.stage[kind].length || frame[kind].some(item => !editor.stage[kind].some(current => current.id === item.id && current.type === item.type))) { motionStatus('场景对象已变化，请重新记录。'); return; }
    }
    for (const kind of ['actors', 'props']) editor.stage[kind] = clone(frame[kind]);
    const camera = activeShotCamera();
    Object.assign(camera, {position: frame.camera.position.slice(), target: frame.camera.target.slice(), fov: frame.camera.fov});
    editor.stage.activeCamera = camera.id;
    editor.viewMode = 'camera'; editor.selected = null; editor.tab = 'props';
    rebuildScene(); syncView(); pushHistory(); markDirty();
    motionStatus(`已载入${key === 'start' ? '起点' : '终点'}；修改后请重新记录。`);
  }

  function previewMotion(time, playing = false) {
    const problem = motionProblem();
    if (problem) { motionStatus(problem); return false; }
    if (!editor.motionPreview) {
      const helpers = {};
      for (const key of ['grid', 'ring', 'frustums']) if (editor.helpers[key]) { helpers[key] = editor.helpers[key].visible; editor.helpers[key].visible = false; }
      editor.gesture = null;
      editor.motionPreview = {camera: editor.camera.clone(), helpers, time: 0, playing: false};
      const labels = $('#stage-labels');
      if (labels) labels.hidden = true;
      resizeStage();
    }
    const preview = editor.motionPreview;
    preview.time = clamp(time, 0, editor.stage.motion.duration, 0);
    preview.playing = playing;
    preview.startedAt = performance.now() - preview.time * 1000;
    applyMotionFrame(preview.time);
    renderMotionControls();
    return true;
  }

  function applyMotionFrame(time) {
    const motion = editor.stage.motion, preview = editor.motionPreview;
    const frame = motionFrame(motion, time);
    for (const actor of frame.actors) {
      const root = findActorRoot(actor.id);
      if (!root) continue;
      const a = motion.start.actors.find(item => item.id === actor.id), b = motion.end.actors.find(item => item.id === actor.id);
      const start = POSES[a.pose], end = POSES[b.pose], u = frame.amount;
      root.position.set(actor.x, actor.y + (start.rootY || 0) * (1 - u) + (end.rootY || 0) * u, actor.z);
      root.rotation.y = actor.rotation; root.scale.setScalar(actor.scale); root.visible = actor.visible;
      for (const [key, joint] of Object.entries(root.userData.joints)) {
        const from = start[key] || [0, 0, 0], to = end[key] || [0, 0, 0];
        joint.rotation.set(...from.map((value, axis) => deg(value + (to[axis] - value) * u)));
      }
      const color = new THREE.Color(a.color).lerp(new THREE.Color(b.color), u);
      root.userData.bodyMaterials.forEach((material, index) => material.color.copy(index === 0 ? color : color.clone().multiplyScalar(0.62)));
    }
    for (const prop of frame.props) {
      const root = findPropRoot(prop.id);
      if (!root) continue;
      const size = PROP_TYPES[prop.type].size;
      root.position.set(prop.x, prop.y, prop.z); root.rotation.y = prop.rotation;
      root.scale.set(prop.width / size[0] * prop.scale, prop.height / size[1] * prop.scale, prop.depth / size[2] * prop.scale);
      root.visible = prop.visible;
      const a = motion.start.props.find(item => item.id === prop.id), b = motion.end.props.find(item => item.id === prop.id);
      root.userData.bodyMaterials[0].color.set(a.color).lerp(new THREE.Color(b.color), frame.amount);
    }
    preview.camera.position.fromArray(frame.camera.position);
    preview.camera.lookAt(new THREE.Vector3().fromArray(frame.camera.target));
    preview.camera.fov = frame.camera.fov;
    preview.camera.aspect = ASPECTS[editor.stage.aspect] || 16 / 9;
    preview.camera.updateProjectionMatrix(); preview.camera.updateMatrixWorld(true);
    invalidateShadows();
  }

  function stopMotionPreview() {
    if (!editor?.motionPreview) return;
    const preview = editor.motionPreview;
    editor.motionPreview = null;
    rebuildScene();
    for (const [key, visible] of Object.entries(preview.helpers)) if (editor.helpers[key]) editor.helpers[key].visible = visible;
    const labels = $('#stage-labels');
    if (labels) labels.hidden = false;
    resizeStage(); renderMotionControls();
  }

  function cancelMotionExport() {
    const job = editor?.motionJob;
    if (!job || job.saving) return;
    job.cancelled = true;
    job.cancel?.();
    motionStatus('已取消视频输出，场景保持不变。');
  }

  function recordMotionVideo(state, surface) {
    if (document.hidden) throw new Error('窗口已隐藏，未开始录制；请保持软件在前台后重试。');
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4'].find(type => window.MediaRecorder?.isTypeSupported(type));
    if (!mime || !surface.canvas.captureStream) throw new Error('当前窗口不支持视频编码，可改用“首尾帧”输出。');
    const stream = surface.canvas.captureStream(24);
    const job = state.motionJob, chunks = [];
    let recorder, timer;
    try { recorder = new window.MediaRecorder(stream, {mimeType: mime, videoBitsPerSecond: 6000000}); }
    catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
    return new Promise((resolve, reject) => {
      let error = null;
      const cleanup = () => { clearTimeout(timer); stream.getTracks().forEach(track => track.stop()); document.removeEventListener('visibilitychange', visibility); job.cancel = null; };
      const visibility = () => { if (document.hidden) { error = new Error('窗口已隐藏，录制已取消；请保持软件在前台后重试。'); job.cancel(); } };
      job.cancel = () => { clearTimeout(timer); job.cancelled = true; if (recorder.state !== 'inactive') recorder.stop(); };
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = event => { error = event.error || new Error('视频编码失败'); job.cancel(); };
      recorder.onstop = () => {
        cleanup();
        if (error || job.cancelled || editor !== state) reject(error || new Error('已取消输出'));
        else if (!chunks.length) reject(new Error('没有录制到视频画面'));
        else resolve(new Blob(chunks, {type: recorder.mimeType}));
      };
      document.addEventListener('visibilitychange', visibility);
      const started = performance.now(), interval = 1000 / 24, duration = state.stage.motion.duration;
      const lastFrameAt = (Math.round(duration * 24) - 1) * interval;
      const tick = () => {
        if (job.cancelled || editor !== state) { job.cancel(); return; }
        try {
          const elapsed = performance.now() - started, time = duration * Math.min(1, elapsed / lastFrameAt);
          state.motionPreview.time = time;
          applyMotionFrame(time); surface.draw(state.motionPreview.camera); updateMotionReadout();
          motionStatus(`正在录制 ${time.toFixed(1)} / ${duration.toFixed(1)} 秒，请保持窗口在前台…`);
          // 留出最后一帧的采集周期，不能在画完终点的同一任务里停止录制。
          if (time >= duration) timer = setTimeout(() => recorder.stop(), interval);
          else timer = setTimeout(tick, Math.max(1, (Math.floor(elapsed / interval) + 1) * interval - (performance.now() - started)));
        } catch (failure) { error = failure; job.cancel(); }
      };
      try { recorder.start(500); tick(); }
      catch (failure) { cleanup(); reject(failure); }
    });
  }

  async function exportMotion() {
    if (!editor || editor.motionJob || editor.captureBusy) return;
    const problem = motionProblem();
    if (problem) { motionStatus(problem); return; }
    const state = editor;
    const format = $('#stage-motion-format')?.value === 'frames' ? 'frames' : 'video';
    const targetWorkflow = $('#stage-motion-target')?.value || '';
    const firstField = $('#stage-motion-first-field')?.value || '', lastField = format === 'frames' ? $('#stage-motion-last-field')?.value || '' : '';
    if (firstField && firstField === lastField) { motionStatus('首帧和尾帧必须选择不同输入。'); return; }
    if (targetWorkflow && !firstField && !lastField) { motionStatus('请选择实际参考输入，或选择“不连接工作流”。'); return; }
    stopMotionPreview();
    const ratio = ASPECTS[state.stage.aspect] || 16 / 9;
    const width = ratio >= 1 ? 1280 : Math.round(1280 * ratio / 2) * 2;
    const height = ratio >= 1 ? Math.round(1280 / ratio / 2) * 2 : 1280;
    const job = {cancelled: false, saving: false, cancel: null};
    state.motionJob = job;
    let surface;
    try {
      if (!state.host?.motionCapture) throw new Error('视频素材接口未载入，请保存画布后重开软件。');
      previewMotion(0);
      surface = captureSurface(state, width, height);
      surface.draw(state.motionPreview.camera);
      const first = await new Promise((resolve, reject) => surface.canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('无法生成首帧')), 'image/png'));
      if (editor !== state || job.cancelled) return;
      const items = [{blob: first, role: 'start'}];
      if (format === 'frames') {
        state.motionPreview.time = state.stage.motion.duration;
        applyMotionFrame(state.stage.motion.duration);
        surface.draw(state.motionPreview.camera);
        const last = await new Promise((resolve, reject) => surface.canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('无法生成尾帧')), 'image/png'));
        items.push({blob: last, role: 'end'});
      } else items.push({blob: await recordMotionVideo(state, surface), role: 'video'});
      if (editor !== state || job.cancelled) return;
      surface.dispose(); surface = null;
      stopMotionPreview();
      job.saving = true; renderMotionControls();
      motionStatus(format === 'video' ? '正在保存并编码 MP4，请稍候…' : '正在保存首尾帧…');
      await state.host.motionCapture(items, {format, width, height, duration: state.stage.motion.duration, fps: 24, targetWorkflow, firstField, lastField});
      if (editor === state) motionStatus('已输出到画布；请在目标工作流确认参考输入与时长，再手动生成。');
    } catch (error) {
      if (editor === state) motionStatus(job.cancelled ? `输出已取消：${error.message}` : `视频输出失败：${error.message}`);
    } finally {
      surface?.dispose();
      if (editor === state) { stopMotionPreview(); state.motionJob = null; refreshMotionTargets(); renderMotionControls(); }
    }
  }

  /* ---------- 截图 ---------- */
  function openCapture() {
    if (!editor) return;
    const modal = $('#stage-capture-modal');
    if (!modal) return;
    const workflows = editor.host?.workflows?.() || [];
    const target = $('#stage-capture-target');
    if (target) target.innerHTML = `<option value="">不连接，只生成图片卡</option>${workflows.map(workflow => `<option value="${esc(workflow.id)}">${esc(workflow.name)}</option>`).join('')}`;
    const aspect = $('#stage-capture-aspect');
    if (aspect) { aspect.innerHTML = aspectOptions(editor.stage.aspect); aspect.value = editor.stage.aspect; }
    const mode = $('#stage-capture-mode');
    if (mode) {
      mode.innerHTML = `<option value="current">当前视角</option><option value="all">全部机位（${editor.stage.cameras.length} 张）</option>`;
      mode.value = 'current';
    }
    const status = $('#stage-capture-status');
    if (status) status.textContent = '';
    modal.hidden = false;
    updateCaptureDimensions();
    $('[data-stage-action="capture-do"]')?.focus();
  }

  function closeCapture() {
    const modal = $('#stage-capture-modal');
    if (modal) modal.hidden = true;
    const status = $('#stage-capture-status');
    if (status) status.textContent = '';
  }

  function captureDimensions() {
    const size = Number($('#stage-capture-size')?.value) || 1920;
    const ratio = ASPECTS[editor.stage.aspect] || 16 / 9;
    return ratio >= 1 ? {width: size, height: Math.round(size / ratio)} : {width: Math.round(size * ratio), height: size};
  }

  function updateCaptureDimensions() {
    if (!editor) return;
    const {width, height} = captureDimensions();
    const mode = $('#stage-capture-mode')?.value || 'current';
    const label = $('#stage-capture-dim');
    if (label) label.textContent = mode === 'all' ? `${width} × ${height} · ${editor.stage.cameras.length} 张` : `${width} × ${height}`;
  }

  async function doCapture() {
    if (!editor || editor.captureBusy) return;
    const state = editor;
    state.captureBusy = true;
    const status = $('#stage-capture-status');
    try {
      const {width, height} = captureDimensions();
      const target = $('#stage-capture-target')?.value || '';
      const mode = $('#stage-capture-mode')?.value || 'current';
      if (mode === 'all' && !state.mode2d) {
        const cameras = state.stage.cameras.slice();
        for (let i = 0; i < cameras.length; i++) {
          if (!editor) return;
          if (status) status.textContent = `正在渲染机位 ${i + 1}/${cameras.length} · ${width} × ${height}…`;
          const blob = await renderCapture(width, height, cameras[i]);
          if (!editor) return;
          await state.host?.capture?.(blob, {width, height, targetWorkflow: target, cameraId: cameras[i].id, filename: `${state.card.name || '导演台'}-${cameras[i].name}.png`});
        }
        if (!editor) return;
        state.dirty = true;
        closeCapture();
        state.host?.toast?.(`已输出 ${cameras.length} 个机位的截图`);
      } else {
        if (status) status.textContent = `正在渲染 ${width} × ${height}…`;
        const blob = await renderCapture(width, height, null);
        if (!editor) return;
        const camera = state.viewMode === 'camera' ? resolveShotCamera() : null;
        await state.host?.capture?.(blob, {width, height, targetWorkflow: target, cameraId: camera?.id || '', filename: `${state.card.name || '导演台'}-截图.png`});
        if (!editor) return;
        state.dirty = true;
        closeCapture();
      }
    } catch (error) {
      console.error(error);
      if (status) status.textContent = `截图失败：${error.message}`;
      state.host?.toast?.(`截图失败：${error.message}`);
    } finally {
      if (editor) editor.captureBusy = false;
    }
  }

  async function renderCapture(width, height, forceCamera) {
    const state = editor;
    if (!state) throw new Error('导演台已关闭');
    if (state.mode2d) return render2DCapture(width, height);
    const h = state.helpers;
    const saved = {grid: h.grid.visible, ring: h.ring.visible, frustums: h.frustums.visible};
    h.grid.visible = false;
    h.ring.visible = false;
    h.frustums.visible = false;
    const shot = state.camera.clone();
    const camera = forceCamera || (state.viewMode === 'camera' ? resolveShotCamera() : null);
    if (camera) {
      shot.fov = camera.fov;
      shot.position.fromArray(camera.position);
      shot.lookAt(new THREE.Vector3().fromArray(camera.target));
    } else {
      shot.fov = state.camera.fov;
      shot.position.copy(state.camera.position);
      shot.quaternion.copy(state.camera.quaternion);
    }
    shot.aspect = width / height;
    shot.updateProjectionMatrix();
    let surface;
    try {
      surface = captureSurface(state, width, height);
      surface.draw(shot);
      return await new Promise((resolve, reject) => surface.canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('无法生成 PNG')), 'image/png'));
    } finally {
      surface?.dispose();
      h.grid.visible = saved.grid;
      h.ring.visible = saved.ring;
      h.frustums.visible = saved.frustums;
    }
  }

  function captureSurface(state, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建输出画布');
    const target = new THREE.WebGLRenderTarget(width, height);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const buffer = new Uint8Array(width * height * 4);
    const pixels = new Uint8ClampedArray(buffer.length);
    const image = new ImageData(pixels, width, height);
    return {canvas, dispose: () => target.dispose(), draw(shot) {
      if (editor !== state) throw new Error('导演台已关闭');
      const previous = state.renderer.getRenderTarget();
      try {
        state.renderer.setRenderTarget(target);
        state.renderer.render(state.scene, shot);
        state.renderer.readRenderTargetPixels(target, 0, 0, width, height, buffer);
      } finally { state.renderer.setRenderTarget(previous); }
      for (let y = 0; y < height; y++) pixels.set(buffer.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
      context.putImageData(image, 0, 0);
    }};
  }

  function render2DCapture(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const source = editor.canvas2d;
    ctx.fillStyle = '#0b0e13';
    ctx.fillRect(0, 0, width, height);
    if (source) ctx.drawImage(source, 0, 0, width, height);
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('无法生成 PNG')), 'image/png'));
  }

  /* ---------- 历史 ---------- */
  function snapshot() { return clone(editor.stage); }
  function resetHistory() {
    if (!editor) return;
    editor.history = [snapshot()];
    editor.historyIndex = 0;
    updateHistoryButtons();
  }
  function pushHistory() {
    if (!editor) return;
    const value = snapshot();
    if (JSON.stringify(value) === JSON.stringify(editor.history[editor.historyIndex])) return;
    editor.history = editor.history.slice(0, editor.historyIndex + 1);
    editor.history.push(value);
    if (editor.history.length > 50) editor.history.shift();
    editor.historyIndex = editor.history.length - 1;
    updateHistoryButtons();
  }
  function undo() { if (!editor || editor.historyIndex <= 0) return; editor.historyIndex--; applyHistory(); }
  function redo() { if (!editor || editor.historyIndex >= editor.history.length - 1) return; editor.historyIndex++; applyHistory(); }
  function applyHistory() {
    if (!editor) return;
    editor.stage = clone(editor.history[editor.historyIndex]);
    editor.card.stage = editor.stage;
    editor.selected = null;
    editor.tab = 'props';
    rebuildScene();
    applyEnvironment();
    syncView();
    pushHistory();
    markDirty();
  }
  function updateHistoryButtons() {
    const undoButton = $('#stage-undo');
    const redoButton = $('#stage-redo');
    if (undoButton) undoButton.disabled = !editor || editor.historyIndex <= 0;
    if (redoButton) redoButton.disabled = !editor || editor.historyIndex >= editor.history.length - 1;
    renderMotionControls();
  }

  function markDirty(notify = true) {
    if (!editor) return;
    editor.dirty = true;
    if (notify) editor.host?.onChange?.();
  }

  /* ---------- 指针交互 ---------- */
  function updatePointer(event) {
    if (!editor) return;
    const host = $('#stage-canvas');
    if (!host) return;
    const rect = host.getBoundingClientRect();
    editor.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    editor.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    editor.raycaster.setFromCamera(editor.pointer, editor.camera);
  }

  function pickObject(event) {
    if (!editor || editor.mode2d) return null;
    updatePointer(event);
    const roots = [...editor.actorGroup.children, ...editor.propGroup.children].filter(root => root.visible);
    const hits = editor.raycaster.intersectObjects(roots, true);
    for (const hit of hits) {
      let object = hit.object;
      while (object && !object.userData.actorId && !object.userData.propId) object = object.parent;
      if (object?.userData.actorId) { const actor = findActor(object.userData.actorId); if (actor) return {type: 'actor', item: actor, point: hit.point}; }
      if (object?.userData.propId) { const prop = findProp(object.userData.propId); if (prop) return {type: 'prop', item: prop, point: hit.point}; }
    }
    return null;
  }

  function pick2D(event) {
    const host = $('#stage-canvas');
    const rect = host.getBoundingClientRect();
    const width = editor.viewWidth || rect.width;
    const height = editor.viewHeight || rect.height;
    const scale = Math.min(width, height) / 16;
    const x = (event.clientX - rect.left - width / 2) / scale;
    const z = (event.clientY - rect.top - height / 2) / scale;
    let best = null, bestDist = 0.6;
    for (const actor of editor.stage.actors) {
      if (!actor.visible) continue;
      const d = Math.hypot(actor.x - x, actor.z - z);
      if (d < bestDist) { bestDist = d; best = {type: 'actor', item: actor}; }
    }
    if (best) return {hit: best, x, z};
    for (const prop of [...editor.stage.props].reverse()) {
      if (!prop.visible) continue;
      const dx = x - prop.x, dz = z - prop.z;
      const localX = dx * Math.cos(prop.rotation) - dz * Math.sin(prop.rotation);
      const localZ = dx * Math.sin(prop.rotation) + dz * Math.cos(prop.rotation);
      const halfWidth = Math.max(0.2, prop.width * prop.scale / 2);
      const halfDepth = Math.max(0.2, prop.depth * prop.scale / 2);
      const hit = prop.type === 'sphere' || prop.type === 'cylinder'
        ? (localX / halfWidth) ** 2 + (localZ / halfDepth) ** 2 <= 1
        : Math.abs(localX) <= halfWidth && Math.abs(localZ) <= halfDepth;
      if (hit) { best = {type: 'prop', item: prop}; break; }
    }
    return {hit: best, x, z};
  }

  function dragPoint(event, plane) {
    if (!editor || editor.mode2d) return null;
    updatePointer(event);
    const point = new THREE.Vector3();
    return editor.raycaster.ray.intersectPlane(plane, point) ? point : null;
  }

  function onPointerDown(event) {
    if (!editor || editor.motionPreview || editor.motionJob) return;
    if (editor.mode2d) {
      if (event.button !== 0) return;
      const {hit, x, z} = pick2D(event);
      if (hit) {
        if (hit.type === 'actor') selectActor(hit.item.id); else selectProp(hit.item.id);
        if (hit.item.locked) return;
        editor.gesture = {type: event.altKey || editor.transformMode === 'rotate' ? 'rotate' : 'move2d', kind: hit.type, id: hit.item.id, startRotation: hit.item.rotation, offsetX: hit.item.x - x, offsetZ: hit.item.z - z, startX: event.clientX, startY: event.clientY, moved: false};
        event.preventDefault();
      }
      return;
    }
    if (event.button === 1 || event.button === 2) {
      event.preventDefault();
      editor.gesture = {type: 'pan', startX: event.clientX, startY: event.clientY, moved: false};
      return;
    }
    if (event.button !== 0) return;
    const picked = pickObject(event);
    if (picked) {
      if (picked.type === 'actor') selectActor(picked.item.id); else selectProp(picked.item.id);
      if (editor.viewMode !== 'free' || picked.item.locked) return;
      const rotate = event.altKey || editor.transformMode === 'rotate';
      if (rotate) {
        editor.gesture = {type: 'rotate', kind: picked.type, id: picked.item.id, startX: event.clientX, startY: event.clientY, startRotation: picked.item.rotation, moved: false};
      } else {
        const point = picked.point;
        const normal = new THREE.Vector3(0, 1, 0);
        // 平视时水平拖拽平面退化，改用朝向相机的平面以免物体跳动。
        if (Math.abs(editor.raycaster.ray.direction.y) < 0.1) editor.camera.getWorldDirection(normal);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
        editor.gesture = {type: 'move', kind: picked.type, id: picked.item.id, startX: event.clientX, startY: event.clientY, plane, offsetX: picked.item.x - point.x, offsetZ: picked.item.z - point.z, moved: false};
      }
      event.preventDefault();
      return;
    }
    if (editor.viewMode === 'camera') return;
    editor.gesture = {type: 'orbit', startX: event.clientX, startY: event.clientY, theta: editor.orbitGoal.theta, phi: editor.orbitGoal.phi, moved: false};
    selectObject(null, null);
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!editor?.gesture) return;
    const gesture = editor.gesture;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) gesture.moved = true;
    if (gesture.type === 'orbit') {
      editor.orbitGoal.theta = gesture.theta - dx * 0.008;
      editor.orbitGoal.phi = clamp(gesture.phi - dy * 0.006, 0.05, 1.52, 1.2);
      if (editor.topDown) { editor.topDown = false; renderTools(); updateBadge(); }
    } else if (gesture.type === 'pan') {
      const scale = editor.orbit.radius * 0.0016;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(editor.camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(editor.camera.quaternion);
      editor.orbitGoal.target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
    } else if (gesture.type === 'move') {
      const point = dragPoint(event, gesture.plane);
      const item = gesture.kind === 'actor' ? findActor(gesture.id) : findProp(gesture.id);
      if (!point || !item) return;
      item.x = clamp(event.shiftKey ? round(point.x + gesture.offsetX) : point.x + gesture.offsetX, -14, 14, 0);
      item.z = clamp(event.shiftKey ? round(point.z + gesture.offsetZ) : point.z + gesture.offsetZ, -14, 14, 0);
      if (gesture.kind === 'actor') { applyActorTransform(item); syncTransformInputs(item); }
      else { applyPropTransform(item); syncPropInputs(item); }
    } else if (gesture.type === 'move2d') {
      const host = $('#stage-canvas');
      const rect = host.getBoundingClientRect();
      const width = editor.viewWidth || rect.width;
      const height = editor.viewHeight || rect.height;
      const scale = Math.min(width, height) / 16;
      const x = (event.clientX - rect.left - width / 2) / scale;
      const z = (event.clientY - rect.top - height / 2) / scale;
      const item = gesture.kind === 'actor' ? findActor(gesture.id) : findProp(gesture.id);
      if (!item) return;
      item.x = clamp(event.shiftKey ? round(x + gesture.offsetX) : x + gesture.offsetX, -14, 14, 0);
      item.z = clamp(event.shiftKey ? round(z + gesture.offsetZ) : z + gesture.offsetZ, -14, 14, 0);
      if (gesture.kind === 'actor') { applyActorTransform(item); syncTransformInputs(item); }
      else { applyPropTransform(item); syncPropInputs(item); }
    } else if (gesture.type === 'rotate') {
      const item = gesture.kind === 'actor' ? findActor(gesture.id) : findProp(gesture.id);
      if (!item) return;
      const angle = gesture.startRotation - dx * 0.01;
      item.rotation = clamp(event.shiftKey ? Math.round(angle / deg(15)) * deg(15) : angle, -Math.PI * 4, Math.PI * 4, 0);
      if (gesture.kind === 'actor') { applyActorTransform(item); syncTransformInputs(item); }
      else { applyPropTransform(item); syncPropInputs(item); }
    }
  }

  function syncTransformInputs(actor, committed = null) {
    for (const key of ['x', 'y', 'z', 'rotationDeg', 'scalePct']) {
      const value = key === 'rotationDeg' ? round(actor.rotation / DEG) : key === 'scalePct' ? Math.round(actor.scale * 100) : actor[key].toFixed(2);
      for (const input of $$(`[data-stage-actor-field="${key}"]`)) {
        if (document.activeElement !== input || input === committed) input.value = value;
        setOutput(input, `${value}${key === 'rotationDeg' ? '°' : key === 'scalePct' ? '%' : 'm'}`);
      }
    }
  }

  function syncPropInputs(prop, committed = null) {
    for (const key of ['x', 'y', 'z', 'rotationDeg', 'width', 'height', 'depth', 'scalePct']) {
      const dimension = ['width', 'height', 'depth'].includes(key);
      const value = dimension ? Number((prop[key] * prop.scale).toFixed(3)) : key === 'rotationDeg' ? round(prop.rotation / DEG) : key === 'scalePct' ? Math.round(prop.scale * 100) : prop[key].toFixed(2);
      for (const input of $$(`[data-stage-prop-field="${key}"]`)) {
        if (document.activeElement !== input || input === committed) input.value = value;
        if (dimension) { input.min = 0.1 * prop.scale; input.max = 10 * prop.scale; }
        setOutput(input, `${value}${key === 'rotationDeg' ? '°' : key === 'scalePct' ? '%' : 'm'}`);
      }
    }
  }

  function onPointerUp() {
    if (!editor?.gesture) return;
    const gesture = editor.gesture;
    editor.gesture = null;
    if (gesture.moved && ['move', 'rotate', 'move2d'].includes(gesture.type)) { pushHistory(); markDirty(); }
  }

  function onWheel(event) {
    if (!editor || editor.viewMode !== 'free' || editor.mode2d || editor.motionPreview || editor.motionJob) return;
    event.preventDefault();
    editor.orbitGoal.radius = clamp(editor.orbitGoal.radius * Math.exp(event.deltaY * 0.001), 1.2, 30, 4.6);
    if (editor.topDown) { editor.topDown = false; renderTools(); updateBadge(); }
  }

  function nudgeSelected(dx, dz) {
    const actor = selectedActor();
    const prop = selectedProp();
    const item = actor || prop;
    if (!item || item.locked) return;
    item.x = clamp(item.x + dx, -14, 14, 0);
    item.z = clamp(item.z + dz, -14, 14, 0);
    if (actor) { applyActorTransform(actor); syncTransformInputs(actor); }
    else { applyPropTransform(prop); syncPropInputs(prop); }
    pushHistory(); markDirty();
  }

  function rotateSelected(delta) {
    const actor = selectedActor();
    const prop = selectedProp();
    const item = actor || prop;
    if (!item || item.locked) return;
    item.rotation = clamp(item.rotation + delta, -Math.PI * 4, Math.PI * 4, 0);
    if (actor) { applyActorTransform(actor); syncTransformInputs(actor); }
    else { applyPropTransform(prop); syncPropInputs(prop); }
    pushHistory(); markDirty();
  }

  function onKeyDown(event) {
    if (!editor) return;
    event.stopPropagation();
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if (editor.motionJob || editor.motionPreview) {
      if (event.key === 'Escape') { event.preventDefault(); if (editor.motionJob) cancelMotionExport(); else stopMotionPreview(); }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if ($('#stage-capture-modal') && !$('#stage-capture-modal').hidden) closeCapture();
      else close();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); markDirty(); editor.host?.toast?.('场景已保存'); return; }
    if (typing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateSelected(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (editor.selected?.type === 'actor') { event.preventDefault(); deleteSelectedActor(); }
      else if (editor.selected?.type === 'camera') { event.preventDefault(); deleteSelectedCamera(); }
      else if (editor.selected?.type === 'prop') { event.preventDefault(); deleteSelectedProp(); }
      return;
    }
    const step = event.shiftKey ? 0.5 : 0.1;
    if (event.key === 'ArrowUp') { event.preventDefault(); nudgeSelected(0, -step); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); nudgeSelected(0, step); return; }
    if (event.key === 'ArrowLeft') { event.preventDefault(); nudgeSelected(-step, 0); return; }
    if (event.key === 'ArrowRight') { event.preventDefault(); nudgeSelected(step, 0); return; }
    const lower = event.key.toLowerCase();
    if (lower === 'q') { rotateSelected(-5 * DEG); return; }
    if (lower === 'e') { rotateSelected(5 * DEG); return; }
    if (lower === 'g') { toggleEnvFlag('grid'); return; }
    if (lower === 'f') { const actor = selectedActor(); if (actor) focusActor(actor.id); return; }
    if (event.key === '1') setView('free');
    if (event.key === '2') setView('camera');
    if (event.key === '3') toggleTopDown();
  }

  function syncChrome() {
    if (!editor) return;
    $('#stage-title') && ($('#stage-title').textContent = editor.card.name || '导演台');
    $('#stage-view')?.classList.toggle('is-open', true);
    updateHistoryButtons();
    updateBadge();
  }

  window.StageDirector = {
    open,
    close,
    normalize,
    defaultStage,
    isOpen: () => !!editor,
    poses: () => Object.keys(POSES),
    _snapshot: () => editor ? snapshot() : null
  };
})();