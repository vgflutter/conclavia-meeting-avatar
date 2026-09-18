import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/);
  await page.context().addCookies([{ name: "conclavia_locale", value: "en", url: "http://127.0.0.1:3101" }]);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("illustrated pair: both previews remain drafts, with lightweight art and scoped face clips", async ({ page, request }, testInfo) => {
  const before = (await (await request.get("/api/avatar")).json()).profile;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const speechCalls: string[] = [];
  page.on("request", req => { if (req.url().endsWith("/speech")) speechCalls.push(req.url()); });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/avatar/test");
  const pictures: Array<{ label: string; svg: string }> = [];
  for (const [appearance, label] of [["business_clay", "Maschile"], ["business_clay_female", "Femminile"]]) {
    await page.getByLabel("Avatar appearance").selectOption(appearance);
    const svg = page.locator("svg[data-appearance]");
    await expect(svg).toHaveAttribute("data-design", "editorial-comic");
    await expect(svg).toHaveAttribute("data-appearance", appearance);
    await expect(svg.locator("filter, radialGradient, image, foreignObject")).toHaveCount(0);
    await expect(svg.locator('g[class*="glasses"]')).toHaveCount(appearance === "business_clay" ? 1 : 0);
    await expect(svg.locator('[class*="cheekTint"], [class*="friendlyBlush"]')).toHaveCount(0);
    // The new portrait has an adult head/shoulder ratio, not the former large head.
    const proportions = await svg.evaluate(node => {
      const head = node.querySelector('[class*="avatarHead"]')!.getBoundingClientRect();
      const left = node.querySelector('[class*="leftArm"]')!.getBoundingClientRect();
      const right = node.querySelector('[class*="rightArm"]')!.getBoundingClientRect();
      return head.width / (right.right - left.left);
    });
    expect(proportions).toBeGreaterThan(0.32);
    expect(proportions).toBeLessThan(0.42);
    await expect(page.locator("[data-avatar-stage]")).toHaveCSS("background-color", "rgb(242, 239, 230)");
    const clip = await svg.locator("clipPath").getAttribute("id");
    await expect(svg.locator("g[clip-path]")).toHaveAttribute("clip-path", `url(#${clip})`);
    for (const gesture of ["rest", "hand_raise"]) {
      await svg.evaluate((node, pose) => { node.dataset.gesture = pose; }, gesture);
      await expect(svg.locator('g[class*="raisedHand"]')).toHaveCSS("opacity", gesture === "rest" ? "0" : "1");
      // Inspect the union of the real jacket paths, in SVG coordinates. The
      // shoulder profile must slope smoothly outwards, without the old cap's
      // upward notch, and the sleeve must meet the torso without a gap.
      const shoulders = await svg.evaluate((node, pose) => {
        const names = ["suitBack", "leftArm", pose === "rest" ? "rightArm" : "raisedSleeve"];
        const paths = names.map(name => node.querySelector<SVGGeometryElement>(`[class*="${name}"]`)!);
        const filled = (x: number, y: number) => paths.some(path => path.isPointInFill(new DOMPoint(x, y)));
        const profile = (from: number, to: number) => {
          const heights: number[] = [];
          for (let x = from; x <= to; x += 2) {
            let y = 448;
            while (y < 620 && !filled(x, y)) y++;
            heights.push(y);
          }
          return heights;
        };
        let gap = false;
        for (const x of [196, 200, 204, 208, 212, 470, 474, 478, 482, 486, 530, 534, 538]) {
          let entered = false;
          for (let y = 448; y <= 570; y++) {
            if (filled(x, y)) entered = true;
            else if (entered) gap = true;
          }
        }
        return { left: profile(100, 218), right: profile(462, 580), gap };
      }, gesture);
      expect(shoulders.gap).toBe(false);
      expect(shoulders.left.every((y, i, ys) => i === 0 || y <= ys[i - 1] + 1)).toBe(true);
      expect(shoulders.right.every((y, i, ys) => i === 0 || y >= ys[i - 1] - 1)).toBe(true);
      pictures.push({ label: `${label} · ${gesture === "rest" ? "Riposo" : "Mano alzata"}`, svg: await svg.evaluate(node => node.outerHTML) });
    }
  }
  expect((await (await request.get("/api/avatar")).json()).profile).toEqual(before);
  expect(speechCalls).toHaveLength(0);
  expect(errors).toHaveLength(0);
  // This board uses the real rendered SVG and styles, not a generated mockup.
  await page.evaluate(pictures => {
    const board = document.createElement("section"); board.id = "illustrated-pair";
    Object.assign(board.style, { position: "relative", display: "grid", gridTemplateColumns: "repeat(2, 540px)", gap: "24px", padding: "32px", background: "#f8faf7", color: "#263f36", width: "1168px" });
    pictures.forEach((picture, index) => {
      const cell = document.createElement("div");
      Object.assign(cell.style, { background: "#f2efe6", borderRadius: "24px", padding: "24px" });
      const title = document.createElement("p"); title.textContent = picture.label;
      Object.assign(title.style, { fontSize: "20px", fontWeight: "600", marginBottom: "16px" });
      const wrapper = document.createElement("div"); wrapper.innerHTML = picture.svg;
      const svg = wrapper.querySelector("svg")!;
      // The snapshots came from one React mount; give the board clones own IDs.
      const clip = svg.querySelector("clipPath")!; clip.id = `board-face-${index}`;
      svg.querySelector("g[clip-path]")!.setAttribute("clip-path", `url(#${clip.id})`);
      svg.style.cssText = "height:550px;width:100%;--jaw-open:0";
      svg.dataset.mood = "friendly"; svg.dataset.viseme = "rest";
      cell.append(title, wrapper); board.append(cell);
    });
    for (const child of Array.from(document.body.children)) if (child instanceof HTMLElement) child.style.display = "none";
    document.body.append(board);
  }, pictures);
  await page.locator("#illustrated-pair").screenshot({ path: testInfo.outputPath("illustrated-pair.png") });
});

test("illustrated male rig retains all 64 expression, mouth and hand combinations", async ({ page }) => {
  await page.goto("/avatar/test");
  await page.getByLabel("Avatar appearance").selectOption("business_clay");
  const avatar = page.locator("svg[data-appearance]");
  const shapes = ["rest", "mbp", "fv", "a", "e", "o", "u", "consonant"];
  const classes = ["mouthRest", "mouthMbp", "mouthFv", "mouthA", "mouthE", "mouthO", "mouthU", "mouthConsonant"];
  for (const mood of ["neutral", "friendly", "focused", "confident"]) for (const gesture of ["rest", "hand_raise"]) for (const viseme of shapes) {
    await avatar.evaluate((node, pose) => {
      node.dataset.mood = pose.mood; node.dataset.gesture = pose.gesture; node.dataset.viseme = pose.viseme;
      node.style.setProperty("--jaw-open", pose.viseme === "rest" ? "0" : "0.8");
    }, { mood, gesture, viseme });
    const visible = await avatar.locator('g[class*="mouthShape"]').evaluateAll(nodes => nodes
      .filter(node => Number(getComputedStyle(node).opacity) > .9).map(node => node.getAttribute("class")));
    expect(visible).toHaveLength(1);
    expect(visible[0]).toContain(classes[shapes.indexOf(viseme)]);
    await expect(avatar.locator('g[class*="raisedHand"]')).toHaveCSS("opacity", gesture === "rest" ? "0" : "1");
    await expect(avatar.getByTestId("avatar-resting-arm")).toHaveCSS("opacity", gesture === "rest" ? "1" : "0");
    const mouthWithinFace = await avatar.evaluate(node => {
      const head = node.querySelector('[class*="avatarHead"]')!.getBoundingClientRect();
      const shape = Array.from(node.querySelectorAll('[class*="mouthShape"]'))
        .find(el => Number(getComputedStyle(el).opacity) > .9)!;
      const mouth = shape.getBoundingClientRect();
      return mouth.left > head.left && mouth.right < head.right && mouth.top > head.top && mouth.bottom < head.bottom;
    });
    expect(mouthWithinFace).toBe(true);
    // The global reduced-motion rule uses 0.01ms rather than literal zero.
    const duration = await avatar.locator('g[class*="mouthRig"]').evaluate(node =>
      Math.max(...getComputedStyle(node).transitionDuration.split(",").map(Number.parseFloat)));
    expect(duration).toBeLessThanOrEqual(0.00001);
  }
});
