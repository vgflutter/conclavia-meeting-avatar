#!/usr/bin/env node

// Render the same GLB from every cardinal angle in real Chrome. This is the
// mandatory human-readable complement to the structural avatar audit: a file
// may be valid glTF while still losing MetaHuman materials or facing sideways.

const { createServer } = require("node:http");
const { createReadStream, existsSync } = require("node:fs");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
const { extname, join, resolve } = require("node:path");
const { spawn } = require("node:child_process");
const { tmpdir } = require("node:os");
const WebSocket = require("ws");

const bundleDirectory = resolve(process.argv[2] || "");
const outputDirectory = resolve(process.argv[3] || join(bundleDirectory, "visual-review"));
const chromePath = process.env.CHROME_PATH
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

if (!existsSync(join(bundleDirectory, "model.glb"))) {
  throw new Error(`model.glb non trovato in ${bundleDirectory}`);
}

const contentTypes = {
  ".glb": "model/gltf-binary",
  ".js": "text/javascript; charset=utf-8",
};

const page = `<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#123b35}
canvas{display:block;width:100%;height:100%}
#status{position:fixed;left:16px;bottom:12px;color:#fff;background:#06120fcc;padding:8px 12px;border-radius:8px;font:14px system-ui}
</style><script type="importmap">{"imports":{"three":"/three.module.js","three/addons/":"/"}}</script></head><body><div id="status">loading</div><script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/GLTFLoader.js";
const params = new URLSearchParams(location.search);
const rotation = Number(params.get("rotation") || 0);
const unlit = params.get("unlit") === "1";
const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#123b35");
scene.add(new THREE.HemisphereLight(0xf4f7ff,0x20332e,1.15));
const key = new THREE.DirectionalLight(0xffe8d6,2.0); key.position.set(2.2,3.2,2.8); scene.add(key);
const fill = new THREE.DirectionalLight(0xb8d7ff,0.55); fill.position.set(-2.3,1.8,2); scene.add(fill);
const rim = new THREE.DirectionalLight(0x76aaff,0.4); rim.position.set(-2,2,-2); scene.add(rim);
const camera = new THREE.PerspectiveCamera(34,innerWidth/innerHeight,0.01,100);
new GLTFLoader().load("/model.glb",({scene:root})=>{
  root.rotation.y = THREE.MathUtils.degToRad(rotation);
  scene.add(root);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const target = new THREE.Vector3(center.x, box.min.y + size.y * 0.81, center.z);
  const distance = Math.max(size.y * 0.64, size.x * 1.15);
  camera.position.set(target.x, target.y + size.y * 0.025, target.z + distance);
  camera.lookAt(target);
  root.traverse((node)=>{if(node.isMesh){
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const reviewed = materials.map((material)=>unlit
      ? new THREE.MeshBasicMaterial({map:material.map,color:material.color,side:THREE.FrontSide})
      : material);
    for(const material of reviewed){material.side=THREE.FrontSide;material.needsUpdate=true;}
    node.material=Array.isArray(node.material)?reviewed:reviewed[0];
  }});
  document.querySelector("#status").textContent = "rotation="+rotation+" unlit="+unlit+" bbox="+size.toArray().map(v=>v.toFixed(2)).join("×");
  document.body.dataset.ready="true";
  renderer.render(scene,camera);
},undefined,(error)=>{document.querySelector("#status").textContent=String(error);});
addEventListener("resize",()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.render(scene,camera)});
</script></body></html>`;

const routes = new Map([
  ["/model.glb", join(bundleDirectory, "model.glb")],
  ["/three.module.js", resolve("node_modules/three/build/three.module.js")],
  ["/three.core.js", resolve("node_modules/three/build/three.core.js")],
  ["/GLTFLoader.js", resolve("node_modules/three/examples/jsm/loaders/GLTFLoader.js")],
  ["/utils/BufferGeometryUtils.js", resolve("node_modules/three/examples/jsm/utils/BufferGeometryUtils.js")],
  ["/utils/SkeletonUtils.js", resolve("node_modules/three/examples/jsm/utils/SkeletonUtils.js")],
]);

const server = createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  if (pathname === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(page);
    return;
  }
  const path = routes.get(pathname);
  if (!path) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { "content-type": contentTypes[extname(path)] || "application/octet-stream" });
  createReadStream(path).pipe(response);
});

const delay = (milliseconds) => new Promise((accept) => setTimeout(accept, milliseconds));

async function runChrome(url, screenshot, debuggingPort) {
  const userDataDirectory = await mkdtemp(join(tmpdir(), "conclavia-avatar-review-"));
  const chrome = spawn(chromePath, [
    "--headless=new", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox",
    "--hide-scrollbars", "--window-size=1280,720", "--force-device-scale-factor=1",
    `--remote-debugging-port=${debuggingPort}`, `--user-data-dir=${userDataDirectory}`, url,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  try {
    let targets;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        targets = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`).then((response) => response.json());
        if (targets.some((target) => target.type === "page")) break;
      } catch {}
      await delay(100);
    }
    const pageTarget = targets?.find((target) => target.type === "page");
    if (!pageTarget?.webSocketDebuggerUrl) throw new Error("Chrome DevTools target non disponibile");
    const socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((accept, reject) => { socket.once("open", accept); socket.once("error", reject); });
    let nextId = 0;
    const pending = new Map();
    const diagnostics = [];
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString("utf8"));
      if (message.id && pending.has(message.id)) {
        const entry = pending.get(message.id);
        pending.delete(message.id);
        message.error ? entry.reject(new Error(message.error.message)) : entry.accept(message.result);
        return;
      }
      if (message.method === "Runtime.exceptionThrown") diagnostics.push(message.params.exceptionDetails.text);
      if (message.method === "Log.entryAdded") diagnostics.push(message.params.entry.text);
      if (message.method === "Network.loadingFailed") diagnostics.push(message.params.errorText);
      if (message.method === "Network.responseReceived" && message.params.response.status >= 400) {
        diagnostics.push(`${message.params.response.status} ${message.params.response.url}`);
      }
    });
    const command = (method, params = {}) => new Promise((accept, reject) => {
      const id = ++nextId;
      pending.set(id, { accept, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    await command("Runtime.enable");
    await command("Log.enable");
    await command("Network.enable");
    await command("Page.reload", { ignoreCache: true });
    let ready = false;
    let probe;
    for (let attempt = 0; attempt < 300; attempt += 1) {
      probe = await command("Runtime.evaluate", {
        expression: "({ready: document.body.dataset.ready === 'true', status: document.querySelector('#status')?.textContent, html: document.documentElement.innerHTML.slice(0, 200)})",
        returnByValue: true,
      });
      if (probe.result.value.ready === true) { ready = true; break; }
      await delay(100);
    }
    if (!ready) throw new Error(`Il GLB non è diventato pronto entro 30 secondi: ${JSON.stringify(probe?.result?.value)} ${diagnostics.join(" | ")}`);
    await delay(500);
    const capture = await command("Page.captureScreenshot", { format: "png", fromSurface: true });
    await writeFile(screenshot, Buffer.from(capture.data, "base64"));
    socket.close();
  } finally {
    chrome.kill("SIGTERM");
    await delay(200);
    await rm(userDataDirectory, { recursive: true, force: true });
  }
}

server.listen(0, "127.0.0.1", async () => {
  try {
    await mkdir(outputDirectory, { recursive: true });
    const { port } = server.address();
    let index = 0;
    for (const rotation of [0, 90, -90, 180]) {
      const suffix = String(rotation).replace("-", "minus-");
      await runChrome(
        `http://127.0.0.1:${port}/?rotation=${rotation}&unlit=${process.env.CONCLAVIA_WEB_AVATAR_REVIEW_UNLIT === "1" ? "1" : "0"}`,
        join(outputDirectory, `rotation-${suffix}.png`),
        9430 + index,
      );
      index += 1;
    }
    console.log(outputDirectory);
  } finally {
    server.close();
  }
});
