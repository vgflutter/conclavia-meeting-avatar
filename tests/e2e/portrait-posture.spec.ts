import { expect, test } from "@playwright/test";
import { advancePortraitGesture, advancePortraitPosture, initialPortraitPosture, portraitBodyFrame, portraitBodyOffset } from "../../src/lib/portrait-motion";

test("posture leads with the shoulder, follows with the chest and settles consistently at 15/60/120 Hz", () => {
  const sample = (hz: number, duration: number) => {
    let posture = initialPortraitPosture(0), hand = { position: 0, velocity: 0 };
    for (let i = 0; i < hz * duration; i++) {
      posture = advancePortraitPosture(posture, 1, 0, 1 / hz, false);
      hand = advancePortraitGesture(hand, 1, 1 / hz);
    }
    return { posture, hand };
  };
  const moving = sample(60, .2);
  expect(moving.posture.shoulder.position).toBeGreaterThan(moving.hand.position);
  expect(moving.posture.torso.position).toBeLessThan(moving.hand.position);
  for (const hz of [15, 60, 120]) {
    const state = sample(hz, 1).posture;
    expect(state.shoulder.position).toBeCloseTo(sample(60, 1).posture.shoulder.position, 5);
    expect(state.torso.position).toBeCloseTo(sample(60, 1).posture.torso.position, 5);
  }
  let state = moving.posture;
  const reversed = advancePortraitPosture(state, 0, 0, 1 / 60, false);
  expect(Math.abs(reversed.shoulder.position - state.shoulder.position)).toBeLessThan(.05);
  for (let i = 0; i < 180; i++) state = advancePortraitPosture(state, 0, 0, 1 / 60, false);
  expect(state).toEqual(initialPortraitPosture(0));
});

test("body skin pins the face and waist, lifts the shoulder and never folds or tears", () => {
  const body = { lean: .04, shoulder: .025, breath: .007 };
  for (const x of [0, .25, .5, .75, 1]) {
    for (const y of [.1, .3, .5, .55, 1]) expect(portraitBodyOffset(x, y, body).map(n => Math.abs(n))).toEqual([0, 0]);
  }
  expect(portraitBodyOffset(.22, .65, body)[1]).toBeLessThan(-.02);
  expect(Math.abs(portraitBodyOffset(.78, .65, body)[1])).toBeLessThan(.01);
  // Sample the field's local area scale at its maximum intended displacement.
  // A folded (non-positive) Jacobian would visibly reverse or tear the jacket.
  const step = .001;
  for (let x = 0; x <= 1; x += .025) for (let y = .55; y < 1; y += .025) {
    const p = portraitBodyOffset(x, y, body);
    const dx = portraitBodyOffset(x + step, y, body), dy = portraitBodyOffset(x, y + step, body);
    const determinant = (1 + (dx[0] - p[0]) / step) * (1 + (dy[1] - p[1]) / step)
      - (dy[0] - p[0]) / step * (dx[1] - p[1]) / step;
    expect(determinant).toBeGreaterThan(.5);
    expect(determinant).toBeLessThan(1.5);
  }
});

test("posture smooths speech energy and reduced motion keeps a static intentional pose", () => {
  const state = advancePortraitPosture(initialPortraitPosture(0), 0, .35, 1 / 60, false);
  expect(state.speech).toBeGreaterThan(0);
  expect(state.speech).toBeLessThan(.1);
  const stopped = advancePortraitPosture(state, 0, 0, 1 / 60, false);
  expect(stopped.speech).toBeGreaterThan(0);
  expect(stopped.speech).toBeLessThan(state.speech);
  const reduced = advancePortraitPosture(state, 1, .8, 0, true);
  expect(reduced).toEqual(initialPortraitPosture(1));
  expect(portraitBodyFrame(reduced, 1, .003, true)).toEqual(portraitBodyFrame(reduced, 9, -.003, true));
  expect(portraitBodyFrame(reduced, 1, .003, true).breath).toBe(0);
});

for (const appearance of ["business_clay", "business_clay_female"]) {
  test(`shoulder pixels move while the face stays stable: ${appearance}`, async ({ page }, info) => {
    await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto("/avatar/test");
    await page.getByLabel("Avatar style", { exact: true }).selectOption("portrait_2_5d");
    await page.getByLabel("Avatar appearance").selectOption(appearance);
    const canvas = page.getByTestId("portrait-canvas");
    await expect(canvas).toHaveAttribute("data-renderer-ready", "true");
    const patch = (region: "shoulder" | "face") => canvas.locator("canvas").evaluate((c: HTMLCanvasElement, region) => {
      const side = Math.min(c.width, c.height), ox = (c.width - side) / 2, oy = (c.height - side) / 2;
      // Outer clavicle, away from the separate forearm, versus central face.
      const box = region === "shoulder" ? [.23, .56, .12, .12] : [.39, .15, .22, .36];
      const copy = document.createElement("canvas"); copy.width = Math.round(box[2] * side); copy.height = Math.round(box[3] * side);
      copy.getContext("2d")!.drawImage(c, Math.round(ox + box[0] * side), Math.round(oy + box[1] * side), copy.width, copy.height, 0, 0, copy.width, copy.height);
      return copy.toDataURL();
    }, region);
    const shoulder = await patch("shoulder"), face = await patch("face");
    await canvas.screenshot({ path: info.outputPath("rest.png") });
    await page.getByRole("button", { name: "Raise / lower hand" }).click();
    await expect(canvas).toHaveAttribute("data-hand-raised", "true");
    await expect(canvas).toHaveAttribute("data-shoulder-lift", "0.02200");
    expect(await patch("shoulder")).not.toBe(shoulder);
    expect(await patch("face")).toBe(face);
    await canvas.screenshot({ path: info.outputPath("raised.png") });
    await page.getByRole("button", { name: "Raise / lower hand" }).click();
    await expect(canvas).toHaveAttribute("data-shoulder-lift", "0.00000");
    expect(await patch("shoulder")).toBe(shoulder);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect.poll(() => canvas.getAttribute("data-chest-breath")).not.toBe("0.00000");
  });
}
