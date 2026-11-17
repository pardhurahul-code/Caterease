import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { onAuthStateChanged } from 'firebase/auth';
import {
  ArrowLeft,
  Award,
  Flame,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  auth,
  fetchLeaderboardScores,
  submitGameScoreToFirestore,
  type GameScoreRecord,
} from '../lib/firebase';
import {
  ARENA_HALF_D,
  ARENA_HALF_W,
  PASS_STATIONS,
  createInitialGameState,
  stepGameSimulation,
  type DishType,
  type GameSimulationState,
  type HeldInputs,
} from '../utils/banquetGameLogic';
import {
  createContactShadowTexture,
  createDamaskClothTexture,
  createMarbleFloorTexture,
  createSteamParticleTexture,
  createWalnutWoodTexture,
  detectSoftwareWebGL,
  disposeSceneResources,
} from '../three/proceduralTextures';
import {
  createBanquetTableGroup,
  createChafingStationGroup,
  createServiceCartGroup,
  createWaiterGroup,
  getMetalParams,
} from '../three/banquetModels';
import { gameAudio } from '../three/gameAudio';

const DISH_COLORS: Record<DishType, number> = {
  STARTERS: 0x0f766e,
  BIRYANI: 0xd97706,
  MITHAI: 0xbe123c,
};

const DISH_LABELS: Record<DishType, string> = {
  STARTERS: 'Starters Pass',
  BIRYANI: 'Saffron Biryani',
  MITHAI: 'Royal Mithai',
};

// Pre-allocated vectors outside the render loop (zero per-frame GC)
const _camGoal = new THREE.Vector3();
const _lookGoal = new THREE.Vector3();

interface HudSnapshot {
  status: GameSimulationState['status'];
  wave: number;
  score: number;
  combo: number;
  maxCombo: number;
  reputation: number;
  ordersDelivered: number;
  waveOrdersDone: number;
  waveTargetOrders: number;
  carriedDish: DishType | null;
  dashReadyRatio: number;
}

function toHudSnapshot(s: GameSimulationState): HudSnapshot {
  return {
    status: s.status,
    wave: s.wave,
    score: s.score,
    combo: s.combo,
    maxCombo: s.maxCombo,
    reputation: s.reputation,
    ordersDelivered: s.ordersDelivered,
    waveOrdersDone: s.waveOrdersDone,
    waveTargetOrders: s.waveTargetOrders,
    carriedDish: s.carriedDish,
    dashReadyRatio: s.dashCooldownLeft <= 0 ? 1 : Math.max(0, 1 - s.dashCooldownLeft / 1.5),
  };
}

export function CaterRushGamePage() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<GameSimulationState>(createInitialGameState('title'));
  const heldRef = useRef<HeldInputs>({ up: false, down: false, left: false, right: false });
  const dashQueuedRef = useRef<boolean>(false);

  const [hud, setHud] = useState<HudSnapshot>(() => toHudSnapshot(simRef.current));
  const [muted, setMuted] = useState<boolean>(false);
  const [leaderboard, setLeaderboard] = useState<GameScoreRecord[]>([]);
  const [scoreSubmitted, setScoreSubmitted] = useState<boolean>(false);
  const [submittingScore, setSubmittingScore] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<{ uid: string; name: string; verified: boolean } | null>(null);

  useEffect(() => {
    fetchLeaderboardScores()
      .then(setLeaderboard)
      .catch(() => {
        // Non-blocking if offline
      });
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setFirebaseUser({
          uid: fbUser.uid,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Head Chef',
          verified: fbUser.emailVerified,
        });
      } else {
        setFirebaseUser(null);
      }
    });
    return () => unsub();
  }, []);

  const syncHud = () => {
    setHud(toHudSnapshot(simRef.current));
  };

  const startNewRun = () => {
    gameAudio.unlock();
    simRef.current = createInitialGameState('playing');
    heldRef.current = { up: false, down: false, left: false, right: false };
    dashQueuedRef.current = false;
    setScoreSubmitted(false);
    syncHud();
  };

  const togglePause = () => {
    const s = simRef.current;
    if (s.status === 'playing') {
      simRef.current = { ...s, status: 'paused' };
      heldRef.current = { up: false, down: false, left: false, right: false };
      syncHud();
    } else if (s.status === 'paused') {
      simRef.current = { ...s, status: 'playing' };
      syncHud();
    }
  };

  const toggleMute = () => {
    const next = !muted;
    gameAudio.setMuted(next);
    setMuted(next);
    if (!next) gameAudio.unlock();
  };

  // Input listeners with strict blur & visibility reset
  useEffect(() => {
    const clearHeld = () => {
      heldRef.current.up = false;
      heldRef.current.down = false;
      heldRef.current.left = false;
      heldRef.current.right = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'ArrowUp' || code === 'KeyW') heldRef.current.up = true;
      else if (code === 'ArrowDown' || code === 'KeyS') heldRef.current.down = true;
      else if (code === 'ArrowLeft' || code === 'KeyA') heldRef.current.left = true;
      else if (code === 'ArrowRight' || code === 'KeyD') heldRef.current.right = true;
      else if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
        if (simRef.current.status === 'title') {
          e.preventDefault();
          startNewRun();
        } else if (simRef.current.status === 'playing' && !e.repeat) {
          e.preventDefault();
          dashQueuedRef.current = true;
        }
      } else if (code === 'Enter') {
        if (simRef.current.status === 'title' || simRef.current.status === 'victory' || simRef.current.status === 'gameover') {
          startNewRun();
        }
      } else if (code === 'KeyP' || code === 'Escape') {
        if (simRef.current.status === 'playing' || simRef.current.status === 'paused') {
          togglePause();
        }
      } else if (code === 'KeyR') {
        if (simRef.current.status === 'victory' || simRef.current.status === 'gameover' || simRef.current.status === 'paused') {
          startNewRun();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'ArrowUp' || code === 'KeyW') heldRef.current.up = false;
      else if (code === 'ArrowDown' || code === 'KeyS') heldRef.current.down = false;
      else if (code === 'ArrowLeft' || code === 'KeyA') heldRef.current.left = false;
      else if (code === 'ArrowRight' || code === 'KeyD') heldRef.current.right = false;
    };

    const onVisibility = () => {
      if (document.hidden) clearHeld();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearHeld);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearHeld);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Three.js Scene & Simulation Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    const maxAnisotropy = Math.min(isSoftwareGl ? 2 : 8, renderer.capabilities.getMaxAnisotropy());

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x16110d);
    scene.fog = new THREE.FogExp2(0x16110d, 0.032);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 90);
    camera.position.set(0, 12.2, 13.4);
    camera.lookAt(0, 0.5, 0);

    // 3-point balanced rig
    const keyLight = new THREE.DirectionalLight(0xffe6c2, 2.3);
    keyLight.position.set(8, 14, 7);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -12;
    keyLight.shadow.camera.right = 12;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0x8aa3c7, 0x3b2718, 0.78);
    scene.add(hemiLight);

    const marbleTex = createMarbleFloorTexture(maxAnisotropy);
    marbleTex.repeat.set(16, 16);
    const clothTex = createDamaskClothTexture(maxAnisotropy);
    const woodTex = createWalnutWoodTexture(maxAnisotropy);
    const shadowTex = createContactShadowTexture();
    const steamTex = createSteamParticleTexture();

    const goldParams = getMetalParams('gold');
    const sharedGoldMat = new THREE.MeshStandardMaterial(goldParams);

    // Banquet Arena Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(88, 88),
      new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.36, metalness: 0.06 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Subtle Brass Perimeter Railings framing the playable zone
    const railMat = new THREE.MeshStandardMaterial({ color: 0xb9893d, roughness: 0.32, metalness: 0.85 });
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(ARENA_HALF_W * 2 + 1.4, 0.25, 0.18), railMat);
    railTop.position.set(0, 0.125, -ARENA_HALF_D - 0.8);
    const railBottom = railTop.clone();
    railBottom.position.z = ARENA_HALF_D + 0.8;
    const railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, ARENA_HALF_D * 2 + 1.7), railMat);
    railLeft.position.set(-ARENA_HALF_W - 0.7, 0.125, 0);
    const railRight = railLeft.clone();
    railRight.position.x = ARENA_HALF_W + 0.7;
    scene.add(railTop, railBottom, railLeft, railRight);

    // 3 Pass Stations at top corridor
    const steamSprites: { sprite: THREE.Sprite; baseX: number; baseZ: number; offset: number }[] = [];
    PASS_STATIONS.forEach((st, idx) => {
      const chafing = createChafingStationGroup({
        woodMap: woodTex,
        shadowMap: shadowTex,
        metalMat: sharedGoldMat,
      });
      chafing.position.set(st.position.x, 0, st.position.z);
      scene.add(chafing);

      // Dish beacon ring on floor
      const pad = new THREE.Mesh(
        new THREE.RingGeometry(1.1, 1.38, 28),
        new THREE.MeshBasicMaterial({ color: st.colorHex, side: THREE.DoubleSide })
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(st.position.x, 0.025, st.position.z + 1.0);
      scene.add(pad);

      // Floating beacon gem
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshStandardMaterial({
          color: st.colorHex,
          emissive: st.colorHex,
          emissiveIntensity: 0.9,
          roughness: 0.2,
        })
      );
      gem.position.set(st.position.x, 2.05, st.position.z);
      scene.add(gem);

      // Procedural steam sprites above each pass station
      for (let s = 0; s < 3; s++) {
        const spMat = new THREE.SpriteMaterial({
          map: steamTex,
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
        });
        const sp = new THREE.Sprite(spMat);
        sp.scale.set(0.65, 0.65, 1);
        scene.add(sp);
        steamSprites.push({
          sprite: sp,
          baseX: st.position.x + (s - 1) * 0.45,
          baseZ: st.position.z,
          offset: idx * 0.7 + s * 0.35,
        });
      }
    });

    // 6 Banquet Tables + 3D Order Beacons & Floor Patience Rings
    interface TableVisual {
      orderBeacon: THREE.Mesh;
      patienceRing: THREE.Mesh;
      beaconMat: THREE.MeshStandardMaterial;
      ringMat: THREE.MeshBasicMaterial;
    }
    const tableVisuals: TableVisual[] = [];
    simRef.current.tables.forEach((t) => {
      const tbl = createBanquetTableGroup({
        clothMap: clothTex,
        woodMap: woodTex,
        shadowMap: shadowTex,
        metalMat: sharedGoldMat,
      });
      tbl.scale.setScalar(0.68);
      tbl.position.set(t.position.x, 0, t.position.z);
      scene.add(tbl);

      const beaconMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      });
      const orderBeacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), beaconMat);
      orderBeacon.position.set(t.position.x, 1.9, t.position.z);
      orderBeacon.visible = false;
      scene.add(orderBeacon);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const patienceRing = new THREE.Mesh(new THREE.RingGeometry(1.42, 1.65, 32), ringMat);
      patienceRing.rotation.x = -Math.PI / 2;
      patienceRing.position.set(t.position.x, 0.025, t.position.z);
      patienceRing.visible = false;
      scene.add(patienceRing);

      tableVisuals.push({ orderBeacon, patienceRing, beaconMat, ringMat });
    });

    // Player Service Cart
    const playerCart = createServiceCartGroup(sharedGoldMat, woodTex);
    scene.add(playerCart);

    // 3 Waiter Obstacle Visuals (shown/hidden by active wave count)
    const waiterVisuals = [0, 1, 2].map(() => {
      const w = createWaiterGroup(shadowTex);
      w.visible = false;
      scene.add(w);
      return w;
    });

    // Pooled celebration / bump spark particles
    interface Spark {
      mesh: THREE.Mesh;
      vx: number;
      vy: number;
      vz: number;
      life: number;
    }
    const sparkPool: Spark[] = Array.from({ length: 24 }, () => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
      );
      m.visible = false;
      scene.add(m);
      return { mesh: m, vx: 0, vy: 0, vz: 0, life: 0 };
    });

    const spawnBurst = (x: number, z: number, colorHex: number) => {
      let count = 0;
      for (const sp of sparkPool) {
        if (sp.life <= 0 && count < 12) {
          const angle = (count / 12) * Math.PI * 2;
          sp.mesh.position.set(x, 0.9, z);
          (sp.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
          sp.vx = Math.cos(angle) * (2.2 + (count % 3) * 0.7);
          sp.vy = 2.5 + (count % 2) * 1.1;
          sp.vz = Math.sin(angle) * (2.2 + (count % 3) * 0.7);
          sp.life = 0.55;
          sp.mesh.visible = true;
          count++;
        }
      }
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let disposed = false;
    let frameId = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    let lastHudSync = 0;

    const afterDraw = (cb: () => void) => {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
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

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      elapsed += dt;

      const cur = simRef.current;

      if (cur.status === 'playing') {
        const justDash = dashQueuedRef.current;
        dashQueuedRef.current = false;

        const prevStatus = cur.status;
        const { next, events } = stepGameSimulation(cur, dt, heldRef.current, justDash);
        simRef.current = next;

        if (events.dashed) gameAudio.playDash();
        if (events.pickedUpDish) gameAudio.playPickup();
        if (events.deliveredOrder) {
          gameAudio.playDeliver(events.deliveredOrder.combo);
          spawnBurst(next.cartPos.x, next.cartPos.z, 0xfbbf24);
        }
        if (events.bumpedWaiter) {
          gameAudio.playBump();
          spawnBurst(next.cartPos.x, next.cartPos.z, 0xef4444);
        }
        if (events.waveCleared && next.status === 'playing') {
          gameAudio.playWaveClear();
          toast.success(`Wave ${events.waveCleared} Cleared! Reputation boosted.`);
        }
        if (prevStatus === 'playing' && next.status === 'victory') {
          gameAudio.playWaveClear();
        } else if (prevStatus === 'playing' && next.status === 'gameover') {
          gameAudio.playGameOver();
        }

        if (
          now - lastHudSync > 90 ||
          events.pickedUpDish ||
          events.deliveredOrder ||
          events.bumpedWaiter ||
          events.expiredTableId ||
          events.waveCleared ||
          next.status !== prevStatus
        ) {
          lastHudSync = now;
          setHud(toHudSnapshot(next));
        }
      }

      const activeState = simRef.current;

      // Update Cart Transform & Carried Dome
      playerCart.position.set(activeState.cartPos.x, 0, activeState.cartPos.z);
      playerCart.rotation.y = activeState.cartHeading;
      const speedMag = Math.hypot(activeState.cartVel.x, activeState.cartVel.z);
      const wheels = playerCart.userData.wheels as THREE.Mesh[] | undefined;
      if (wheels) {
        wheels.forEach((w) => {
          w.rotation.x += speedMag * dt * 2.4;
        });
      }
      const dome = playerCart.userData.carriedDome as THREE.Mesh | undefined;
      if (dome) {
        if (activeState.carriedDish) {
          dome.visible = true;
          const domeMat = dome.material as THREE.MeshStandardMaterial;
          domeMat.color.setHex(DISH_COLORS[activeState.carriedDish]);
          domeMat.emissive.setHex(DISH_COLORS[activeState.carriedDish]);
          domeMat.emissiveIntensity = 0.28;
        } else {
          dome.visible = false;
        }
      }

      // Update Tables Order Beacons & Patience Rings
      activeState.tables.forEach((tbl, idx) => {
        const vis = tableVisuals[idx];
        if (!vis) return;
        if (tbl.requestedDish) {
          vis.orderBeacon.visible = true;
          vis.orderBeacon.position.y = 1.85 + Math.sin(elapsed * 3.4 + idx) * 0.14;
          vis.orderBeacon.rotation.y = elapsed * 2.1;
          vis.beaconMat.color.setHex(DISH_COLORS[tbl.requestedDish]);
          vis.beaconMat.emissive.setHex(DISH_COLORS[tbl.requestedDish]);

          vis.patienceRing.visible = true;
          const p = tbl.patience;
          vis.ringMat.color.setHex(p > 0.55 ? 0x10b981 : p > 0.25 ? 0xf59e0b : 0xef4444);
          const pulseScale = p < 0.25 ? 1 + Math.sin(elapsed * 12) * 0.06 : 1;
          vis.patienceRing.scale.setScalar(pulseScale);
        } else {
          vis.orderBeacon.visible = false;
          vis.patienceRing.visible = false;
        }
      });

      // Update Waiters
      waiterVisuals.forEach((wv, idx) => {
        const wData = activeState.waiters[idx];
        if (wData) {
          wv.visible = true;
          wv.position.set(wData.position.x, 0, wData.position.z);
          wv.rotation.y = Math.sin(wData.phase) >= 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          wv.visible = false;
        }
      });

      // Update Steam Sprites
      steamSprites.forEach((st) => {
        const cycle = (elapsed * 0.55 + st.offset) % 1;
        st.sprite.position.set(st.baseX + Math.sin(elapsed * 2 + st.offset) * 0.12, 1.45 + cycle * 1.15, st.baseZ);
        (st.sprite.material as THREE.SpriteMaterial).opacity = (1 - cycle) * 0.34;
      });

      // Update Spark Burst Pool
      for (const sp of sparkPool) {
        if (sp.life > 0) {
          sp.life -= dt;
          sp.vy -= 7.5 * dt;
          sp.mesh.position.x += sp.vx * dt;
          sp.mesh.position.y = Math.max(0.05, sp.mesh.position.y + sp.vy * dt);
          sp.mesh.position.z += sp.vz * dt;
          sp.mesh.scale.setScalar(Math.max(0.1, sp.life * 1.8));
          if (sp.life <= 0) sp.mesh.visible = false;
        }
      }

      // Camera Choreography (Title sweep vs Gameplay chase + Shake)
      if (activeState.status === 'title') {
        const orbitAngle = elapsed * 0.24;
        _camGoal.set(Math.sin(orbitAngle) * 11.5, 8.2, Math.cos(orbitAngle) * 12.2);
        _lookGoal.set(0, 0.8, -0.5);
        camera.position.lerp(_camGoal, 1 - Math.exp(-3 * dt));
        camera.lookAt(_lookGoal);
      } else {
        const shakeX = activeState.shakeIntensity > 0 ? Math.sin(elapsed * 55) * activeState.shakeIntensity : 0;
        const shakeZ = activeState.shakeIntensity > 0 ? Math.cos(elapsed * 48) * activeState.shakeIntensity : 0;
        _camGoal.set(activeState.cartPos.x * 0.36 + shakeX, 11.2, activeState.cartPos.z * 0.36 + 11.4 + shakeZ);
        _lookGoal.set(activeState.cartPos.x * 0.25, 0.4, activeState.cartPos.z * 0.2);
        camera.position.lerp(_camGoal, 1 - Math.exp(-7 * dt));
        camera.lookAt(_lookGoal);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    const onResize = () => {
      if (!container || disposed) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      envTarget.dispose();
      disposeSceneResources(scene);
      renderer.dispose();
    };
  }, []);

  const handleSubmitLeaderboard = async () => {
    if (!firebaseUser || !firebaseUser.verified) {
      toast.error('Please sign in with a verified Google account to post to the leaderboard.');
      return;
    }
    setSubmittingScore(true);
    try {
      const saved = await submitGameScoreToFirestore(firebaseUser.uid, {
        playerName: firebaseUser.name,
        score: hud.score,
        waveReached: hud.wave,
        ordersDelivered: hud.ordersDelivered,
        maxCombo: hud.maxCombo,
      });
      setScoreSubmitted(true);
      setLeaderboard((prev) => [...prev, saved].sort((a, b) => b.score - a.score).slice(0, 10));
      toast.success('Score recorded on the CaterEase Global Leaderboard!');
    } catch (err: any) {
      toast.error(err?.message || 'Could not submit score.');
    } finally {
      setSubmittingScore(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#16110d] overflow-hidden select-none text-stone-100">
      {/* Isolated WebGL viewport */}
      <div ref={mountRef} className="w-full h-full" aria-label="Banquet Rush 3D Arena" />

      {/* Top-Left Gameplay Telemetry (Compact, zero backdrop-filter, zero animated dots) */}
      {hud.status !== 'title' && (
        <div className="fixed top-4 left-4 z-20 flex flex-wrap items-center gap-2.5">
          <div className="px-3.5 py-2 rounded-xl bg-stone-950/92 border border-stone-700/90 flex items-center gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-400">Score</div>
              <div className="font-mono text-base font-bold text-amber-400 tabular-nums">{hud.score}</div>
            </div>
            <div className="h-6 w-px bg-stone-800" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-400">Wave {hud.wave}/3</div>
              <div className="font-mono text-sm font-semibold text-white tabular-nums">
                {hud.waveOrdersDone} / {hud.waveTargetOrders}
              </div>
            </div>
            <div className="h-6 w-px bg-stone-800" />
            <div className="flex items-center gap-1" aria-label={`Reputation ${hud.reputation} of 3`}>
              {[1, 2, 3].map((h) => (
                <Heart
                  key={h}
                  className={`w-4 h-4 ${
                    h <= hud.reputation ? 'text-rose-500 fill-rose-500' : 'text-stone-700'
                  }`}
                />
              ))}
            </div>
            {hud.combo > 1 && (
              <>
                <div className="h-6 w-px bg-stone-800" />
                <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 tabular-nums">
                  <Flame className="w-3.5 h-3.5" /> x{Math.min(4, 1 + (hud.combo - 1) * 0.25).toFixed(2)}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Top-Right Compact Controls */}
      {hud.status !== 'title' && (
        <div className="fixed top-4 right-4 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="w-9 h-9 rounded-xl bg-stone-950/92 border border-stone-700/90 flex items-center justify-center text-stone-200 hover:text-amber-300"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={togglePause}
            aria-label="Pause game"
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl bg-stone-950/92 border border-stone-700/90 text-xs font-semibold text-stone-100 hover:bg-stone-900"
          >
            <Pause className="w-3.5 h-3.5 text-amber-400" />
            Pause (P)
          </button>
        </div>
      )}

      {/* Bottom Compact Carried Dish & Dash Status */}
      {hud.status === 'playing' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          {/* Touch controls on small screens */}
          <div className="sm:hidden flex items-center gap-2 mb-1">
            <button
              type="button"
              onTouchStart={() => (heldRef.current.left = true)}
              onTouchEnd={() => (heldRef.current.left = false)}
              className="px-3 py-2 rounded-lg bg-stone-950/92 border border-stone-700 text-xs font-bold"
            >
              ←
            </button>
            <button
              type="button"
              onTouchStart={() => (heldRef.current.up = true)}
              onTouchEnd={() => (heldRef.current.up = false)}
              className="px-3 py-2 rounded-lg bg-stone-950/92 border border-stone-700 text-xs font-bold"
            >
              ↑
            </button>
            <button
              type="button"
              onTouchStart={() => (heldRef.current.down = true)}
              onTouchEnd={() => (heldRef.current.down = false)}
              className="px-3 py-2 rounded-lg bg-stone-950/92 border border-stone-700 text-xs font-bold"
            >
              ↓
            </button>
            <button
              type="button"
              onTouchStart={() => (heldRef.current.right = true)}
              onTouchEnd={() => (heldRef.current.right = false)}
              className="px-3 py-2 rounded-lg bg-stone-950/92 border border-stone-700 text-xs font-bold"
            >
              →
            </button>
            <button
              type="button"
              onClick={() => (dashQueuedRef.current = true)}
              className="px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold"
            >
              Dash
            </button>
          </div>

          <div className="px-4 py-2 rounded-xl bg-stone-950/92 border border-stone-700/90 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-stone-400">Cart Tray:</span>
              <span
                className="font-semibold px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: hud.carriedDish ? `#${DISH_COLORS[hud.carriedDish].toString(16).padStart(6, '0')}` : '#292524',
                }}
              >
                {hud.carriedDish ? DISH_LABELS[hud.carriedDish] : 'Empty — Visit Kitchen Pass'}
              </span>
            </div>
            <div className="h-4 w-px bg-stone-800" />
            <div className="flex items-center gap-2">
              <span className="text-stone-400">Dash:</span>
              <div className="w-16 h-2 rounded-full bg-stone-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-75"
                  style={{ width: `${Math.round(hud.dashReadyRatio * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Title Screen Overlay */}
      {hud.status === 'title' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-stone-950/55">
          <div className="max-w-2xl w-full rounded-2xl bg-stone-950/95 border border-stone-700 p-7 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-300 hover:text-amber-300"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to CaterEase
              </Link>
              <button
                type="button"
                onClick={toggleMute}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-xs text-stone-200"
              >
                {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
                {muted ? 'Muted' : 'Sound On'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              {/* Crisp inline SVG Emblem */}
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="shrink-0">
                <rect width="64" height="64" rx="16" fill="#291E12" stroke="#D9A441" strokeWidth="2" />
                <path d="M16 40H48" stroke="#D9A441" strokeWidth="3" strokeLinecap="round" />
                <path d="M20 40C20 29 25.5 22 32 22C38.5 22 44 29 44 40" fill="#B45309" stroke="#FBBF24" strokeWidth="2" />
                <circle cx="32" cy="18" r="3" fill="#FBBF24" />
                <circle cx="22" cy="48" r="3.5" fill="#E7E5E4" />
                <circle cx="42" cy="48" r="3.5" fill="#E7E5E4" />
              </svg>
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
                  Banquet Rush 3D
                </h1>
                <p className="mt-1 text-sm text-stone-300">
                  Pick up hot platters from the Kitchen Pass, dodge roving waiters, and serve VIP tables before patience expires across 3 waves.
                </p>
              </div>
            </div>

            {/* Flat Key Legend */}
            <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-stone-900 border border-stone-800">
                <div className="font-mono font-bold text-amber-400">WASD / Arrows</div>
                <div className="text-stone-400 mt-0.5">Steer Service Cart</div>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-900 border border-stone-800">
                <div className="font-mono font-bold text-amber-400">Space / Shift</div>
                <div className="text-stone-400 mt-0.5">Speed Dash</div>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-900 border border-stone-800">
                <div className="font-mono font-bold text-amber-400">P / Esc</div>
                <div className="text-stone-400 mt-0.5">Pause Service</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={startNewRun}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Service Shift
              </button>
              <span className="text-xs text-stone-400">Press Enter or Space to start</span>
            </div>

            {leaderboard.length > 0 && (
              <div className="pt-4 border-t border-stone-800">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-2">
                  <Trophy className="w-3.5 h-3.5" /> Top Banquet Chefs
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-28 overflow-y-auto text-xs">
                  {leaderboard.slice(0, 4).map((entry, idx) => (
                    <div
                      key={entry.scoreId}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-800"
                    >
                      <span className="truncate">
                        #{idx + 1} {entry.playerName}
                      </span>
                      <span className="font-mono font-bold text-amber-400 tabular-nums">{entry.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pause Overlay */}
      {hud.status === 'paused' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-stone-950/70">
          <div className="max-w-sm w-full rounded-2xl bg-stone-950 border border-stone-700 p-6 text-center space-y-4 shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-white">Service Paused</h2>
            <p className="text-xs text-stone-400">
              Wave {hud.wave} · Score {hud.score} · {hud.ordersDelivered} Orders Delivered
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={togglePause}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
              >
                Resume Shift (P)
              </button>
              <button
                type="button"
                onClick={startNewRun}
                className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 text-sm font-semibold"
              >
                Restart Shift (R)
              </button>
              <Link
                to="/"
                className="w-full py-2.5 rounded-xl border border-stone-700 text-stone-300 hover:text-white text-sm font-semibold"
              >
                Exit to CaterEase
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Victory / Game Over Modal */}
      {(hud.status === 'victory' || hud.status === 'gameover') && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-stone-950/75">
          <div className="max-w-md w-full rounded-2xl bg-stone-950 border border-stone-700 p-7 space-y-5 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-amber-900/50 border border-amber-700 text-amber-400 flex items-center justify-center mx-auto">
                <Award className="w-6 h-6" />
              </div>
              <h2 className="font-display text-2xl font-bold text-white">
                {hud.status === 'victory' ? 'Royal Gala Complete!' : 'Kitchen Service Over'}
              </h2>
              <p className="text-xs text-stone-400">
                {hud.status === 'victory'
                  ? 'All 3 banquet waves served with culinary precision.'
                  : 'Too many tables lost patience before service arrived.'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-xl bg-stone-900 border border-stone-800">
                <div className="text-[11px] text-stone-400">Final Score</div>
                <div className="font-mono text-lg font-bold text-amber-400 tabular-nums">{hud.score}</div>
              </div>
              <div className="p-3 rounded-xl bg-stone-900 border border-stone-800">
                <div className="text-[11px] text-stone-400">Delivered</div>
                <div className="font-mono text-lg font-bold text-white tabular-nums">{hud.ordersDelivered}</div>
              </div>
              <div className="p-3 rounded-xl bg-stone-900 border border-stone-800">
                <div className="text-[11px] text-stone-400">Max Combo</div>
                <div className="font-mono text-lg font-bold text-emerald-400 tabular-nums">{hud.maxCombo}x</div>
              </div>
            </div>

            {firebaseUser?.verified ? (
              <button
                type="button"
                onClick={handleSubmitLeaderboard}
                disabled={scoreSubmitted || submittingScore}
                className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-60"
              >
                {scoreSubmitted
                  ? 'Score Saved to Global Leaderboard'
                  : submittingScore
                    ? 'Submitting Score...'
                    : `Save Score as ${firebaseUser.name}`}
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 text-xs text-stone-300 flex items-center justify-between gap-2">
                <span>Sign in with Google to post your score to Firestore.</span>
                <Link to="/login" className="text-amber-400 font-semibold whitespace-nowrap hover:underline">
                  Sign In
                </Link>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={startNewRun}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
              >
                <RotateCcw className="w-4 h-4" /> Play Again (R)
              </button>
              <Link
                to="/"
                className="px-4 py-2.5 rounded-xl border border-stone-700 text-stone-200 hover:bg-stone-900 text-sm font-semibold"
              >
                Exit
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
