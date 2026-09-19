import { expect, test } from '@playwright/test';
import * as THREE from 'three';
import { advanceRiggedMouth, advanceRiggedSpring, emptyRiggedMouth, riggedIdle } from '../../src/lib/rigged-avatar-motion';
import { createRiggedAvatar } from '../../src/lib/rigged-avatar';
import { loadGeometryOnlyAvatar } from './rigged-avatar-fixture';

test('3D gesture preserves velocity through reversals and converges at 15/60/120Hz', () => {
  const sample = (hz: number) => {
    let state = { position: 0, velocity: 0 };
    for (let i = 0; i < hz; i++) state = advanceRiggedSpring(state, 1, 1 / hz);
    return state;
  };
  expect(sample(15).position).toBeCloseTo(sample(120).position, 8);
  expect(sample(60).position).toBeCloseTo(sample(120).position, 8);
  let state = { position: 0, velocity: 0 };
  for (let i = 0; i < 12; i++) state = advanceRiggedSpring(state, 1, 1 / 60);
  const reversed = advanceRiggedSpring(state, 0, 1 / 60);
  expect(Math.abs(reversed.position - state.position)).toBeLessThan(.045);
  expect(reversed.velocity).toBeGreaterThan(0);
  for (let i = 0; i < 150; i++) state = advanceRiggedSpring(state, 0, 1 / 60);
  expect(state).toEqual({ position: 0, velocity: 0 });
});

test('3D lips coarticulate in 22ms, scale quiet vowels and close on silence or lip seal', () => {
  const quiet = advanceRiggedMouth(emptyRiggedMouth(), 'a', .04, .1);
  const strong = advanceRiggedMouth(emptyRiggedMouth(), 'a', .35, .1);
  expect(quiet.a).toBeLessThan(strong.a * .25);
  const transition = advanceRiggedMouth(strong, 'o', .35, .022);
  expect(transition.a).toBeGreaterThan(.2);
  expect(transition.o).toBeGreaterThan(.48);
  expect(transition.a + transition.o).toBeLessThanOrEqual(.78);
  expect(advanceRiggedMouth(transition, 'a', 0, 0)).toEqual(emptyRiggedMouth());
  expect(advanceRiggedMouth(transition, 'rest', .8, 0)).toEqual(emptyRiggedMouth());
  expect(advanceRiggedMouth(transition, 'a', Number.NaN, 0)).toEqual(emptyRiggedMouth());
  const sealed = advanceRiggedMouth(transition, 'mbp', .35, 0);
  expect(sealed.mbp).toBeCloseTo(.72, 8);
  expect({ ...sealed, mbp: 0 }).toEqual(emptyRiggedMouth());
});

test('3D waiting uses separate actions with true holds and never rocks the torso', () => {
  expect(riggedIdle(4.35, 0, 0, false).gaze).toBeGreaterThan(.1);
  expect(riggedIdle(4.35, 0, 0, false).headYaw).toBe(0);
  expect(riggedIdle(4.85, 0, 0, false).headYaw).toBeGreaterThan(.02);
  expect(riggedIdle(32.8, 0, 0, false).gaze).toBeLessThan(-.1);
  expect(riggedIdle(14.3, 0, 0, false).gazeDown).toBeGreaterThan(.9);
  expect(riggedIdle(23.2, 0, 0, false).shoulderSettle).toBe(1);
  expect(riggedIdle(4.85, 1, 0, false).headYaw).toBe(0);
  expect(riggedIdle(4.85, 0, 1, false).gaze).toBe(0);
  expect(riggedIdle(14.3, 1, 1, true)).toEqual(riggedIdle(0, 0, 0, true));
  let holds = 0;
  for (let i = 0; i < 430; i++) {
    const frame = riggedIdle(i / 10, 0, 0, false);
    expect([frame.torsoYaw, frame.torsoRoll, frame.headRoll]).toEqual([0, 0, 0]);
    const activities = [Math.abs(frame.gaze) + Math.abs(frame.headYaw), frame.gazeDown + frame.headPitch, frame.shoulderSettle];
    expect(activities.filter(n => n > 0)).toHaveLength(frame.action === 'still' ? 0 : 1);
    if (frame.action === 'still') holds++;
    expect(frame.breath).toBeGreaterThanOrEqual(0); expect(frame.breath).toBeLessThanOrEqual(.001);
    expect(Object.values(frame).filter(v => typeof v === 'number').every(Number.isFinite)).toBe(true);
  }
  expect(holds / 430).toBeGreaterThan(.8);
});

for (const female of [false, true]) {
  test(`actual 3D skeleton: shoulders lead torso, head remains bounded and reduced pose is still (${female ? 'female' : 'male'})`, async () => {
    const rig = createRiggedAvatar(await loadGeometryOnlyAvatar(female));
    const head = rig.bones.get('Head')!;
    const rest = rig.update({ gesture: 'rest' }, 1, 0);
    let state = rest;
    const initialHead = head.quaternion.clone();
    const positions: number[][] = [];
    const camera = new THREE.PerspectiveCamera(28, 1, .05, 20);
    camera.position.set(0, 1.46, 1.72); camera.lookAt(0, 1.43, 0); camera.updateMatrixWorld(true);
    for (let i = 0; i < 90; i++) {
      state = rig.update({ gesture: 'hand_raise' }, 1 + i / 60, 1 / 60);
      positions.push(state.handPosition);
      for (const [name, bone] of rig.bones) {
        if (!name.startsWith('LeftHand') || !name.endsWith('3')) continue;
        const tip = bone.getWorldPosition(new THREE.Vector3());
        if (tip.y > 1.08) expect(tip.project(camera).x).toBeLessThan(.95);
      }
      expect(head.quaternion.angleTo(initialHead)).toBeLessThan(.06);
      if (i === 8) {
        expect(state.shoulder).toBeGreaterThan(state.raise);
        expect(state.raise).toBeGreaterThan(state.torso);
        const wrist = rig.bones.get('LeftHand')!;
        const held = wrist.quaternion.clone();
        const armHeld = rig.bones.get('LeftArm')!.quaternion.clone();
        const fingerHeld = rig.bones.get('LeftHandRing2')!.quaternion.clone();
        for (let hold = 0; hold < 300; hold++) rig.update({ gesture: 'hand_raise' }, 1 + i / 60, 0);
        expect(wrist.quaternion.angleTo(held)).toBeLessThan(.000001);
        expect(rig.bones.get('LeftArm')!.quaternion.angleTo(armHeld)).toBeLessThan(.000001);
        expect(rig.bones.get('LeftHandRing2')!.quaternion.angleTo(fingerHeld)).toBeLessThan(.000001);
        expect(wrist.scale.x).toBeCloseTo(.92, 3);
        expect(wrist.scale.y).toBeCloseTo(.95, 3);
      }
    }
    expect(state.handPosition[1] - rest.handPosition[1]).toBeGreaterThan(.4);
    expect(Math.max(...positions.slice(1).map((p, i) => new THREE.Vector3(...p).distanceTo(new THREE.Vector3(...positions[i]))))).toBeLessThan(.08);
    rig.update({ gesture: 'rest' }, 1, 0, true);
    const staticHead = head.quaternion.clone();
    const staticHand = rig.update({ gesture: 'hand_raise' }, 2, 0, true).handPosition;
    for (let i = 0; i < 100; i++) {
      const frozen = rig.update({ gesture: 'hand_raise' }, i * 7, .016, true);
      expect(frozen.handPosition).toEqual(staticHand);
      expect(frozen.idleAttention).toBe(0);
    }
    rig.update({ gesture: 'rest' }, 0, 0, true);
    const torsoBase = rig.bones.get('Spine2')!.quaternion.clone();
    const lowerBase = rig.bones.get('Spine1')!.quaternion.clone();
    let eyes: THREE.Mesh | undefined;
    rig.root.traverse(node => { const mesh = node as THREE.Mesh; if (mesh.name.includes('high-poly')) eyes = mesh; });
    expect(eyes!.morphTargetDictionary!.eyeLookInLeft).toBeDefined();
    expect(eyes!.morphTargetDictionary!.eyeLookDownConclavia).toBeDefined();
    for (let i = 0; i <= 430; i++) {
      const waiting = rig.update({ gesture: 'rest' }, i / 10, .1);
      expect(rig.bones.get('Spine2')!.quaternion.toArray()).toEqual(torsoBase.toArray());
      expect(rig.bones.get('Spine1')!.quaternion.toArray()).toEqual(lowerBase.toArray());
      if (waiting.idleAction === 'still') expect(head.quaternion.toArray()).toEqual(staticHead.toArray());
    }
    rig.update({ gesture: 'rest' }, 14.3, 0);
    expect(eyes!.morphTargetInfluences![eyes!.morphTargetDictionary!.eyeLookDownConclavia]).toBeGreaterThan(.9);
    rig.update({ gesture: 'rest' }, 77, 0, true);
    expect(head.quaternion.angleTo(staticHead)).toBeLessThan(.000001);
    expect(head.scale.x).toBeCloseTo(1.085, 3);
    rig.dispose();
  });
}

test('3D browser preserves the waiting pose across visibility changes and honors live reduced motion', async ({ page }) => {
  await page.context().addCookies([{ name: 'conclavia_locale', value: 'en', url: 'http://127.0.0.1:3101' }]);
  await page.goto('/avatar/test');
  await page.getByLabel('Avatar style', { exact: true }).selectOption('stylized_3d');
  const canvas = page.getByTestId('avatar-3d-canvas');
  await expect(canvas).toHaveAttribute('data-renderer-ready', 'true');
  const start = new Date('2026-09-19T12:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 100));
  await page.clock.runFor(2000);
  const before = (await canvas.getAttribute('data-head-rotation'))!.split(',').map(Number);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(30_000);
  expect((await canvas.getAttribute('data-head-rotation'))!.split(',').map(Number)).toEqual(before);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(32);
  const resumed = (await canvas.getAttribute('data-head-rotation'))!.split(',').map(Number);
  expect(Math.max(...resumed.map((n, i) => Math.abs(n - before[i])))).toBeLessThan(.002);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.runFor(32);
  await expect(canvas).toHaveAttribute('data-reduced-motion', 'true');
  const frozen = await canvas.getAttribute('data-head-rotation');
  await page.clock.runFor(7000);
  expect(await canvas.getAttribute('data-head-rotation')).toBe(frozen);
  await page.getByRole('button', { name: 'Raise / lower hand' }).evaluate((b: HTMLButtonElement) => b.click());
  await page.clock.runFor(32);
  await expect(canvas).toHaveAttribute('data-raise-progress', '1.0000');
  await expect(canvas).toHaveAttribute('data-idle-attention', '0.00000');
});

test('3D browser waiting keeps actual waist pixels and torso pose fixed through attention actions', async ({ page }) => {
  await page.context().addCookies([{ name: 'conclavia_locale', value: 'en', url: 'http://127.0.0.1:3101' }]);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/avatar');
  await page.getByLabel('Avatar style', { exact: true }).selectOption('stylized_3d');
  const canvas = page.getByTestId('avatar-3d-canvas');
  await expect(canvas).toHaveAttribute('data-renderer-ready', 'true');
  const start = new Date('2026-09-19T12:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 100));
  const box = (await canvas.boundingBox())!;
  const clip = { x: box.x + box.width * .38, y: box.y + box.height * .91,
    width: Math.floor(box.width * .24), height: Math.floor(box.height * .06) };
  const baseline = await page.screenshot({ clip });
  const torso = await canvas.getAttribute('data-torso-rotation');
  const lower = await canvas.getAttribute('data-lower-spine-rotation');
  for (const ms of [4100, 9500, 8800, 10200]) {
    await page.clock.runFor(ms);
    expect(await canvas.getAttribute('data-torso-rotation')).toBe(torso);
    expect(await canvas.getAttribute('data-lower-spine-rotation')).toBe(lower);
    expect(await page.screenshot({ clip })).toEqual(baseline);
  }
});
