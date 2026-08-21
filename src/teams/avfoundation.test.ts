import assert from "node:assert/strict";
import test from "node:test";

import {
  findAvfoundationAudioDevice,
  parseAvfoundationAudioDevices,
} from "./avfoundation.js";

const sampleOutput = `
[AVFoundation indev @ 0x123] AVFoundation video devices:
[AVFoundation indev @ 0x123] [0] FaceTime HD Camera
[AVFoundation indev @ 0x123] [1] OBS Virtual Camera
[AVFoundation indev @ 0x123] AVFoundation audio devices:
[AVFoundation indev @ 0x123] [0] iPhone Microphone
[AVFoundation indev @ 0x123] [3] Microsoft Teams Audio
[AVFoundation indev @ 0x123] [4] BlackHole 16ch
`;

void test("parses only AVFoundation audio devices", () => {
  assert.deepEqual(parseAvfoundationAudioDevices(sampleOutput), [
    { index: 0, name: "iPhone Microphone" },
    { index: 3, name: "Microsoft Teams Audio" },
    { index: 4, name: "BlackHole 16ch" },
  ]);
});

void test("finds an audio device without depending on its numeric index", () => {
  const devices = parseAvfoundationAudioDevices(sampleOutput);
  assert.deepEqual(findAvfoundationAudioDevice(devices, "blackhole 16CH"), {
    index: 4,
    name: "BlackHole 16ch",
  });
  assert.equal(findAvfoundationAudioDevice(devices, "BlackHole 2ch"), null);
});
