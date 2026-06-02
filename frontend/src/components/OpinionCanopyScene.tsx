import { Flag, Heart, MessageSquare, Pencil, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { OpinionNode, Stance } from '../api/types';
import { excerpt, formatDateTime } from '../utils/format';
import { StanceBadge } from './StanceBadge';

type OpinionCanopySceneProps = {
  topicTitle: string;
  topicContent: string;
  topicCategory?: string;
  topicAuthor?: string;
  nodes: OpinionNode[];
  currentUserId?: number;
  onReply: (node: OpinionNode) => void;
  onEdit: (node: OpinionNode) => void;
  onLike: (node: OpinionNode) => void;
  onReport: (node: OpinionNode) => void;
};

type SceneLeaf = {
  node: OpinionNode;
  position: THREE.Vector3;
  branchStart: THREE.Vector3;
  branchControlA: THREE.Vector3;
  branchControlB: THREE.Vector3;
  branchEnd: THREE.Vector3;
  angle: number;
  normal: THREE.Vector3;
  scale: number;
  twist: number;
  growDelay: number;
  windAxis: THREE.Vector3;
};

type TreeFrame = {
  baseY: number;
  topY: number;
  height: number;
  trunkCenter: THREE.Vector3;
  crownCenter: THREE.Vector3;
  visiblePoints: THREE.Vector3[];
};

type HoverState = {
  node: OpinionNode;
  x: number;
  y: number;
};

type ModelStatus = 'loading' | 'ready' | 'error';

type Runtime = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  leafGroups: THREE.Group[];
  animationFrame: number;
};

const mapleModelUrl = '/models/maple-tree.glb';
const treeTargetHeight = 11.6;
const canopyBranchSlots = 11;

export function OpinionCanopyScene(props: OpinionCanopySceneProps) {
  const { topicTitle, topicContent, topicCategory, topicAuthor, nodes, currentUserId, onReply, onEdit, onLike, onReport } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const hoverRef = useRef<HoverState | null>(null);
  const hoverIdRef = useRef<number | null>(null);
  const selectedIdRef = useRef<number | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [selected, setSelected] = useState<OpinionNode | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>('loading');

  useEffect(() => {
    selectedIdRef.current = selected?.id ?? null;
  }, [selected]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    setModelStatus('loading');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0ebdf);
    scene.fog = new THREE.Fog(0xf0ebdf, 22, 72);

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 620;
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 240);
    camera.position.set(8.5, 9.2, 18);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 8;
    controls.maxDistance = 36;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.target.set(0, 6.1, 1.3);

    const runtime: Runtime = {
      scene,
      camera,
      renderer,
      controls,
      raycaster: new THREE.Raycaster(),
      mouse: new THREE.Vector2(),
      leafGroups: [],
      animationFrame: 0
    };
    runtimeRef.current = runtime;

    addCanopyLights(scene);
    addGround(scene);
    addAtmosphere(scene);
    void loadMapleTreeModel()
      .then(({ tree, frame }) => {
        if (disposed) {
          tree.traverse(disposeObject);
          return;
        }
        scene.add(tree);
        const layout = createCanopyLayout(nodes, frame);
        layout.leaves.forEach((leaf) => addOpinionBranch(scene, leaf));
        runtime.leafGroups = layout.leaves.map((leaf) => addLeaf(scene, leaf));
        setModelStatus('ready');
      })
      .catch((error) => {
        console.error('Failed to load maple tree model', error);
        if (!disposed) {
          setModelStatus('error');
        }
      });
    const handlePointerDown = (event: PointerEvent) => {
      pointerDownRef.current = { x: event.clientX, y: event.clientY };
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      runtime.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      runtime.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      runtime.raycaster.setFromCamera(runtime.mouse, camera);
      const intersects = runtime.raycaster.intersectObjects(runtime.leafGroups, true);
      const leafGroup = findLeafGroup(intersects[0]?.object);

      if (!leafGroup) {
        hoverRef.current = null;
        hoverIdRef.current = null;
        setHover(null);
        renderer.domElement.style.cursor = 'grab';
        return;
      }

      const node = leafGroup.userData.node as OpinionNode;
      const nextHover = { node, x: event.clientX - rect.left, y: event.clientY - rect.top };
      hoverRef.current = nextHover;
      hoverIdRef.current = node.id;
      setHover(nextHover);
      renderer.domElement.style.cursor = 'pointer';
    };

    const handlePointerLeave = () => {
      hoverRef.current = null;
      hoverIdRef.current = null;
      setHover(null);
      renderer.domElement.style.cursor = 'grab';
    };

    const handleClick = (event: MouseEvent) => {
      const start = pointerDownRef.current;
      const moved = start ? Math.hypot(event.clientX - start.x, event.clientY - start.y) : 0;
      if (moved > 6 || !hoverRef.current) return;
      setSelected(hoverRef.current.node);
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('click', handleClick);

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = container.clientWidth || 960;
      const nextHeight = container.clientHeight || 620;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    });
    resizeObserver.observe(container);

    const animate = () => {
      const now = performance.now();
      for (const group of runtime.leafGroups) {
        const node = group.userData.node as OpinionNode;
        const basePosition = group.userData.basePosition as THREE.Vector3;
        const wind = Math.sin(now * group.userData.swingSpeed + group.userData.swingOffset);
        group.position.copy(basePosition);
        const normal = group.userData.normal as THREE.Vector3;
        group.lookAt(group.position.clone().add(normal));
        group.rotateZ(wind * 0.08 + group.userData.baseRotation);
        const growProgress = clamp((now - group.userData.growStart) / 620, 0, 1);
        const easedGrow = 1 - Math.pow(1 - growProgress, 3);
        const activeScale = node.id === selectedIdRef.current ? 1.2 : node.id === hoverIdRef.current ? 1.08 : 1;
        const targetScale = Math.max(0.001, activeScale * easedGrow);
        const nextScale = group.scale.x + (targetScale - group.scale.x) * 0.14;
        group.scale.setScalar(nextScale);
      }
      controls.update();
      renderer.render(scene, camera);
      runtime.animationFrame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(runtime.animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.removeEventListener('click', handleClick);
      controls.dispose();
      scene.traverse(disposeObject);
      renderer.dispose();
      container.removeChild(renderer.domElement);
      runtimeRef.current = null;
      hoverRef.current = null;
      hoverIdRef.current = null;
      setHover(null);
    };
  }, [nodes]);

  const selectedIsOwner = selected ? currentUserId === selected.authorId : false;

  return (
    <section className="canopy-shell">
      <div ref={containerRef} className="canopy-canvas" />
      {modelStatus !== 'ready' && (
        <div className={`canopy-model-status canopy-model-status-${modelStatus}`}>
          {modelStatus === 'loading' ? 'Loading maple model' : 'Maple model failed to load'}
        </div>
      )}
      <div className="canopy-topic-card">
        <div className="topic-meta">
          {topicCategory && <strong className="category-chip">{topicCategory}</strong>}
          {topicAuthor && <span>u/{topicAuthor}</span>}
        </div>
        <h2>{topicTitle}</h2>
        <p>{excerpt(topicContent, 132)}</p>
      </div>
      <div className="canopy-hint">Drag to orbit - Scroll to zoom - Click a leaf to inspect</div>
      {hover && (
        <div className="canopy-hover-card" style={{ left: hover.x, top: hover.y }}>
          <div className="opinion-meta">
            <StanceBadge stance={hover.node.stance} />
            <span>u/{hover.node.author}</span>
          </div>
          <p>{hover.node.folded ? 'This opinion is folded pending moderation.' : excerpt(hover.node.content, 118)}</p>
        </div>
      )}
      {selected && (
        <aside className="canopy-inspector">
          <button className="canopy-close" onClick={() => setSelected(null)} type="button" title="Close">
            <X size={16} />
          </button>
          <div className="opinion-meta">
            <StanceBadge stance={selected.stance} />
            <span>topic {selected.effectiveTopicStance}</span>
            {selected.folded && <span className="folded-label">Folded</span>}
          </div>
          <p>{selected.folded ? 'This opinion is folded pending moderation.' : selected.content}</p>
          <div className="mind-node-footer">
            <span>u/{selected.author}</span>
            <span>{formatDateTime(selected.createdAt)}</span>
          </div>
          <div className="opinion-actions">
            {!selectedIsOwner && (
              <button type="button" onClick={() => onReply(selected)}>
                <MessageSquare size={15} />
                Reply
              </button>
            )}
            {selectedIsOwner && (
              <button type="button" onClick={() => onEdit(selected)}>
                <Pencil size={15} />
                Edit
              </button>
            )}
            <button type="button" onClick={() => onLike(selected)}>
              <Heart size={15} />
              Like
            </button>
            <button type="button" onClick={() => onReport(selected)}>
              <Flag size={15} />
              Report
            </button>
          </div>
        </aside>
      )}
    </section>
  );
}

function createCanopyLayout(nodes: OpinionNode[], frame: TreeFrame) {
  const flatNodes = flattenOpinionNodes(nodes);
  flatNodes.sort((a, b) => a.id - b.id);
  const leaves = flatNodes.map((node, index) => createOpinionLeaf(node, index, flatNodes.length, frame));
  return { leaves };
}

function flattenOpinionNodes(nodes: OpinionNode[]): OpinionNode[] {
  const flatNodes: OpinionNode[] = [];
  const stack = [...nodes];

  while (stack.length > 0) {
    const node = stack.shift();
    if (!node) continue;
    flatNodes.push(node);
    stack.push(...node.children);
  }

  return flatNodes;
}

function createOpinionLeaf(node: OpinionNode, index: number, total: number, frame: TreeFrame): SceneLeaf {
  const safeTotal = Math.max(1, total);
  const foldedScale = node.folded ? 0.78 : 1;
  const scale = clamp(0.92 - safeTotal * 0.004, 0.56, 0.9) * (0.9 + seeded(node.id + 71) * 0.22) * foldedScale;
  const branchSlot = index % canopyBranchSlots;
  const branchLayer = Math.floor(index / canopyBranchSlots);
  const slotAngle = (branchSlot / canopyBranchSlots) * Math.PI * 2;
  const layerTurn = branchLayer * 0.31;
  const angle = slotAngle + layerTurn + (seeded(node.id + 13) - 0.5) * 0.18;
  const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize();
  const side = new THREE.Vector3(-outward.z, 0, outward.x).normalize();
  const heightSlot = ((branchSlot * 3 + branchLayer * 2) % 9) / 8;
  const branchEndY = clamp(
    frame.baseY + frame.height * (0.36 + heightSlot * 0.44) + (seeded(node.id + 31) - 0.5) * frame.height * 0.04,
    frame.baseY + frame.height * 0.34,
    frame.baseY + frame.height * 0.86
  );
  const branchStartY = clamp(
    branchEndY - frame.height * (0.1 + seeded(node.id + 83) * 0.14),
    frame.baseY + frame.height * 0.2,
    frame.baseY + frame.height * 0.62
  );
  const radialLayer = branchLayer % 4;
  const radialDistance = clamp(
    frame.height * (0.18 + radialLayer * 0.036 + seeded(node.id + 23) * 0.09),
    frame.height * 0.17,
    frame.height * 0.39
  );
  const sideOffset = (seeded(node.id + 101) - 0.5) * frame.height * 0.038;
  const branchStartCenter = trunkCenterAt(branchStartY, frame);
  const branchStartRadius = trunkRadiusAt(branchStartY, frame);
  const branchStart = new THREE.Vector3(
    branchStartCenter.x + outward.x * branchStartRadius,
    branchStartY,
    branchStartCenter.z + outward.z * branchStartRadius
  );
  const branchEnd = new THREE.Vector3(
    frame.crownCenter.x + outward.x * radialDistance + side.x * sideOffset,
    branchEndY,
    frame.crownCenter.z + outward.z * radialDistance + side.z * sideOffset
  );
  const position = branchEnd
    .clone()
    .add(outward.clone().multiplyScalar(0.24 + scale * 0.16))
    .add(new THREE.Vector3(0, 0.44 * scale, 0));
  const branchControlA = branchStart
    .clone()
    .add(outward.clone().multiplyScalar(frame.height * (0.07 + seeded(node.id + 151) * 0.05)))
    .add(new THREE.Vector3(0, frame.height * (0.024 + seeded(node.id + 163) * 0.028), 0))
    .add(side.clone().multiplyScalar(sideOffset * 0.18));
  const branchControlB = branchStart
    .clone()
    .lerp(branchEnd, 0.72)
    .add(outward.clone().multiplyScalar(frame.height * (0.028 + seeded(node.id + 181) * 0.034)))
    .add(new THREE.Vector3(0, frame.height * (0.014 + seeded(node.id + 191) * 0.022), 0))
    .add(side.clone().multiplyScalar(sideOffset * 0.42));
  const normal = outward.clone().add(new THREE.Vector3(0, 0.16, 0)).normalize();

  return {
    node,
    position,
    branchStart,
    branchControlA,
    branchControlB,
    branchEnd,
    angle,
    normal,
    scale,
    twist: (seeded(node.id + 37) - 0.5) * 0.82,
    growDelay: index * 32 + seeded(node.id + 41) * 180,
    windAxis: side
  };
}

function trunkRadiusAt(height: number, frame: TreeFrame) {
  const fallbackRadius = fallbackTrunkRadiusAt(height, frame);
  const center = trunkCenterAt(height, frame);
  const nearbyPoints = trunkBandPoints(height, frame, 0.065);
  if (nearbyPoints.length === 0) return fallbackRadius;

  const distances = nearbyPoints
    .map((point) => Math.hypot(point.x - center.x, point.z - center.z))
    .filter((distance) => Number.isFinite(distance) && distance > 0.001)
    .sort((a, b) => a - b);
  if (distances.length === 0) return fallbackRadius;

  const sampleCount = Math.min(distances.length, Math.max(8, Math.floor(distances.length * 0.42)));
  const centralDistances = distances.slice(0, sampleCount);
  const sampledRadius = percentile(centralDistances, 0.78);
  return clamp(sampledRadius, fallbackRadius * 0.72, frame.height * 0.082);
}

function trunkCenterAt(height: number, frame: TreeFrame) {
  const nearbyPoints = trunkBandPoints(height, frame, 0.08).sort(
    (a, b) => radialDistanceToFrameCenter(a, frame) - radialDistanceToFrameCenter(b, frame)
  );
  const sampleCount = Math.min(nearbyPoints.length, Math.max(12, Math.floor(nearbyPoints.length * 0.34)));
  const samples = nearbyPoints.slice(0, sampleCount);

  return samples.length > 0 ? averageXZ(samples, height) : new THREE.Vector3(frame.trunkCenter.x, height, frame.trunkCenter.z);
}

function trunkBandPoints(height: number, frame: TreeFrame, bandScale: number) {
  const band = frame.height * bandScale;
  return frame.visiblePoints.filter((point) => Math.abs(point.y - height) <= band);
}

function fallbackTrunkRadiusAt(height: number, frame: TreeFrame) {
  const t = clamp((height - frame.baseY) / frame.height, 0, 1);
  return clamp(frame.height * (0.042 - t * 0.026), frame.height * 0.015, frame.height * 0.042);
}

function radialDistanceToFrameCenter(point: THREE.Vector3, frame: TreeFrame) {
  return Math.hypot(point.x - frame.trunkCenter.x, point.z - frame.trunkCenter.z);
}

function percentile(sortedValues: number[], ratio: number) {
  if (sortedValues.length === 0) return 0;
  const index = clamp(Math.round((sortedValues.length - 1) * ratio), 0, sortedValues.length - 1);
  return sortedValues[index];
}

function seeded(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function addCanopyLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xf8fbff, 0x9a845f, 1.45));
  const key = new THREE.DirectionalLight(0xffdf9c, 2.35);
  key.position.set(-9, 19, 11);
  key.castShadow = true;
  key.shadow.mapSize.width = 2048;
  key.shadow.mapSize.height = 2048;
  key.shadow.camera.left = -18;
  key.shadow.camera.right = 18;
  key.shadow.camera.top = 18;
  key.shadow.camera.bottom = -18;
  scene.add(key);
  const fill = new THREE.PointLight(0xb9d5ff, 0.78, 42);
  fill.position.set(8, 7, -8);
  scene.add(fill);
}

function addGround(scene: THREE.Scene) {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(18, 72),
    new THREE.MeshPhongMaterial({ color: 0xd8c79e, shininess: 10, specular: 0xf8edcf })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  for (let i = 0; i < 26; i += 1) {
    const angle = i * 1.618;
    const radius = 2.5 + (i % 9) * 1.35;
    const leaf = new THREE.Mesh(
      createCurvedLeafGeometry(0.58),
      new THREE.MeshPhongMaterial({
        map: createMapleLeafTexture(i % 3 === 0 ? 'DISAGREE' : i % 3 === 1 ? 'AGREE' : 'NEUTRAL', i + 500, false),
        transparent: true,
        alphaTest: 0.08,
        side: THREE.DoubleSide,
        opacity: 0.58
      })
    );
    leaf.position.set(Math.cos(angle) * radius, 0.035, Math.sin(angle) * radius);
    leaf.rotation.set(-Math.PI / 2, 0, angle + (seeded(i + 34) - 0.5));
    leaf.receiveShadow = true;
    scene.add(leaf);
  }
}

function addAtmosphere(scene: THREE.Scene) {
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd477 })
  );
  sun.position.set(-8.5, 13, -8);
  scene.add(sun);

  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(8.5, 32, 16),
    new THREE.MeshBasicMaterial({
      color: 0xffedc2,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  haze.position.set(0, 6.6, 0);
  scene.add(haze);
}

function loadMapleTreeModel() {
  const loader = new GLTFLoader();
  return new Promise<{ tree: THREE.Group; frame: TreeFrame }>((resolve, reject) => {
    loader.load(
      mapleModelUrl,
      (gltf) => {
        const root = gltf.scene;
        root.name = 'maple-tree-model';
        root.rotation.y = -0.18;
        root.updateMatrixWorld(true);

        const sourceBox = new THREE.Box3().setFromObject(root);
        const sourceSize = sourceBox.getSize(new THREE.Vector3());
        const scale = sourceSize.y > 0 ? treeTargetHeight / sourceSize.y : 1;
        root.scale.multiplyScalar(scale);
        root.updateMatrixWorld(true);

        const fittedBox = new THREE.Box3().setFromObject(root);
        const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
        root.position.set(-fittedCenter.x, 0.02 - fittedBox.min.y, -fittedCenter.z - 0.35);
        root.updateMatrixWorld(true);
        root.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach(prepareModelMaterial);
        });
        resolve({ tree: root, frame: inferTreeFrame(root) });
      },
      undefined,
      reject
    );
  });
}

function inferTreeFrame(root: THREE.Group): TreeFrame {
  const visiblePoints = collectVisibleModelPoints(root);
  const fallbackBox = new THREE.Box3().setFromObject(root);
  const modelBox = visiblePoints.length > 0 ? new THREE.Box3().setFromPoints(visiblePoints) : fallbackBox;
  const size = modelBox.getSize(new THREE.Vector3());
  const height = Math.max(1, size.y);
  const trunkSamples = visiblePoints.filter((point) => point.y <= modelBox.min.y + height * 0.2);
  const centerSource = trunkSamples.length > 0 ? trunkSamples : visiblePoints;
  const fallbackCenter = modelBox.getCenter(new THREE.Vector3());
  const trunkCenter = centerSource.length > 0 ? averageXZ(centerSource, modelBox.min.y) : new THREE.Vector3(fallbackCenter.x, modelBox.min.y, fallbackCenter.z);

  return {
    baseY: modelBox.min.y,
    topY: modelBox.max.y,
    height,
    trunkCenter,
    crownCenter: new THREE.Vector3(trunkCenter.x, modelBox.min.y + height * 0.6, trunkCenter.z),
    visiblePoints
  };
}

function collectVisibleModelPoints(root: THREE.Group) {
  const points: THREE.Vector3[] = [];
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;

    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    if (!position) return;

    const index = geometry.getIndex();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const groups =
      geometry.groups.length > 0
        ? geometry.groups
        : [{ start: 0, count: index ? index.count : position.count, materialIndex: 0 }];
    const visited = new Set<number>();

    groups.forEach((group) => {
      const material = materials[group.materialIndex ?? 0];
      if (!material || material.visible === false || isModelFoliageMaterial(material)) return;

      const end = group.start + group.count;
      for (let i = group.start; i < end; i += 1) {
        const vertexIndex = index ? index.getX(i) : i;
        if (visited.has(vertexIndex)) continue;
        visited.add(vertexIndex);
        points.push(new THREE.Vector3().fromBufferAttribute(position, vertexIndex).applyMatrix4(mesh.matrixWorld));
      }
    });
  });
  return points;
}

function averageXZ(points: THREE.Vector3[], y: number) {
  const center = points.reduce(
    (sum, point) => {
      sum.x += point.x;
      sum.z += point.z;
      return sum;
    },
    new THREE.Vector3(0, y, 0)
  );
  center.x /= points.length;
  center.z /= points.length;
  return center;
}

function prepareModelMaterial(material: THREE.Material) {
  const modelMaterial = material as THREE.Material & {
    map?: THREE.Texture | null;
    opacity?: number;
    roughness?: number;
    metalness?: number;
    alphaTest?: number;
    transparent?: boolean;
    side?: THREE.Side;
  };

  if (isModelFoliageMaterial(modelMaterial)) {
    modelMaterial.visible = false;
    modelMaterial.transparent = true;
    modelMaterial.opacity = 0;
    modelMaterial.depthWrite = false;
    modelMaterial.needsUpdate = true;
    return;
  }

  if (modelMaterial.map) {
    modelMaterial.map.colorSpace = THREE.SRGBColorSpace;
    modelMaterial.map.needsUpdate = true;
  }
  modelMaterial.roughness = Math.max(modelMaterial.roughness ?? 0.72, 0.78);
  modelMaterial.metalness = 0;
  modelMaterial.alphaTest = Math.max(modelMaterial.alphaTest ?? 0, 0.04);
  modelMaterial.side = THREE.DoubleSide;
  modelMaterial.needsUpdate = true;
}

function isModelFoliageMaterial(material: THREE.Material & { alphaTest?: number; transparent?: boolean }) {
  const name = material.name.toLowerCase();
  return name.includes('leaf') || name.includes('foliage') || name.endsWith('_b') || material.transparent === true;
}

function addOpinionBranch(scene: THREE.Scene, leaf: SceneLeaf) {
  addCanopyAnchorDebug(scene, leaf);

  const curve = new THREE.CatmullRomCurve3([leaf.branchStart, leaf.branchControlA, leaf.branchControlB, leaf.branchEnd]);
  const twig = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 18, Math.max(0.024, leaf.scale * 0.038), 7, false),
    new THREE.MeshPhongMaterial({ color: 0x5d3a24, flatShading: true, shininess: 10 })
  );
  twig.castShadow = true;
  twig.receiveShadow = true;
  scene.add(twig);

  const bud = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(0.045, leaf.scale * 0.07), 8, 6),
    new THREE.MeshPhongMaterial({ color: 0x6a452a, flatShading: true, shininess: 12 })
  );
  bud.position.copy(leaf.branchEnd);
  bud.castShadow = true;
  bud.receiveShadow = true;
  scene.add(bud);
}

function addCanopyAnchorDebug(scene: THREE.Scene, leaf: SceneLeaf) {
  if (!canopyAnchorDebugEnabled()) return;

  const start = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 8, 8),
    new THREE.MeshPhongMaterial({ color: 0xff3333 })
  );
  start.name = 'canopy-debug-branch-start';
  start.position.copy(leaf.branchStart);
  scene.add(start);

  const end = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 8, 8),
    new THREE.MeshPhongMaterial({ color: 0x33ff55 })
  );
  end.name = 'canopy-debug-branch-end';
  end.position.copy(leaf.branchEnd);
  scene.add(end);
}

function canopyAnchorDebugEnabled() {
  if (typeof window === 'undefined') return false;
  return Boolean((window as unknown as { debugCanopyAnchors?: boolean }).debugCanopyAnchors);
}

function addLeaf(scene: THREE.Scene, leaf: SceneLeaf) {
  const group = new THREE.Group();
  const texture = createMapleLeafTexture(leaf.node.stance, leaf.node.id, Boolean(leaf.node.folded));
  const geometry = createCurvedLeafGeometry(leaf.scale);
  const material = new THREE.MeshPhongMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.08,
    opacity: leaf.node.folded ? 0.62 : 0.98,
    shininess: 36,
    specular: 0xfff2d0,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.renderOrder = 10;
  mesh.rotation.z = leaf.twist;
  group.add(mesh);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025 * leaf.scale, 0.035 * leaf.scale, 0.64 * leaf.scale, 5),
    new THREE.MeshPhongMaterial({ color: 0x5b3822, depthWrite: false, flatShading: true })
  );
  stem.position.y = -0.51 * leaf.scale;
  stem.rotation.z = 0.08;
  stem.renderOrder = 9;
  group.add(stem);

  group.position.copy(leaf.position);
  group.name = 'canopy-leaf';
  group.scale.setScalar(0.001);
  group.userData = {
    node: leaf.node,
    basePosition: leaf.position.clone(),
    normal: leaf.normal.clone(),
    windAxis: leaf.windAxis.clone(),
    baseRotation: leaf.angle * 0.18 + leaf.twist,
    growStart: performance.now() + leaf.growDelay,
    swingOffset: leaf.node.id * 0.71,
    swingSpeed: 0.0012 + (leaf.node.id % 7) * 0.00016
  };
  group.traverse((object) => {
    object.userData.leafGroup = group;
  });
  scene.add(group);
  return group;
}

function createCurvedLeafGeometry(scale: number) {
  const geometry = new THREE.PlaneGeometry(1.65 * scale, 1.65 * scale, 8, 8);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const curl = Math.pow(Math.abs(x) / Math.max(0.001, scale), 1.35) * 0.075 * scale;
    const bow = Math.sin((y / Math.max(0.001, scale)) * Math.PI) * 0.025 * scale;
    positions.setZ(i, curl + bow);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createMapleLeafTexture(stance: Stance, seed: number, folded: boolean) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);

  const hueBase: Record<Stance, number> = {
    AGREE: 112,
    NEUTRAL: 206,
    DISAGREE: 15
  };
  const hue = hueBase[stance] + (seeded(seed + 3) - 0.5) * 18;
  const saturation = folded ? 10 : stance === 'NEUTRAL' ? 12 + seeded(seed + 9) * 7 : 62 + seeded(seed + 9) * 10;
  const lightA = folded ? 58 : stance === 'NEUTRAL' ? 62 + seeded(seed + 17) * 8 : 54 + seeded(seed + 17) * 10;
  const lightB = folded ? 43 : stance === 'NEUTRAL' ? 43 + seeded(seed + 29) * 7 : 35 + seeded(seed + 29) * 9;
  const tip = `hsl(${hue + 10}, ${Math.max(10, saturation - 4)}%, ${Math.min(78, lightA + 18)}%)`;
  const mid = `hsl(${hue}, ${saturation}%, ${lightA}%)`;
  const core = `hsl(${hue - 8}, ${Math.max(12, saturation + 8)}%, ${lightB}%)`;

  const points = [
    [0.5, 0.02],
    [0.58, 0.26],
    [0.82, 0.09],
    [0.75, 0.36],
    [0.98, 0.42],
    [0.73, 0.54],
    [0.86, 0.82],
    [0.6, 0.71],
    [0.52, 0.98],
    [0.43, 0.71],
    [0.14, 0.84],
    [0.27, 0.55],
    [0.02, 0.44],
    [0.25, 0.36],
    [0.18, 0.1],
    [0.42, 0.26]
  ];

  context.save();
  context.beginPath();
  points.forEach(([x, y], index) => {
    const px = x * size;
    const py = y * size;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  });
  context.closePath();
  context.clip();

  const gradient = context.createLinearGradient(size * 0.28, size * 0.08, size * 0.72, size * 0.92);
  gradient.addColorStop(0, tip);
  gradient.addColorStop(0.48, mid);
  gradient.addColorStop(1, core);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const sheen = context.createRadialGradient(size * 0.42, size * 0.28, 4, size * 0.42, size * 0.28, size * 0.48);
  sheen.addColorStop(0, 'rgba(255,255,255,0.34)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0.08)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = sheen;
  context.fillRect(0, 0, size, size);

  context.strokeStyle = folded ? 'rgba(89,86,76,0.42)' : 'rgba(76,48,24,0.34)';
  context.lineWidth = 2.2;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(size * 0.5, size * 0.95);
  context.lineTo(size * 0.5, size * 0.12);
  context.moveTo(size * 0.5, size * 0.54);
  context.lineTo(size * 0.25, size * 0.36);
  context.moveTo(size * 0.5, size * 0.55);
  context.lineTo(size * 0.74, size * 0.36);
  context.moveTo(size * 0.5, size * 0.68);
  context.lineTo(size * 0.2, size * 0.78);
  context.moveTo(size * 0.5, size * 0.68);
  context.lineTo(size * 0.82, size * 0.78);
  context.stroke();
  context.restore();

  context.beginPath();
  points.forEach(([x, y], index) => {
    const px = x * size;
    const py = y * size;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  });
  context.closePath();
  context.strokeStyle = folded ? 'rgba(70,70,64,0.34)' : 'rgba(87,46,20,0.32)';
  context.lineWidth = 3;
  context.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function findLeafGroup(object?: THREE.Object3D) {
  let current: THREE.Object3D | null | undefined = object;
  while (current) {
    if (current.name === 'canopy-leaf') return current as THREE.Group;
    current = current.parent;
  }
  return null;
}

function disposeObject(object: THREE.Object3D) {
  const maybeMesh = object as THREE.Object3D & {
    geometry?: THREE.BufferGeometry;
    material?: THREE.Material | THREE.Material[];
  };
  maybeMesh.geometry?.dispose();
  const materials = Array.isArray(maybeMesh.material) ? maybeMesh.material : maybeMesh.material ? [maybeMesh.material] : [];
  materials.forEach((material) => {
    const texturedMaterial = material as THREE.Material & { map?: THREE.Texture | null };
    texturedMaterial.map?.dispose();
    material.dispose();
  });
}
