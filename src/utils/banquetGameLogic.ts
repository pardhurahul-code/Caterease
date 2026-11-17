export type DishType = 'STARTERS' | 'BIRYANI' | 'MITHAI';

export interface Vec2 {
  x: number;
  z: number;
}

export interface GuestTableState {
  id: number;
  label: string;
  position: Vec2;
  requestedDish: DishType | null;
  patience: number; // 0..1
  maxPatienceSec: number;
  cooldownSec: number;
}

export interface WaiterObstacle {
  id: number;
  position: Vec2;
  start: Vec2;
  end: Vec2;
  speed: number;
  phase: number;
}

export interface StationLocation {
  dish: DishType;
  label: string;
  position: Vec2;
  colorHex: number;
}

export interface HeldInputs {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface GameSimulationState {
  status: 'title' | 'playing' | 'paused' | 'victory' | 'gameover';
  wave: number;
  score: number;
  combo: number;
  maxCombo: number;
  reputation: number;
  ordersDelivered: number;
  waveTargetOrders: number;
  waveOrdersDone: number;
  cartPos: Vec2;
  cartVel: Vec2;
  cartHeading: number;
  carriedDish: DishType | null;
  dashTimeLeft: number;
  dashCooldownLeft: number;
  bumpCooldownLeft: number;
  hitstopLeft: number;
  shakeIntensity: number;
  tables: GuestTableState[];
  waiters: WaiterObstacle[];
}

export interface StepEvents {
  pickedUpDish: DishType | null;
  deliveredOrder: { tableId: number; points: number; combo: number } | null;
  expiredTableId: number | null;
  bumpedWaiter: boolean;
  waveCleared: number | null;
  dashed: boolean;
}

export const ARENA_HALF_W = 9.0;
export const ARENA_HALF_D = 7.4;

export const PASS_STATIONS: StationLocation[] = [
  { dish: 'STARTERS', label: 'Starters Pass', position: { x: -5.2, z: -6.1 }, colorHex: 0x0f766e },
  { dish: 'BIRYANI', label: 'Saffron Biryani', position: { x: 0, z: -6.1 }, colorHex: 0xb45309 },
  { dish: 'MITHAI', label: 'Royal Mithai', position: { x: 5.2, z: -6.1 }, colorHex: 0x9f1239 },
];

const INITIAL_TABLE_POSITIONS: Vec2[] = [
  { x: -5.4, z: -1.3 },
  { x: 0, z: -1.3 },
  { x: 5.4, z: -1.3 },
  { x: -5.4, z: 4.1 },
  { x: 0, z: 4.1 },
  { x: 5.4, z: 4.1 },
];

const DISH_ORDER: DishType[] = ['STARTERS', 'BIRYANI', 'MITHAI'];

export function createWaitersForWave(wave: number): WaiterObstacle[] {
  const speedScale = 1 + (wave - 1) * 0.25;
  const base: WaiterObstacle[] = [
    {
      id: 0,
      position: { x: -6.5, z: 1.4 },
      start: { x: -7.2, z: 1.4 },
      end: { x: 7.2, z: 1.4 },
      speed: 2.8 * speedScale,
      phase: 0,
    },
  ];
  if (wave >= 2) {
    base.push({
      id: 1,
      position: { x: 6.8, z: -3.6 },
      start: { x: -6.8, z: -3.6 },
      end: { x: 6.8, z: -3.6 },
      speed: 3.1 * speedScale,
      phase: Math.PI,
    });
  }
  if (wave >= 3) {
    base.push({
      id: 2,
      position: { x: -2.7, z: 5.8 },
      start: { x: -2.7, z: -0.4 },
      end: { x: -2.7, z: 5.8 },
      speed: 2.9 * speedScale,
      phase: Math.PI * 0.5,
    });
  }
  return base;
}

export function waveOrderTarget(wave: number): number {
  return 4 + (wave - 1) * 2;
}

export function createInitialGameState(status: GameSimulationState['status'] = 'title'): GameSimulationState {
  const tables: GuestTableState[] = INITIAL_TABLE_POSITIONS.map((pos, idx) => ({
    id: idx + 1,
    label: `T${idx + 1}`,
    position: { ...pos },
    requestedDish: idx === 1 ? 'BIRYANI' : idx === 3 ? 'STARTERS' : null,
    patience: 1,
    maxPatienceSec: 26,
    cooldownSec: idx === 1 || idx === 3 ? 0 : 2.2 + idx * 1.4,
  }));

  return {
    status,
    wave: 1,
    score: 0,
    combo: 0,
    maxCombo: 0,
    reputation: 3,
    ordersDelivered: 0,
    waveTargetOrders: waveOrderTarget(1),
    waveOrdersDone: 0,
    cartPos: { x: 0, z: -3.9 },
    cartVel: { x: 0, z: 0 },
    cartHeading: 0,
    carriedDish: null,
    dashTimeLeft: 0,
    dashCooldownLeft: 0,
    bumpCooldownLeft: 0,
    hitstopLeft: 0,
    shakeIntensity: 0,
    tables,
    waiters: createWaitersForWave(1),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export function stepGameSimulation(
  state: GameSimulationState,
  rawDt: number,
  held: HeldInputs,
  justPressedDash: boolean,
  rng: () => number = Math.random
): { next: GameSimulationState; events: StepEvents } {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  const events: StepEvents = {
    pickedUpDish: null,
    deliveredOrder: null,
    expiredTableId: null,
    bumpedWaiter: false,
    waveCleared: null,
    dashed: false,
  };

  if (state.status !== 'playing' || dt <= 0) {
    return { next: state, events };
  }

  const next: GameSimulationState = {
    ...state,
    cartPos: { ...state.cartPos },
    cartVel: { ...state.cartVel },
    tables: state.tables.map((t) => ({ ...t, position: { ...t.position } })),
    waiters: state.waiters.map((w) => ({ ...w, position: { ...w.position } })),
  };

  // Decay screen shake & hitstop
  next.shakeIntensity = Math.max(0, next.shakeIntensity - dt * 2.8);
  if (next.hitstopLeft > 0) {
    next.hitstopLeft = Math.max(0, next.hitstopLeft - dt);
    return { next, events };
  }

  next.dashTimeLeft = Math.max(0, next.dashTimeLeft - dt);
  next.dashCooldownLeft = Math.max(0, next.dashCooldownLeft - dt);
  next.bumpCooldownLeft = Math.max(0, next.bumpCooldownLeft - dt);

  if (justPressedDash && next.dashCooldownLeft <= 0) {
    next.dashTimeLeft = 0.26;
    next.dashCooldownLeft = 1.5;
    events.dashed = true;
  }

  // Movement input
  let ix = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  let iz = (held.down ? 1 : 0) - (held.up ? 1 : 0);
  const mag = Math.hypot(ix, iz);
  if (mag > 0) {
    ix /= mag;
    iz /= mag;
  }

  const speed = 7.4 * (next.dashTimeLeft > 0 ? 2.15 : 1) * (next.bumpCooldownLeft > 0.35 ? 0.45 : 1);
  const targetVx = ix * speed;
  const targetVz = iz * speed;
  const lerpAlpha = 1 - Math.exp(-14 * dt);

  next.cartVel.x += (targetVx - next.cartVel.x) * lerpAlpha;
  next.cartVel.z += (targetVz - next.cartVel.z) * lerpAlpha;

  next.cartPos.x = clamp(next.cartPos.x + next.cartVel.x * dt, -ARENA_HALF_W, ARENA_HALF_W);
  next.cartPos.z = clamp(next.cartPos.z + next.cartVel.z * dt, -ARENA_HALF_D, ARENA_HALF_D);

  if (Math.hypot(next.cartVel.x, next.cartVel.z) > 0.25) {
    next.cartHeading = Math.atan2(next.cartVel.x, next.cartVel.z);
  }

  // Resolve soft collisions against banquet table pillars
  const tableColliderRadius = 1.25;
  for (const table of next.tables) {
    const dx = next.cartPos.x - table.position.x;
    const dz = next.cartPos.z - table.position.z;
    const d = Math.hypot(dx, dz);
    if (d < tableColliderRadius && d > 0.0001) {
      const push = tableColliderRadius - d;
      next.cartPos.x += (dx / d) * push;
      next.cartPos.z += (dz / d) * push;
    }
  }

  // Update roving waiter obstacles & test cart collision
  const waiterHitRadiusSq = 1.05 * 1.05;
  for (const waiter of next.waiters) {
    const segLen = Math.max(0.5, Math.hypot(waiter.end.x - waiter.start.x, waiter.end.z - waiter.start.z));
    waiter.phase += (waiter.speed / segLen) * dt * Math.PI;
    const t = 0.5 - 0.5 * Math.cos(waiter.phase);
    waiter.position.x = waiter.start.x + (waiter.end.x - waiter.start.x) * t;
    waiter.position.z = waiter.start.z + (waiter.end.z - waiter.start.z) * t;

    if (next.bumpCooldownLeft <= 0 && distSq(next.cartPos, waiter.position) <= waiterHitRadiusSq) {
      next.bumpCooldownLeft = 0.85;
      next.hitstopLeft = 0.045;
      next.shakeIntensity = 0.42;
      next.combo = 0;
      events.bumpedWaiter = true;
    }
  }

  // Check Kitchen Pass dish pickup
  const stationRadiusSq = 1.55 * 1.55;
  for (const station of PASS_STATIONS) {
    if (distSq(next.cartPos, station.position) <= stationRadiusSq && next.carriedDish !== station.dish) {
      next.carriedDish = station.dish;
      events.pickedUpDish = station.dish;
      break;
    }
  }

  // Update table orders, patience & deliveries
  const deliveryRadiusSq = 2.05 * 2.05;
  const activeCount = next.tables.filter((t) => t.requestedDish !== null).length;
  const desiredMaxActive = Math.min(5, 2 + next.wave);

  for (const table of next.tables) {
    if (table.requestedDish !== null) {
      // Deliver if cart matches dish within range
      if (next.carriedDish === table.requestedDish && distSq(next.cartPos, table.position) <= deliveryRadiusSq) {
        const speedBonus = Math.round(table.patience * 80);
        next.combo += 1;
        next.maxCombo = Math.max(next.maxCombo, next.combo);
        const mult = Math.min(4, 1 + (next.combo - 1) * 0.25);
        const points = Math.round((120 + speedBonus) * mult);

        next.score += points;
        next.ordersDelivered += 1;
        next.waveOrdersDone += 1;
        next.carriedDish = null;

        table.requestedDish = null;
        table.patience = 1;
        table.cooldownSec = Math.max(1.5, 4.0 - next.wave * 0.6);

        events.deliveredOrder = { tableId: table.id, points, combo: next.combo };
        continue;
      }

      // Decay patience
      table.patience = Math.max(0, table.patience - dt / table.maxPatienceSec);
      if (table.patience <= 0) {
        table.requestedDish = null;
        table.patience = 1;
        table.cooldownSec = 3.2;
        next.reputation = Math.max(0, next.reputation - 1);
        next.combo = 0;
        next.shakeIntensity = 0.35;
        events.expiredTableId = table.id;
        if (next.reputation <= 0) {
          next.status = 'gameover';
          return { next, events };
        }
      }
    } else if (activeCount < desiredMaxActive) {
      table.cooldownSec -= dt;
      if (table.cooldownSec <= 0) {
        const dishIdx = Math.floor(rng() * DISH_ORDER.length) % DISH_ORDER.length;
        table.requestedDish = DISH_ORDER[dishIdx];
        table.maxPatienceSec = Math.max(16, 26 - (next.wave - 1) * 3.5);
        table.patience = 1;
      }
    }
  }

  // Wave progression
  if (next.waveOrdersDone >= next.waveTargetOrders) {
    events.waveCleared = next.wave;
    if (next.wave >= 3) {
      next.score += next.reputation * 250;
      next.status = 'victory';
    } else {
      next.wave += 1;
      next.waveOrdersDone = 0;
      next.waveTargetOrders = waveOrderTarget(next.wave);
      next.reputation = Math.min(3, next.reputation + 1);
      next.waiters = createWaitersForWave(next.wave);
    }
  }

  return { next, events };
}
