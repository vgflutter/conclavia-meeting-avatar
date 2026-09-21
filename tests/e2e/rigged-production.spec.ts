import { expect, test } from '@playwright/test';
import * as THREE from 'three';
import { createRiggedAvatar } from '../../src/lib/rigged-avatar';
import { advanceRiggedMouth, emptyRiggedMouth } from '../../src/lib/rigged-avatar-motion';
import { finishRiggedMaterial } from '@conclavia/avatar-kit/lib/rigged-avatar-materials';
import { loadGeometryOnlyAvatar } from './rigged-avatar-fixture';

test('3D phonemes have distinct anatomical gains without losing envelope or hard stops', () => {
  const settled = (viseme: 'a' | 'e' | 'o' | 'u', level: number) => {
    let mouth = emptyRiggedMouth();
    for (let i = 0; i < 20; i++) mouth = advanceRiggedMouth(mouth, viseme, level, 1 / 60);
    return mouth;
  };
  const a = settled('a', .35), e = settled('e', .35), o = settled('o', .35), u = settled('u', .35);
  expect(a.a).toBeCloseTo(.64, 5); expect(e.e).toBeCloseTo(.60, 5);
  expect(o.o).toBeCloseTo(.76, 5); expect(u.u).toBeCloseTo(.72, 5);
  expect(settled('a', .10625).a / a.a).toBeCloseTo(.5, 5);
  const transition = advanceRiggedMouth(a, 'o', .35, .022);
  expect(transition.o / .76).toBeCloseTo(1 - Math.exp(-1), 6);
  expect(transition.a / a.a).toBeCloseTo(Math.exp(-1), 6);
  expect(advanceRiggedMouth(transition, 'rest', .35, 0)).toEqual(emptyRiggedMouth());
  expect(advanceRiggedMouth(transition, 'a', 0, 0)).toEqual(emptyRiggedMouth());
});

test('sculpted treatment is opaque ceramic with its own surface, not a skin tint', () => {
  const photo = new THREE.MeshStandardMaterial({ name: 'ConclaviaMale.body', map: new THREE.Texture() });
  const cast = photo.clone();
  finishRiggedMaterial(photo, false, { value: 0 }, 'textured');
  finishRiggedMaterial(cast, false, { value: 0 }, 'sculpted');
  expect(photo.map).not.toBeNull(); expect(photo.bumpMap).toBe(photo.map);
  expect(cast.map).toBeNull(); expect(cast.bumpMap).toBeNull();
  expect(cast.roughness).toBeGreaterThan(.9);
  expect(cast.customProgramCacheKey()).not.toBe(photo.customProgramCacheKey());
  photo.map?.dispose(); photo.dispose(); cast.dispose();
});

// GLB float32 quaternions are not exactly unit length. Three.angleTo assumes
// normalized operands: identical Spine2 bytes otherwise report a false angle
// (male .000233336 rad; female .000691113 rad). Keep the angular tolerance,
// normalize copies, and additionally demand exact spine components at rest.
const orientationDistance = (a: THREE.Quaternion, b: THREE.Quaternion) =>
  a.clone().normalize().angleTo(b.clone().normalize());

for (const female of [false, true]) test(`local waiting and finger follow-through stay bounded in actual ${female ? 'female' : 'male'} rig`, async () => {
  const rig = createRiggedAvatar(await loadGeometryOnlyAvatar(female));
  rig.update({ gesture: 'rest' }, 1, 0);
  const spine = rig.bones.get('Spine2')!, forearm = rig.bones.get('RightForeArm')!;
  const baselineSpine = spine.quaternion.clone(), baselineForearm = forearm.quaternion.clone();
  rig.update({ gesture: 'rest' }, 23.2, 1 / 60);
  expect(spine.quaternion.toArray()).toEqual(baselineSpine.toArray());
  expect(orientationDistance(forearm.quaternion, baselineForearm)).toBeGreaterThan(.025);
  rig.update({ gesture: 'rest' }, 25, 1 / 60);
  expect(orientationDistance(forearm.quaternion, baselineForearm)).toBeLessThan(1e-6);
  for (let i = 0; i < 12; i++) rig.update({ gesture: 'hand_raise' }, 1, 1 / 60);
  const fingers = [...rig.bones.entries()].filter(([name]) => /^LeftHand(?:Index|Middle|Ring|Pinky|Thumb)[123]$/u.test(name));
  const samples = fingers.map(([, bone]) => bone.quaternion.clone());
  for (let i = 0; i < 300; i++) rig.update({ gesture: 'hand_raise' }, 1, 0);
  fingers.forEach(([, bone], index) => expect(orientationDistance(bone.quaternion, samples[index])).toBeLessThan(1e-6));
  rig.update({ gesture: 'rest' }, 23.2, 1 / 60, true);
  expect(orientationDistance(forearm.quaternion, baselineForearm)).toBeLessThan(1e-6);
  rig.dispose();
});

test('failed 3D configuration retries only after an explicit successful change', async ({ page }) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/);
  await page.context().addCookies([{ name: 'conclavia_locale', value: 'en', url: 'http://127.0.0.1:3101' }]);
  // Establish the starting configuration before injecting a failure. Saved
  // profiles and StrictMode may otherwise consume a one-shot route on an
  // aborted mount, letting the live renderer receive a successful response.
  await page.goto('/avatar/test');
  await page.getByLabel('Avatar style', { exact: true }).selectOption('editorial');
  await page.getByLabel('Avatar appearance').selectOption('business_clay');
  await expect(page.locator('[data-design="rigged-3d"]')).toHaveCount(0);
  let maleRequests = 0;
  let failMale = true;
  await page.route('**/avatars/rigged-v1/male.glb', async route => {
    maleRequests++;
    if (failMale) await route.fulfill({ status: 503, body: 'Deliberate model failure' });
    else await route.continue();
  });
  await page.getByLabel('Avatar style', { exact: true }).selectOption('stylized_3d');
  await expect(page.locator('[data-design="rigged-3d"]')).toHaveAttribute('data-renderer', 'fallback-2d');
  const attemptsAtFallback = maleRequests;
  expect(attemptsAtFallback).toBeGreaterThan(0);
  await page.waitForTimeout(350);
  expect(maleRequests).toBe(attemptsAtFallback);
  await page.getByLabel('Avatar appearance').selectOption('business_clay_female');
  await expect(page.getByTestId('avatar-3d-canvas')).toHaveAttribute('data-renderer-ready', 'true');
  failMale = false;
  await page.getByLabel('Avatar appearance').selectOption('business_clay');
  await expect(page.getByTestId('avatar-3d-canvas')).toHaveAttribute('data-renderer-ready', 'true');
  expect(maleRequests).toBeGreaterThan(attemptsAtFallback);
});
