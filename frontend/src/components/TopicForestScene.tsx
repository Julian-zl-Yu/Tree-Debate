import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TopicFeedItem } from '../api/types';
import { excerpt, formatDateTime, pluralize } from '../utils/format';

type SceneTheme = 'day' | 'night';

type TopicForestSceneProps = {
  topics: TopicFeedItem[];
  totalCount: number;
  theme: SceneTheme;
  hasMore: boolean;
  isLoadingMore: boolean;
  onNeedMore: () => void;
};

type HoverState = {
  topic: TopicFeedItem;
  rank: number;
  interactions: number;
  x: number;
  y: number;
};

type SceneTopic = {
  topic: TopicFeedItem;
  rank: number;
  heat: number;
  scale: number;
  x: number;
  z: number;
};

type SceneThemeConfig = {
  background: number;
  fog: number;
  ground: number;
  mountain: number;
  trunk: number;
  ambient: { color: number; intensity: number };
  directional: { color: number; intensity: number; position: [number, number, number] };
  hemisphere: { sky: number; ground: number; intensity: number };
  celestial: { color: number; light: number; intensity: number; radius: number; position: [number, number, number] };
  exposure: number;
};

type ForestTree = {
  group: THREE.Group;
  item: SceneTopic;
  growthStart: number;
};

type SceneRuntime = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  trees: Map<number, ForestTree>;
  visibleGroups: THREE.Group[];
  config: SceneThemeConfig;
  pathPosition: number;
  loadedMaxZ: number;
  lastRequestedMaxZ: number;
  needsSync: boolean;
};

type LoadStateRef = {
  current: {
    hasMore: boolean;
    isLoadingMore: boolean;
    onNeedMore: () => void;
  };
};

type LoadGateRef = {
  current: boolean;
};

const HEAT_COLORS = [
  0x4a7c59,
  0x8faa6b,
  0xa8bba3,
  0xd4a84b,
  0xe67e22,
  0xf39c12,
  0xc0392b,
  0xe74c3c,
  0x8b1a1a
];

const SCENE_THEMES: Record<SceneTheme, SceneThemeConfig> = {
  day: {
    background: 0xd4c9b5,
    fog: 0xd4c9b5,
    ground: 0x8faa6b,
    mountain: 0xb5c4b1,
    trunk: 0x5a3e2b,
    ambient: { color: 0xffffff, intensity: 0.8 },
    directional: { color: 0xffffff, intensity: 1.2, position: [50, 50, 20] },
    hemisphere: { sky: 0xc1cbd7, ground: 0xb5c4b1, intensity: 0.4 },
    celestial: { color: 0xffc94f, light: 0xffcc66, intensity: 1.05, radius: 3.05, position: [-25, 31, -24] },
    exposure: 1.8
  },
  night: {
    background: 0x172033,
    fog: 0x172033,
    ground: 0x53694f,
    mountain: 0x647070,
    trunk: 0x3e2a1c,
    ambient: { color: 0xb8c9e3, intensity: 0.56 },
    directional: { color: 0xe9f0ff, intensity: 0.9, position: [34, 38, -28] },
    hemisphere: { sky: 0x33486b, ground: 0x425843, intensity: 0.68 },
    celestial: { color: 0xf7fbff, light: 0xe0e8ff, intensity: 0.5, radius: 1.9, position: [25, 25, -30] },
    exposure: 1.08
  }
};

const MAX_VISIBLE_TREES = 120;
const KEEP_BEHIND_DISTANCE = 58;
const KEEP_AHEAD_DISTANCE = 132;
const LOAD_AHEAD_DISTANCE = 34;
const ROW_SPACING = 8.5;
const GROWTH_MS = 300;
const DETAIL_INTRO_KEY = 'treedebate.detailIntro';
const GROUND_WIDTH = 240;
const GROUND_DEPTH = 6400;
const GROUND_START_Z = -180;
const GROUND_Z_CENTER = GROUND_START_Z + GROUND_DEPTH / 2;
const GROUND_SEGMENTS_X = 72;
const GROUND_SEGMENTS_Z = 960;

export function TopicForestScene({ topics, totalCount, theme, hasMore, isLoadingMore, onNeedMore }: TopicForestSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const sceneTopicsRef = useRef<SceneTopic[]>([]);
  const hoverRef = useRef<HoverState | null>(null);
  const hoverTreeRef = useRef<THREE.Group | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const pathPositionRef = useRef(0);
  const loadGateRef = useRef(false);
  const loadStateRef = useRef({ hasMore, isLoadingMore, onNeedMore });
  const [hover, setHover] = useState<HoverState | null>(null);
  const navigate = useNavigate();

  const sceneTopics = useMemo(
    () =>
      topics.map((topic, index) => {
        const rank = index + 1;
        const rankBasis = Math.max(totalCount, topics.length, 120);
        const rankProgress = Math.max(0, 1 - Math.log1p(rank - 1) / Math.log1p(rankBasis));
        const position = topicPosition(rank);
        return {
          topic,
          rank,
          heat: Math.min(HEAT_COLORS.length - 1, Math.floor(rankProgress * (HEAT_COLORS.length - 1))),
          scale: 0.58 + Math.pow(rankProgress, 1.1) * 1.42,
          x: position.x,
          z: position.z
        };
      }),
    [topics, totalCount]
  );

  useEffect(() => {
    sceneTopicsRef.current = sceneTopics;
    const runtime = runtimeRef.current;
    if (runtime) {
      runtime.needsSync = true;
      runtime.loadedMaxZ = maxTopicZ(sceneTopics);
    }
  }, [sceneTopics]);

  useEffect(() => {
    loadStateRef.current = { hasMore, isLoadingMore, onNeedMore };
    if (!isLoadingMore) loadGateRef.current = false;
  }, [hasMore, isLoadingMore, onNeedMore, topics.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const themeConfig = SCENE_THEMES[theme];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(themeConfig.background);
    scene.fog = new THREE.Fog(themeConfig.fog, 20, 100);

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 620;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1800);
    const initialPath = pathPositionRef.current;
    camera.position.set(24, 16, initialPath - 24);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = themeConfig.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = true;
    controls.autoRotateSpeed = theme === 'day' ? 0.7 : 0.6;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.minDistance = 15;
    controls.maxDistance = 58;
    controls.target.set(0, 0, initialPath);

    const runtime: SceneRuntime = {
      scene,
      camera,
      renderer,
      controls,
      raycaster: new THREE.Raycaster(),
      mouse: new THREE.Vector2(),
      trees: new Map(),
      visibleGroups: [],
      config: themeConfig,
      pathPosition: initialPath,
      loadedMaxZ: maxTopicZ(sceneTopicsRef.current),
      lastRequestedMaxZ: -1,
      needsSync: true
    };
    runtimeRef.current = runtime;

    addLights(scene, themeConfig);
    createCelestialBody(scene, themeConfig, theme);
    if (theme === 'night') createStars(scene);
    createGround(scene, themeConfig);
    createMountains(scene, themeConfig);
    syncTreeWindow(runtime, sceneTopicsRef.current, performance.now(), true);

    let animationFrame = 0;
    let transitionFrame = 0;
    let isTransitioning = false;

    const handlePointerDown = (event: PointerEvent) => {
      pointerDownRef.current = { x: event.clientX, y: event.clientY };
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      runtime.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      runtime.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      runtime.raycaster.setFromCamera(runtime.mouse, camera);
      const intersects = runtime.raycaster.intersectObjects(runtime.visibleGroups, true);
      const tree = findTreeGroup(intersects[0]?.object);

      if (!tree) {
        hoverRef.current = null;
        hoverTreeRef.current = null;
        setHover(null);
        renderer.domElement.style.cursor = 'grab';
        return;
      }

      const item = tree.userData.item as SceneTopic;
      const nextHover = {
        topic: item.topic,
        rank: item.rank,
        interactions: activityScore(item.topic),
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      hoverRef.current = nextHover;
      hoverTreeRef.current = tree;
      setHover(nextHover);
      renderer.domElement.style.cursor = 'pointer';
    };

    const handleClick = (event: MouseEvent) => {
      const start = pointerDownRef.current;
      const moved = start ? Math.hypot(event.clientX - start.x, event.clientY - start.y) : 0;
      if (moved > 6 || !hoverRef.current || !hoverTreeRef.current || isTransitioning) return;
      isTransitioning = true;
      const topicId = hoverRef.current.topic.id;
      hoverRef.current = null;
      setHover(null);
      renderer.domElement.style.cursor = 'default';
      renderer.domElement.style.pointerEvents = 'none';
      controls.enabled = false;
      storeDetailIntro(topicId);
      transitionFrame = animateCameraToTree(runtime, hoverTreeRef.current, () => navigate(`/topics/${topicId}`));
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const direction = Math.sign(event.deltaY);
      const distance = direction * Math.min(9, Math.max(2, Math.abs(event.deltaY) * 0.035));
      moveAlongPath(runtime, distance);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') moveAlongPath(runtime, 5);
      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') moveAlongPath(runtime, -5);
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('click', handleClick);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = container.clientWidth || 900;
      const nextHeight = container.clientHeight || 620;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    });
    resizeObserver.observe(container);

    const animate = () => {
      const now = performance.now();
      if (runtime.needsSync) syncTreeWindow(runtime, sceneTopicsRef.current, now, false);
      animateTrees(runtime, now);
      pathPositionRef.current = runtime.pathPosition;
      maybeRequestMore(runtime, loadStateRef, loadGateRef);
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      cancelAnimationFrame(transitionFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      controls.dispose();
      for (const tree of runtime.trees.values()) disposeTree(runtime, tree);
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) disposeObject(object);
      });
      container.removeChild(renderer.domElement);
      runtimeRef.current = null;
      hoverRef.current = null;
      hoverTreeRef.current = null;
      setHover(null);
    };
  }, [navigate, theme]);

  const totalInteractions = topics.reduce((sum, topic) => sum + activityScore(topic), 0);

  return (
    <div className={`forest-scene-shell forest-scene-${theme}`}>
      <div ref={containerRef} className="forest-canvas-container" />
      <div className="forest-overlay" aria-hidden="true">
        <div className="forest-stats-panel">
          <span>Current grove</span>
          <strong>
            {topics.length}/{totalCount}
          </strong>
          <small>loaded topics</small>
          <strong>{totalInteractions}</strong>
          <small>interactions</small>
        </div>
        <div className="forest-hint">Auto orbit is on - Drag to rotate - Scroll to walk forward</div>
      </div>
      {hover && (
        <div className="forest-hover-bubble" style={{ left: hover.x, top: hover.y }}>
          <div className="topic-meta">
            <strong className="category-chip">{hover.topic.category}</strong>
            <span>global rank #{hover.rank}</span>
            <span>u/{hover.topic.author}</span>
          </div>
          <h3>{hover.topic.title}</h3>
          <p>{excerpt(hover.topic.content, 120)}</p>
          <div className="forest-hover-stats">
            <span>{pluralize(hover.topic.opinionCount ?? 0, 'opinion')}</span>
            <span>{pluralize(hover.topic.replyCount ?? 0, 'reply', 'replies')}</span>
            <span>{formatDateTime(hover.topic.createdAt)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function moveAlongPath(runtime: SceneRuntime, distance: number) {
  const nextPath = Math.max(0, Math.min(runtime.loadedMaxZ + KEEP_AHEAD_DISTANCE * 0.72, runtime.pathPosition + distance));
  const delta = nextPath - runtime.pathPosition;
  if (Math.abs(delta) < 0.01) return;
  runtime.pathPosition = nextPath;
  pathShift(runtime.camera, runtime.controls, delta);
  runtime.needsSync = true;
}

function pathShift(camera: THREE.PerspectiveCamera, controls: OrbitControls, delta: number) {
  camera.position.z += delta;
  controls.target.z += delta;
}

function animateCameraToTree(runtime: SceneRuntime, tree: THREE.Group, onComplete: () => void) {
  const item = tree.userData.item as SceneTopic;
  const crownCenter = tree.position.clone().add(new THREE.Vector3(0, item.scale * 3.1, 0));
  const startCamera = runtime.camera.position.clone();
  const startTarget = runtime.controls.target.clone();
  const approach = startCamera.clone().sub(startTarget);
  if (approach.lengthSq() < 0.01) {
    approach.set(7, 4, -7);
  }
  const endCamera = crownCenter.clone().add(approach.normalize().multiplyScalar(Math.max(4.6, item.scale * 4.2)));
  const duration = 400;
  const startTime = performance.now();

  const step = (now: number): number => {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = easeInOutCubic(progress);
    runtime.camera.position.lerpVectors(startCamera, endCamera, eased);
    runtime.controls.target.lerpVectors(startTarget, crownCenter, eased);
    runtime.controls.update();
    if (progress < 1) {
      return requestAnimationFrame(step);
    }
    onComplete();
    return 0;
  };

  return requestAnimationFrame(step);
}

function storeDetailIntro(topicId: number) {
  try {
    sessionStorage.setItem(DETAIL_INTRO_KEY, JSON.stringify({ topicId, createdAt: Date.now() }));
  } catch {
    // The transition is decorative; navigation should still work if storage is unavailable.
  }
}

function syncTreeWindow(runtime: SceneRuntime, topics: SceneTopic[], now: number, immediate: boolean) {
  runtime.loadedMaxZ = maxTopicZ(topics);
  const candidates = topics
    .filter((item) => item.z >= runtime.pathPosition - KEEP_BEHIND_DISTANCE && item.z <= runtime.pathPosition + KEEP_AHEAD_DISTANCE)
    .sort((a, b) => Math.abs(a.z - runtime.pathPosition) - Math.abs(b.z - runtime.pathPosition))
    .slice(0, MAX_VISIBLE_TREES);
  const activeIds = new Set(candidates.map((item) => item.topic.id));

  for (const tree of [...runtime.trees.values()]) {
    if (!activeIds.has(tree.item.topic.id)) {
      disposeTree(runtime, tree);
      runtime.trees.delete(tree.item.topic.id);
    }
  }

  for (const item of candidates) {
    const existing = runtime.trees.get(item.topic.id);
    if (existing) {
      existing.item = item;
      existing.group.userData.item = item;
      continue;
    }
    const position = new THREE.Vector3(item.x, groundYAt(item.x, item.z) - 0.20, item.z);
    const tree = createTree(runtime.scene, item, position, runtime.config, immediate ? 0 : now);
    runtime.trees.set(item.topic.id, tree);
  }

  runtime.visibleGroups = [...runtime.trees.values()].map((tree) => tree.group);
  runtime.needsSync = false;
}

function animateTrees(runtime: SceneRuntime, now: number) {
  for (const tree of runtime.trees.values()) {
    const progress = tree.growthStart ? Math.min(1, (now - tree.growthStart) / GROWTH_MS) : 1;
    const eased = easeOutCubic(progress);
    const treeParts = tree.group.userData.treeParts as THREE.Group;
    treeParts.scale.setScalar(0.08 + eased * 0.92);

    const bud = tree.group.userData.bud as THREE.Mesh | undefined;
    if (bud) {
      bud.visible = progress < 1;
      const material = bud.material as THREE.MeshPhongMaterial;
      material.opacity = Math.max(0, 1 - progress);
    }
    if (progress >= 1) tree.growthStart = 0;

    tree.group.rotation.z = Math.sin(now * tree.group.userData.swingSpeed + tree.group.userData.swingOffset) * 0.02;
    tree.group.rotation.x = Math.cos(now * tree.group.userData.swingSpeed + tree.group.userData.swingOffset) * 0.02;
  }
}

function maybeRequestMore(runtime: SceneRuntime, loadStateRef: LoadStateRef, loadGateRef: LoadGateRef) {
  const loadState = loadStateRef.current;
  const closeToLoadedEdge = runtime.loadedMaxZ - runtime.pathPosition < LOAD_AHEAD_DISTANCE;
  if (
    !closeToLoadedEdge ||
    !loadState.hasMore ||
    loadState.isLoadingMore ||
    loadGateRef.current ||
    runtime.lastRequestedMaxZ === runtime.loadedMaxZ
  ) {
    return;
  }
  runtime.lastRequestedMaxZ = runtime.loadedMaxZ;
  loadGateRef.current = true;
  loadState.onNeedMore();
}

function addLights(scene: THREE.Scene, config: SceneThemeConfig) {
  scene.add(new THREE.AmbientLight(config.ambient.color, config.ambient.intensity));

  const dirLight = new THREE.DirectionalLight(config.directional.color, config.directional.intensity);
  dirLight.position.set(...config.directional.position);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.camera.top = 50;
  dirLight.shadow.camera.bottom = -50;
  scene.add(dirLight);

  scene.add(new THREE.HemisphereLight(config.hemisphere.sky, config.hemisphere.ground, config.hemisphere.intensity));

  const groundFill = new THREE.PointLight(0xccaa77, 0.35);
  groundFill.position.set(0, -3, 0);
  groundFill.distance = 60;
  scene.add(groundFill);
}

function createCelestialBody(scene: THREE.Scene, config: SceneThemeConfig, theme: SceneTheme) {
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(config.celestial.radius, 24, 16),
    new THREE.MeshBasicMaterial({ color: config.celestial.color })
  );
  body.position.set(...config.celestial.position);
  scene.add(body);

  const glow = new THREE.PointLight(config.celestial.light, config.celestial.intensity, 108);
  glow.position.copy(body.position);
  scene.add(glow);

  const glowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture(),
      color: config.celestial.light,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: theme === 'day' ? 0.72 : 0.3,
      depthWrite: false
    })
  );
  glowSprite.position.copy(body.position);
  const glowScale = theme === 'day' ? 18 : 8;
  glowSprite.scale.set(glowScale, glowScale, 1);
  scene.add(glowSprite);

  if (theme === 'day') {
    const flare = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createGlowTexture(),
        color: 0xfff1c2,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.36,
        depthWrite: false
      })
    );
    flare.position.set(config.celestial.position[0] + 7, config.celestial.position[1] - 6, config.celestial.position[2] + 7);
    flare.scale.set(28, 28, 1);
    scene.add(flare);
  }
}

function createGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.22, 'rgba(255,236,174,0.78)');
  gradient.addColorStop(0.48, 'rgba(255,204,102,0.32)');
  gradient.addColorStop(1, 'rgba(255,204,102,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStars(scene: THREE.Scene) {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  for (let i = 0; i < 90; i++) {
    const angle = i * 1.37;
    const radius = 42 + (i % 11) * 4.2;
    positions.push(Math.cos(angle) * radius, 22 + (i % 13) * 2.1, Math.sin(angle) * radius);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xeef4ff, size: 0.13, sizeAttenuation: true, transparent: true, opacity: 0.82 })
  );
  scene.add(stars);
}

function createGround(scene: THREE.Scene, config: SceneThemeConfig) {
  const geometry = new THREE.PlaneGeometry(GROUND_WIDTH, GROUND_DEPTH, GROUND_SEGMENTS_X, GROUND_SEGMENTS_Z);
  const vertices = geometry.attributes.position.array;

  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i + 2] = groundYAt(vertices[i], groundWorldZFromLocalY(vertices[i + 1]));
  }

  geometry.computeVertexNormals();
  const material = new THREE.MeshPhongMaterial({
    color: config.ground,
    flatShading: true,
    shininess: 0
  });
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = GROUND_Z_CENTER;
  ground.receiveShadow = true;
  scene.add(ground);
}

function createMountains(scene: THREE.Scene, config: SceneThemeConfig) {
  for (let i = 0; i < 14; i++) {
    const height = 10 + ((i * 7) % 13);
    const radius = 15 + ((i * 5) % 9);
    const geometry = new THREE.ConeGeometry(radius, height, 4);
    const material = new THREE.MeshPhongMaterial({
      color: config.mountain,
      flatShading: true,
      transparent: true,
      opacity: 0.7
    });
    const mountain = new THREE.Mesh(geometry, material);
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (58 + (i % 4) * 14);
    const z = -26 + i * 74;
    mountain.position.set(x, height / 2 - 2, z);
    mountain.rotation.y = i * 0.62;
    scene.add(mountain);
  }

  const hillPositions = [
    { x: -42, z: 20, height: 6, radius: 12 },
    { x: 45, z: 35, height: 7, radius: 14 },
    { x: -38, z: 80, height: 5, radius: 10 },
    { x: 50, z: 100, height: 8, radius: 16 },
    { x: -48, z: 150, height: 6, radius: 13 },
    { x: 42, z: 180, height: 5, radius: 11 },
    { x: -35, z: 250, height: 7, radius: 15 },
    { x: 55, z: 280, height: 6, radius: 12 }
  ];

  hillPositions.forEach((hill) => {
    const geometry = new THREE.ConeGeometry(hill.radius, hill.height, 8);
    const material = new THREE.MeshPhongMaterial({
      color: config.mountain,
      flatShading: true,
      transparent: true,
      opacity: 0.85,
      shininess: 15,
      emissive: 0x443311,
      emissiveIntensity: 0.12
    });
    const hillMesh = new THREE.Mesh(geometry, material);
    hillMesh.position.set(hill.x, hill.height / 2 - 1.5, hill.z);
    hillMesh.castShadow = true;
    hillMesh.receiveShadow = true;
    scene.add(hillMesh);
  });
}

function createTree(scene: THREE.Scene, item: SceneTopic, position: THREE.Vector3, config: SceneThemeConfig, growthStart: number) {
  const group = new THREE.Group();
  const treeParts = new THREE.Group();
  const scale = item.scale;
  const trunkHeight = 2 * scale;
  const trunkRadius = 0.2 * scale;
  const foliageColor = heatColor(item.heat);
  const foliageMaterial = new THREE.MeshPhongMaterial({ color: foliageColor, flatShading: true });

  const bud = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42 * scale, 0),
    new THREE.MeshPhongMaterial({ color: foliageColor, flatShading: true, transparent: true, opacity: growthStart ? 1 : 0 })
  );
  bud.position.y = 0.42 * scale;
  bud.castShadow = true;
  bud.receiveShadow = true;
  bud.visible = Boolean(growthStart);
  group.add(bud);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 6),
    new THREE.MeshPhongMaterial({ color: config.trunk, flatShading: true })
  );
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  treeParts.add(trunk);

  const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 * scale, 0), foliageMaterial);
  foliage.position.y = trunkHeight + 1 * scale;
  foliage.castShadow = true;
  foliage.receiveShadow = true;
  treeParts.add(foliage);

  const offsets = [
    [-0.62, 0.42, -0.36],
    [0.48, 0.88, 0.18],
    [0.08, 1.28, -0.48]
  ];
  offsets.forEach(([x, y, z], index) => {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48 * scale, 0), foliageMaterial.clone());
    leaf.position.set(x * scale, trunkHeight + y * scale, z * scale);
    leaf.rotation.set(index * 0.4, index * 0.7, index * 0.3);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    treeParts.add(leaf);
  });

  const topTips = [
    [-0.32, 1.92, -0.08, -0.28],
    [0, 2.16, 0.04, 0.08],
    [0.34, 1.9, 0.1, 0.32]
  ];
  topTips.forEach(([x, y, z, tilt], index) => {
    const tip = new THREE.Mesh(new THREE.TetrahedronGeometry(0.34 * scale, 0), foliageMaterial.clone());
    tip.position.set(x * scale, trunkHeight + y * scale, z * scale);
    tip.rotation.set(0.34 + index * 0.22, tilt, 0.18 + index * 0.28);
    tip.scale.set(0.82, 1.22, 0.82);
    tip.castShadow = true;
    tip.receiveShadow = true;
    treeParts.add(tip);
  });

  treeParts.scale.setScalar(growthStart ? 0.08 : 1);
  group.add(treeParts);
  group.position.copy(position);
  group.name = 'topic-tree';
  group.userData = {
    item,
    treeParts,
    bud,
    swingOffset: item.rank * 0.73,
    swingSpeed: 0.001 + (item.rank % 5) * 0.00035
  };
  group.traverse((object) => {
    object.userData.treeGroup = group;
  });
  scene.add(group);
  return { group, item, growthStart };
}

function disposeTree(runtime: SceneRuntime, tree: ForestTree) {
  runtime.scene.remove(tree.group);
  tree.group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points) disposeObject(object);
  });
}

function disposeObject(object: THREE.Mesh | THREE.Points) {
  object.geometry.dispose();
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  materials.forEach((material) => {
    const texturedMaterial = material as THREE.Material & { map?: THREE.Texture | null };
    texturedMaterial.map?.dispose();
    material.dispose();
  });
}

function topicPosition(rank: number) {
  if (rank === 1) return { x: 0, z: 0 };
  const index = rank - 1;
  const row = Math.floor(index / 3);
  const slot = index % 3;
  const lanes = row % 2 === 0 ? [0, -13, 13] : [-7, 9, -18];
  const zOffsets = [0, 3, -2];
  return {
    x: lanes[slot] + seededOffset(rank, 2.6),
    z: row * ROW_SPACING + zOffsets[slot]
  };
}

function seededOffset(seed: number, range: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return (value - Math.floor(value) - 0.5) * range;
}

function maxTopicZ(topics: SceneTopic[]) {
  return topics.reduce((max, item) => Math.max(max, item.z), 0);
}

function heatColor(heat: number) {
  return HEAT_COLORS[Math.max(0, Math.min(heat, HEAT_COLORS.length - 1))];
}

function groundWorldZFromLocalY(localY: number) {
  return GROUND_Z_CENTER - localY;
}

function groundYAt(x: number, z: number) {
  return Math.sin(x * 0.2) * Math.cos(z * 0.2) * 1.5;
}

function findTreeGroup(object?: THREE.Object3D) {
  let current: THREE.Object3D | null | undefined = object;
  while (current) {
    if (current.name === 'topic-tree') return current as THREE.Group;
    current = current.parent;
  }
  return null;
}

function activityScore(topic: TopicFeedItem) {
  return (topic.opinionCount ?? 0) + (topic.replyCount ?? 0);
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}
