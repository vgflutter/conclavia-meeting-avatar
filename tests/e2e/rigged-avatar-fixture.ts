import { readFile } from "node:fs/promises";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** Real mesh/skin/morph/animation bytes. Only texture decoding is omitted in Node. */
export async function loadGeometryOnlyAvatar(female: boolean) {
  const original = await readFile(`public/avatars/rigged-v1/${female ? "female" : "male"}.glb`);
  const jsonSize = original.readUInt32LE(12);
  const json = JSON.parse(original.toString("utf8", 20, 20 + jsonSize));
  json.images = []; json.textures = []; json.materials = [];
  delete json.extensionsUsed; delete json.extensionsRequired;
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  const text = Buffer.from(JSON.stringify(json));
  const padding = (4 - text.length % 4) % 4;
  const data = Buffer.concat([text, Buffer.alloc(padding, 32)]);
  const bin = original.subarray(20 + jsonSize);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + data.length + bin.length, 8);
  header.writeUInt32LE(data.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const bytes = Uint8Array.from(Buffer.concat([header, data, bin]));
  return new GLTFLoader().parseAsync(bytes.buffer, "");
}
