import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_HALF_D,
  ARENA_HALF_W,
  createInitialGameState,
  PASS_STATIONS,
  stepGameSimulation,
} from './banquetGameLogic.ts';

const idleHeld = { up: false, down: false, left: false, right: false };

describe('Banquet Rush 3D pure game simulation', () => {
  it('clamps delta time spikes and keeps cart within arena bounds', () => {
    let state = createInitialGameState('playing');
    for (let i = 0; i < 120; i++) {
      state = stepGameSimulation(
        state,
        0.5, // huge lag spike should clamp safely to 0.05s
        { up: false, down: false, left: false, right: true },
        false
      ).next;
    }
    assert.ok(state.cartPos.x <= ARENA_HALF_W);
    assert.ok(state.cartPos.z <= ARENA_HALF_D && state.cartPos.z >= -ARENA_HALF_D);
  });

  it('picks up dish at pass station and delivers to matching table for combo score', () => {
    let state = createInitialGameState('playing');
    const biryaniPass = PASS_STATIONS.find((s) => s.dish === 'BIRYANI')!;
    state.cartPos = { ...biryaniPass.position };

    const pickStep = stepGameSimulation(state, 0.016, idleHeld, false);
    state = pickStep.next;
    assert.equal(state.carriedDish, 'BIRYANI');
    assert.equal(pickStep.events.pickedUpDish, 'BIRYANI');

    // Move near Table 2 which starts with a BIRYANI request
    const t2 = state.tables.find((t) => t.id === 2)!;
    state.cartPos = { x: t2.position.x, z: t2.position.z - 1.45 };

    const deliverStep = stepGameSimulation(state, 0.016, idleHeld, false);
    state = deliverStep.next;
    assert.equal(state.carriedDish, null);
    assert.equal(state.ordersDelivered, 1);
    assert.equal(state.combo, 1);
    assert.ok(state.score >= 120);
    assert.equal(deliverStep.events.deliveredOrder?.tableId, 2);
  });

  it('triggers dash boost and cooldown cleanly', () => {
    const state = createInitialGameState('playing');
    const step1 = stepGameSimulation(state, 0.016, { ...idleHeld, right: true }, true);
    assert.equal(step1.events.dashed, true);
    assert.ok(step1.next.dashTimeLeft > 0);
    assert.ok(step1.next.dashCooldownLeft > 0);

    // Immediate second dash press while on cooldown should not re-trigger
    const step2 = stepGameSimulation(step1.next, 0.016, { ...idleHeld, right: true }, true);
    assert.equal(step2.events.dashed, false);
  });

  it('triggers victory after clearing Wave 3 orders', () => {
    const state = createInitialGameState('playing');
    state.wave = 3;
    state.waveTargetOrders = 8;
    state.waveOrdersDone = 7;
    state.carriedDish = 'BIRYANI';
    const t2 = state.tables.find((t) => t.id === 2)!;
    state.cartPos = { x: t2.position.x, z: t2.position.z - 1.45 };

    const finalStep = stepGameSimulation(state, 0.016, idleHeld, false);
    assert.equal(finalStep.events.waveCleared, 3);
    assert.equal(finalStep.next.status, 'victory');
  });

  it('triggers gameover when all reputation hearts expire', () => {
    const state = createInitialGameState('playing');
    state.reputation = 1;
    const t2 = state.tables.find((t) => t.id === 2)!;
    t2.patience = 0.001;
    t2.maxPatienceSec = 10;

    const expiredStep = stepGameSimulation(state, 0.05, idleHeld, false);
    assert.equal(expiredStep.events.expiredTableId, 2);
    assert.equal(expiredStep.next.status, 'gameover');
  });
});
