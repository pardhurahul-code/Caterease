import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { onAuthStateChanged } from 'firebase/auth';
import {
  ArrowLeft,
  Bookmark,
  Camera,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { auth, listStudioPresets, removeStudioPreset, saveStudioPreset, type StudioPresetRecord } from '../lib/firebase';
import {
  createContactShadowTexture,
  createDamaskClothTexture,
  createMarbleFloorTexture,
  createWalnutWoodTexture,
  detectSoftwareWebGL,
  disposeSceneResources,
} from '../three/proceduralTextures';
import {
  applyExplodeOffset,
  createBanquetTableGroup,
  createChafingStationGroup,
  createServiceCartGroup,
  getMetalParams,
  type MetalFinishType,
} from '../three/banquetModels';

type LayoutPreset = 'banquet' | 'buffet' | 'showroom';
type LightingPreset = 'gala' | 'daylight' | 'sunset';
type CameraPreset = 'overview' | 'tabletop' | 'buffet' | 'aerial';

interface CameraTargetSpec {
  pos: [number, number, number];
  target: [number, number, number];
}

const CAMERA_PRESETS: Record<CameraPreset, CameraTargetSpec> = {
  overview: { pos: [7.2, 4.8, 8.6], target: [0, 0.9, 0] },
  tabletop: { pos: [2.6, 2.0, 3.1], target: [0, 1.05, 0] },
  buffet: { pos: [-5.8, 3.3, 4.6], target: [-2.8, 1.0, -2.5] },
  aerial: { pos: [0.2, 10.2, 4.2], target: [0, 0.3, -0.4] },
};

const LIGHTING_SPECS: Record<
  LightingPreset,
  {
    bg: number;
    fogDensity: number;
    keyColor: number;
    keyIntensity: number;
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    exposure: number;
  }
> = {
  gala: {
    bg: 0x16120e,
    fogDensity: 0.042,
    keyColor: 0xffe4bd,
    keyIntensity: 2.35,
    hemiSky: 0x7c93b8,
    hemiGround: 0x3b2a1a,
    hemiIntensity: 0.72,
    exposure: 1.08,
  },
  daylight: {
    bg: 0xd9d4ca,
    fogDensity: 0.032,
    keyColor: 0xfff8ed,
    keyIntensity: 2.55,
    hemiSky: 0xbfd8f5,
    hemiGround: 0x786957,
    hemiIntensity: 1.05,
    exposure: 1.05,
  },
  sunset: {
    bg: 0x2a1814,
    fogDensity: 0.042,
    keyColor: 0xffa76c,
    keyIntensity: 2.45,
    hemiSky: 0x9b7aa6,
    hemiGround: 0x452216,
    hemiIntensity: 0.85,
    exposure: 1.1,
  },
};

export function BanquetStudio3DPage() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>('banquet');
  const [metalFinish, setMetalFinish] = useState<MetalFinishType>('gold');
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('gala');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [explodeAmount, setExplodeAmount] = useState<number>(0);
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);

  const [presetPanelOpen, setPresetPanelOpen] = useState(false);
  const [presetName, setPresetName] = useState('Royal Gala Layout');
  const [savedPresets, setSavedPresets] = useState<StudioPresetRecord[]>([]);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [firebaseVerified, setFirebaseVerified] = useState<boolean>(false);
  const [savingPreset, setSavingPreset] = useState(false);

  const sceneRefs = useRef<{
    applyLayout: (l: LayoutPreset) => void;
    applyMetal: (m: MetalFinishType) => void;
    applyLighting: (p: LightingPreset) => void;
    applyCamera: (c: CameraPreset) => void;
    setExplodeTarget: (v: number) => void;
  } | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser && fbUser.emailVerified) {
        setFirebaseUid(fbUser.uid);
        setFirebaseVerified(true);
        listStudioPresets(fbUser.uid)
          .then(setSavedPresets)
          .catch(() => {
            // Handled silently if user has no presets yet
          });
      } else {
        setFirebaseUid(null);
        setFirebaseVerified(false);
        setSavedPresets([]);
      }
    });
    return () => unsub();
  }, []);

  // Keyboard shortcut H to toggle Cinema / Zen mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setHudCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    const isSoftwareGl = detectSoftwareWebGL();
    const activeRenderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: isSoftwareGl,
    });
    const maxAnisotropy = Math.min(
      isSoftwareGl ? 2 : 8,
      activeRenderer.capabilities.getMaxAnisotropy()
    );

    activeRenderer.outputColorSpace = THREE.SRGBColorSpace;
    activeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    activeRenderer.toneMappingExposure = LIGHTING_SPECS.gala.exposure;
    activeRenderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    activeRenderer.setSize(width, height);
    activeRenderer.shadowMap.enabled = !isSoftwareGl;
    activeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    activeRenderer.domElement.style.display = 'block';
    activeRenderer.domElement.style.width = '100%';
    activeRenderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(activeRenderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(LIGHTING_SPECS.gala.bg);
    scene.fog = new THREE.FogExp2(LIGHTING_SPECS.gala.bg, LIGHTING_SPECS.gala.fogDensity);

    const pmremGenerator = new THREE.PMREMGenerator(activeRenderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 90);
    camera.position.set(...CAMERA_PRESETS.overview.pos);

    const controls = new OrbitControls(camera, activeRenderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.autoRotate = false;
    controls.minDistance = 2.4;
    controls.maxDistance = 18;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.set(...CAMERA_PRESETS.overview.target);
    controls.update();

    // 3-point balanced studio lighting rig (max 1 shadow-casting directional light)
    const keyLight = new THREE.DirectionalLight(LIGHTING_SPECS.gala.keyColor, LIGHTING_SPECS.gala.keyIntensity);
    keyLight.position.set(7.5, 11, 6.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 28;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(
      LIGHTING_SPECS.gala.hemiSky,
      LIGHTING_SPECS.gala.hemiGround,
      LIGHTING_SPECS.gala.hemiIntensity
    );
    scene.add(hemiLight);

    const rimLight = new THREE.PointLight(0xffcb80, 1.4, 24);
    rimLight.position.set(-6, 5.2, -7);
    scene.add(rimLight);

    // Procedural Materials & Textures
    const marbleTex = createMarbleFloorTexture(maxAnisotropy);
    marbleTex.repeat.set(14, 14);
    const clothTex = createDamaskClothTexture(maxAnisotropy);
    const woodTex = createWalnutWoodTexture(maxAnisotropy);
    const shadowTex = createContactShadowTexture();

    const metalParams = getMetalParams('gold');
    const sharedMetalMat = new THREE.MeshStandardMaterial({
      color: metalParams.color,
      roughness: metalParams.roughness,
      metalness: metalParams.metalness,
    });

    // Banquet Hall Architectural Floor + Colonnade Framing
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(48, 64),
      new THREE.MeshStandardMaterial({
        map: marbleTex,
        roughness: 0.34,
        metalness: 0.06,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const hallGroup = new THREE.Group();
    const colMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd2, roughness: 0.55, metalness: 0.05 });
    const colGeo = new THREE.CylinderGeometry(0.28, 0.33, 6.2, 20);
    const colBaseGeo = new THREE.BoxGeometry(0.95, 0.3, 0.95);
    const columns = new THREE.InstancedMesh(colGeo, colMat, 10);
    const colBases = new THREE.InstancedMesh(colBaseGeo, sharedMetalMat, 10);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rx = Math.cos(a) * 11.2;
      const rz = Math.sin(a) * 11.2;
      dummy.position.set(rx, 3.1, rz);
      dummy.rotation.set(0, -a, 0);
      dummy.updateMatrix();
      columns.setMatrixAt(i, dummy.matrix);

      dummy.position.set(rx, 0.15, rz);
      dummy.updateMatrix();
      colBases.setMatrixAt(i, dummy.matrix);
    }
    columns.computeBoundingSphere();
    colBases.computeBoundingSphere();
    hallGroup.add(columns, colBases);

    // Overhead Chandelier Halo
    const chandelier = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.07, 14, 56), sharedMetalMat);
    chandelier.rotation.x = Math.PI / 2;
    chandelier.position.y = 5.6;
    hallGroup.add(chandelier);

    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffebba,
      emissive: 0xffb347,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
    const bulbGeo = new THREE.SphereGeometry(0.08, 12, 10);
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, 12);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 3.2, 5.5, Math.sin(a) * 3.2);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      bulbs.setMatrixAt(i, dummy.matrix);
    }
    bulbs.computeBoundingSphere();
    hallGroup.add(bulbs);
    scene.add(hallGroup);

    // Subject Groups (Banquet, Buffet, Showroom)
    const subjectRoot = new THREE.Group();
    scene.add(subjectRoot);

    const banquetGroup = new THREE.Group();
    const heroTable = createBanquetTableGroup({
      clothMap: clothTex,
      woodMap: woodTex,
      shadowMap: shadowTex,
      metalMat: sharedMetalMat,
    });
    banquetGroup.add(heroTable);

    const stationLeft = createChafingStationGroup({ woodMap: woodTex, shadowMap: shadowTex, metalMat: sharedMetalMat });
    stationLeft.position.set(-4.2, 0, -3.4);
    stationLeft.rotation.y = 0.45;
    banquetGroup.add(stationLeft);

    const stationRight = createChafingStationGroup({ woodMap: woodTex, shadowMap: shadowTex, metalMat: sharedMetalMat });
    stationRight.position.set(4.2, 0, -3.4);
    stationRight.rotation.y = -0.45;
    banquetGroup.add(stationRight);

    const banquetCart = createServiceCartGroup(sharedMetalMat, woodTex);
    banquetCart.position.set(3.4, 0, 2.3);
    banquetCart.rotation.y = -0.8;
    banquetGroup.add(banquetCart);

    const buffetGroup = new THREE.Group();
    [-3.4, 0, 3.4].forEach((bx, idx) => {
      const st = createChafingStationGroup({ woodMap: woodTex, shadowMap: shadowTex, metalMat: sharedMetalMat });
      st.position.set(bx, 0, idx === 1 ? -1.4 : -0.6);
      st.rotation.y = idx === 0 ? 0.32 : idx === 2 ? -0.32 : 0;
      buffetGroup.add(st);
    });
    const buffetCart = createServiceCartGroup(sharedMetalMat, woodTex);
    buffetCart.position.set(0, 0, 2.4);
    buffetCart.rotation.y = 0.4;
    buffetGroup.add(buffetCart);
    buffetGroup.visible = false;

    const showroomGroup = new THREE.Group();
    const dais = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.75, 0.08, 48),
      new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.35, metalness: 0.12 })
    );
    dais.position.y = 0.04;
    dais.receiveShadow = true;
    showroomGroup.add(dais);
    const showroomTable = createBanquetTableGroup({
      clothMap: clothTex,
      woodMap: woodTex,
      shadowMap: shadowTex,
      metalMat: sharedMetalMat,
    });
    showroomTable.position.y = 0.08;
    showroomGroup.add(showroomTable);
    showroomGroup.visible = false;

    subjectRoot.add(banquetGroup, buffetGroup, showroomGroup);

    if (!isSoftwareGl) {
      activeRenderer.compile(scene, camera);
    }

    // Damped Transition State
    let currentExplode = 0;
    let targetExplode = 0;
    let camTransition: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
    let lastTickMs = performance.now();
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      if (disposed) return;
      const gl = activeRenderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        const now = performance.now();
        const dt = Math.min(Math.max((now - lastTickMs) / 1000, 0.001), 0.05);
        lastTickMs = now;

        let keepAnimating = false;

        if (Math.abs(targetExplode - currentExplode) > 0.002) {
          currentExplode = THREE.MathUtils.damp(currentExplode, targetExplode, 7.5, dt);
          applyExplodeOffset(subjectRoot, currentExplode);
          keepAnimating = true;
        } else if (currentExplode !== targetExplode) {
          currentExplode = targetExplode;
          applyExplodeOffset(subjectRoot, currentExplode);
        }

        if (camTransition) {
          const factor = 1 - Math.exp(-6.5 * dt);
          camera.position.lerp(camTransition.pos, factor);
          controls.target.lerp(camTransition.target, factor);
          if (
            camera.position.distanceTo(camTransition.pos) < 0.03 &&
            controls.target.distanceTo(camTransition.target) < 0.03
          ) {
            camera.position.copy(camTransition.pos);
            controls.target.copy(camTransition.target);
            camTransition = null;
          } else {
            keepAnimating = true;
          }
        }

        controls.update();
        activeRenderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (!disposed && (renderDirty || keepAnimating)) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };

    const onControlsChange = () => requestRender();
    const onControlsStart = () => {
      camTransition = null;
    };
    controls.addEventListener('change', onControlsChange);
    controls.addEventListener('start', onControlsStart);

    const onResize = () => {
      if (!container || disposed) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      activeRenderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', onResize);

    sceneRefs.current = {
      applyLayout: (l) => {
        banquetGroup.visible = l === 'banquet';
        buffetGroup.visible = l === 'buffet';
        showroomGroup.visible = l === 'showroom';
        requestRender();
      },
      applyMetal: (m) => {
        const next = getMetalParams(m);
        sharedMetalMat.color.setHex(next.color);
        sharedMetalMat.roughness = next.roughness;
        sharedMetalMat.metalness = next.metalness;
        requestRender();
      },
      applyLighting: (p) => {
        const spec = LIGHTING_SPECS[p];
        (scene.background as THREE.Color).setHex(spec.bg);
        if (scene.fog instanceof THREE.FogExp2) {
          scene.fog.color.setHex(spec.bg);
          scene.fog.density = spec.fogDensity;
        }
        keyLight.color.setHex(spec.keyColor);
        keyLight.intensity = spec.keyIntensity;
        hemiLight.color.setHex(spec.hemiSky);
        hemiLight.groundColor.setHex(spec.hemiGround);
        hemiLight.intensity = spec.hemiIntensity;
        activeRenderer.toneMappingExposure = spec.exposure;
        requestRender();
      },
      applyCamera: (c) => {
        const spec = CAMERA_PRESETS[c];
        camTransition = {
          pos: new THREE.Vector3(...spec.pos),
          target: new THREE.Vector3(...spec.target),
        };
        requestRender();
      },
      setExplodeTarget: (v) => {
        targetExplode = Math.max(0, Math.min(1, v));
        requestRender();
      },
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => onResize()) : null;
    resizeObserver?.observe(container);

    // Initial paint immediately + schedule coalesced confirmation frame
    activeRenderer.render(scene, camera);
    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('change', onControlsChange);
      controls.removeEventListener('start', onControlsStart);
      controls.dispose();
      envTarget.dispose();
      disposeSceneResources(scene);
      activeRenderer.dispose();
      sceneRefs.current = null;
    };
  }, []);

  const handleLayoutChange = (next: LayoutPreset) => {
    setLayoutPreset(next);
    sceneRefs.current?.applyLayout(next);
  };

  const handleMetalChange = (next: MetalFinishType) => {
    setMetalFinish(next);
    sceneRefs.current?.applyMetal(next);
  };

  const handleLightingChange = (next: LightingPreset) => {
    setLightingPreset(next);
    sceneRefs.current?.applyLighting(next);
  };

  const handleCameraChange = (next: CameraPreset) => {
    setCameraPreset(next);
    sceneRefs.current?.applyCamera(next);
  };

  const handleExplodeChange = (val: number) => {
    setExplodeAmount(val);
    sceneRefs.current?.setExplodeTarget(val);
  };

  const handleSavePreset = async () => {
    if (!firebaseUid || !firebaseVerified) {
      toast.error('Please sign in with Google first to save 3D presets to your account.');
      return;
    }
    setSavingPreset(true);
    try {
      const saved = await saveStudioPreset(firebaseUid, {
        name: presetName.trim() || 'Banquet Setup',
        layoutPreset,
        metalFinish,
        lightingPreset,
        explodeAmount,
      });
      setSavedPresets((prev) => [saved, ...prev.filter((p) => p.presetId !== saved.presetId)]);
      toast.success(`Saved "${saved.name}" to Cloud Firestore.`);
    } catch (err: any) {
      toast.error(err?.message || 'Could not save preset.');
    } finally {
      setSavingPreset(false);
    }
  };

  const handleLoadPreset = (p: StudioPresetRecord) => {
    handleLayoutChange(p.layoutPreset);
    handleMetalChange(p.metalFinish);
    handleLightingChange(p.lightingPreset);
    handleExplodeChange(p.explodeAmount);
    toast.success(`Loaded "${p.name}".`);
  };

  const handleDeletePreset = async (presetId: string) => {
    if (!firebaseUid) return;
    try {
      await removeStudioPreset(firebaseUid, presetId);
      setSavedPresets((prev) => prev.filter((p) => p.presetId !== presetId));
      toast.success('Preset deleted.');
    } catch {
      toast.error('Failed to delete preset.');
    }
  };

  return (
    <div className="fixed inset-0 bg-[#16120e] overflow-hidden select-none">
      {/* Isolated WebGL mount container */}
      <div ref={mountRef} className="w-full h-full" aria-label="Interactive 3D Banquet Layout Studio" />

      {/* Top-Left Minimal Title / Navigation Badge (Zero backdrop-filter, zero animated dots) */}
      <div className="fixed top-4 left-4 z-20 flex items-center gap-2.5">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-950/90 border border-stone-700/80 text-stone-100 hover:bg-stone-900 text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
          CaterEase
        </Link>
        <div className="px-3.5 py-2 rounded-xl bg-stone-950/90 border border-stone-700/80 text-stone-100">
          <div className="text-xs font-bold tracking-tight flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Banquet 3D Studio
          </div>
          <div className="text-[11px] text-stone-400 hidden sm:block">
            Drag to orbit · Scroll to zoom · H toggles HUD
          </div>
        </div>
      </div>

      {/* Presets Drawer (Top-Left expandable below badge only when opened) */}
      {presetPanelOpen && (
        <div className="fixed top-20 left-4 z-20 w-72 rounded-2xl bg-stone-950/95 border border-stone-700 p-4 text-stone-100 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300">Saved Cloud Presets</span>
            <button
              type="button"
              onClick={() => setPresetPanelOpen(false)}
              className="text-xs text-stone-400 hover:text-white"
            >
              Close
            </button>
          </div>
          {firebaseVerified ? (
            <>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  maxLength={60}
                  placeholder="Preset name..."
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleSavePreset}
                  disabled={savingPreset}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {savingPreset ? '...' : 'Save'}
                </button>
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1.5">
                {savedPresets.length === 0 ? (
                  <p className="text-[11px] text-stone-400">No saved presets yet.</p>
                ) : (
                  savedPresets.map((p) => (
                    <div
                      key={p.presetId}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => handleLoadPreset(p)}
                        className="text-left flex-1 truncate hover:text-amber-300"
                      >
                        {p.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePreset(p.presetId)}
                        aria-label={`Delete ${p.name}`}
                        className="text-stone-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2 text-[11px] text-stone-300">
              <p>Sign in with your verified Google account to sync custom 3D banquet presets in Firestore.</p>
              <Link
                to="/login"
                className="inline-block px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                Sign In with Google
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Collapsible Unified Bottom Control Dock */}
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(940px,95vw)] transition-transform duration-300 ${
          hudCollapsed ? 'translate-y-[calc(100%-34px)]' : 'translate-y-0'
        }`}
      >
        <div className="flex justify-center mb-1">
          <button
            type="button"
            onClick={() => setHudCollapsed((c) => !c)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-stone-950/95 border border-b-0 border-stone-700 text-[11px] font-semibold text-stone-200 hover:text-amber-300"
          >
            {hudCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Show Controls (H)
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> Hide Controls (H)
              </>
            )}
          </button>
        </div>

        <div className="rounded-2xl bg-stone-950/95 border border-stone-700/90 px-4 py-3 text-stone-100 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Layout Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-stone-400 mr-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-amber-400" /> Layout
              </span>
              {(['banquet', 'buffet', 'showroom'] as LayoutPreset[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => handleLayoutChange(l)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                    layoutPreset === l
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-900 text-stone-300 hover:bg-stone-800'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Metal Finish Swatches */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-stone-400 mr-1">Finish</span>
              {(
                [
                  { id: 'gold', label: 'Brass', dot: 'bg-amber-400' },
                  { id: 'copper', label: 'Copper', dot: 'bg-orange-500' },
                  { id: 'silver', label: 'Silver', dot: 'bg-slate-300' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleMetalChange(f.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    metalFinish === f.id
                      ? 'bg-stone-800 text-white ring-1 ring-amber-500'
                      : 'bg-stone-900 text-stone-300 hover:bg-stone-800'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${f.dot}`} />
                  {f.label}
                </button>
              ))}
            </div>

            {/* Lighting Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-stone-400 mr-1 flex items-center gap-1">
                <Sun className="w-3.5 h-3.5 text-amber-400" /> Mood
              </span>
              {(['gala', 'daylight', 'sunset'] as LightingPreset[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleLightingChange(m)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                    lightingPreset === m
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-900 text-stone-300 hover:bg-stone-800'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Exploded View Slider */}
            <div className="flex items-center gap-2 min-w-[165px]">
              <label htmlFor="studio-explode" className="text-[11px] text-stone-400 whitespace-nowrap">
                Explode {Math.round(explodeAmount * 100)}%
              </label>
              <input
                id="studio-explode"
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={explodeAmount}
                onChange={(e) => handleExplodeChange(Number(e.target.value))}
                className="w-24 accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Camera Views + Presets Toggle */}
            <div className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-amber-400 mr-0.5" />
              {(['overview', 'tabletop', 'buffet', 'aerial'] as CameraPreset[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleCameraChange(c)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium capitalize transition-colors ${
                    cameraPreset === c
                      ? 'bg-stone-700 text-white'
                      : 'bg-stone-900 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {c}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPresetPanelOpen((o) => !o)}
                className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-semibold"
              >
                <Bookmark className="w-3 h-3" /> Presets
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
