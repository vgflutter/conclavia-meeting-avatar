// CDaily / "Primo piano". Original notes and synthesized instruments, no samples.
// swiftc -O scripts/tg/compose-clock-score.swift -o /tmp/cdaily-clock-score
// /tmp/cdaily-clock-score PRIVATE_LAUNCH_VOICE_DIR DURATION
import Foundation

let args = CommandLine.arguments
guard args.count == 3, let duration = Double(args[2]), duration > 4, duration < 120 else {
    fatalError("Usage: compose-clock-score PRIVATE_LAUNCH_VOICE_DIR DURATION (4–120 s)")
}
let root = URL(fileURLWithPath: args[1]).standardizedFileURL
let cache = URL(fileURLWithPath: ".tg-artifacts/.launch-promo").standardizedFileURL
guard root.path.hasPrefix(cache.path + "/") else { fatalError("Use a private launch voice directory") }
try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
let rate = 48_000.0, beat = 0.6 // 100 BPM; 16 bars, followed by a short decay.
let frameCount = Int(duration * rate)
var left = [Double](repeating: 0, count: frameCount)
var right = left
var randomState: UInt64 = 0xcda11_20261021
func random() -> Double {
    randomState = randomState &* 6364136223846793005 &+ 1442695040888963407
    return Double(randomState >> 11) / 9007199254740992.0
}
func noise() -> Double { random() * 2 - 1 }
func frequency(_ midi: Int) -> Double { 440 * pow(2, Double(midi - 69) / 12) }
let tau = Double.pi * 2
struct Note: Codable {
    let instrument: String
    let beat: Double
    let midi: Int
    let length: Double
    let gain: Double
    let pan: Double
}
var notes: [Note] = []
func note(_ instrument: String, _ when: Double, _ midi: Int, _ length: Double,
          _ gain: Double, _ pan: Double = 0) {
    notes.append(Note(instrument: instrument, beat: when, midi: midi,
                      length: length, gain: gain, pan: pan))
}

// E6/9 – B/D# – C#m9 – Amaj9; the second phrase moves through F#m7 and Bsus.
// Sparse midrange leaves space for narration; a four-note phrase appears in
// the opening and returns in an altered closing cadence, rather than looping.
let harmony = [
    [52,59,63,66,73], [51,59,63,66,68], [49,56,59,63,68], [45,56,59,61,64],
    [52,59,63,66,73], [54,57,61,64,68], [47,57,61,64,66], [47,57,59,63,66],
    [49,56,59,63,68], [45,56,59,61,64], [52,59,63,66,73], [51,59,63,66,68],
    [54,57,61,64,68], [47,57,61,64,66], [52,59,63,66,71], [52,59,63,66,68]
]
for bar in 0..<16 {
    let at = Double(bar * 4), chord = harmony[bar]
    // Electric keys: connected voicings with small non-identical strums.
    for (j, pitch) in chord.dropFirst().enumerated() {
        note("keys", at + 0.055 + Double(j) * 0.013, pitch,
             bar == 15 ? 2.8 : 1.7, 0.075 + Double(j % 2) * 0.009, Double(j - 1) * 0.14)
        if bar != 15 && bar % 4 != 3 {
            note("keys", at + 2.55 + Double(j) * 0.011, pitch, 0.8, 0.043, Double(1 - j) * 0.12)
        }
    }
    note("pad", at, chord[1], 2.55, 0.025, -0.40)
    note("pad", at + 0.06, chord[3], 2.48, 0.024, 0.42)
    note("bass", at + 0.015, chord[0] - 12, 0.88, 0.145)
    if bar < 15 {
        note("bass", at + 1.75, chord[0] - 12, 0.23, 0.074)
        note("bass", at + 2.5, chord[0] - 5, 0.50, 0.095)
        if bar % 4 == 2 { note("bass", at + 3.5, chord[0] - 10, 0.20, 0.072) }
    }
    // Clock impression from a quiet pulse, not a sampled ticking clock.
    for pulse in 0..<4 where bar < 15 {
        note("pulse", at + Double(pulse), 76, 0.09, pulse % 2 == 0 ? 0.031 : 0.023,
             pulse % 2 == 0 ? -0.22 : 0.22)
    }
    // Understated groove enters after the opening; small fills only at phrase ends.
    if bar > 1 && bar < 15 {
        for position in [0.0, 2.0] { note("kick", at + position, 36, 0.25, 0.12) }
        for position in [1.0, 3.0] { note("rim", at + position + 0.014, 42, 0.12, 0.037, 0.14) }
        for eighth in 0..<8 {
            let shift = eighth % 2 == 0 ? 0 : 0.017
            note("hat", at + Double(eighth) * 0.5 + shift, 84, 0.055,
                 eighth % 2 == 0 ? 0.014 : 0.023, eighth % 2 == 0 ? -0.28 : 0.30)
        }
    }
    if [3, 7, 11, 14].contains(bar) {
        for (j, pitch) in [chord[2]+12, chord[3]+12, chord[4]+12].enumerated() {
            note("pluck", at + 2.75 + Double(j) * 0.5, pitch, 0.48, 0.030, Double(j - 1) * 0.32)
        }
    }
}
// Lead phrase: G# – F# – B – E, with a different answer. Long gaps under speech.
for (when, pitch, length, gain) in [
    (0.18, 80, 0.46, 0.095), (0.93, 78, 0.35, 0.077),
    (1.68, 83, 0.63, 0.090), (3.18, 76, 1.10, 0.079),
    (6.18, 75, 0.43, 0.044), (6.93, 78, 0.55, 0.040),
    (23.25, 80, 0.52, 0.036), (24.0, 78, 0.46, 0.032),
    (39.25, 83, 0.48, 0.036), (40.0, 80, 0.62, 0.036),
    (56.18, 80, 0.46, 0.055), (56.93, 78, 0.34, 0.050),
    (57.68, 83, 0.63, 0.058), (59.18, 78, 0.38, 0.060),
    (60.0, 76, 1.75, 0.085)
] { note("lead", when, pitch, length, gain, -0.10) }

for event in notes {
    let start = event.beat * beat
    let naturalLength = event.length + (event.instrument == "keys" ? 1.2 : 0.45)
    let first = Int(start * rate), count = min(Int(naturalLength * rate), frameCount - first)
    if count <= 0 { continue }
    let f = frequency(event.midi), phase = random() * tau
    let panL = sqrt((1 - event.pan) / 2), panR = sqrt((1 + event.pan) / 2)
    let velocity = event.gain * (0.97 + random() * 0.06)
    var previousNoise = 0.0
    for i in 0..<count {
        let t = Double(i) / rate, p = tau * f * t
        let release = exp(-max(0, t - event.length) * 13)
        var sample: Double = 0
        switch event.instrument {
        case "keys":
            let attack = min(1, t / 0.005)
            let fm = sin(p * 2.001 + phase) * 0.70 * exp(-t * 3.4)
            sample = (sin(p + fm) + 0.16 * sin(p * 2.002) * exp(-t * 2.2))
                * attack * exp(-t * 1.5) * release
        case "lead":
            let fm = sin(p * 2) * 0.62 * exp(-t * 3)
            sample = (sin(p + fm) + 0.10 * sin(p * 3.001))
                * min(1, t / 0.012) * exp(-t * 1.7) * release
        case "pluck":
            sample = (sin(p) + 0.24 * sin(p * 2.002) + 0.10 * sin(p * 3.001))
                * min(1, t / 0.004) * exp(-t * 5.2) * release
        case "pad":
            let swell = min(1, t / 0.35)
            sample = (sin(p + phase) * 0.70 + sin(p * 1.002 + phase) * 0.20
                      + sin(p * 2.001) * 0.10) * swell * release
        case "bass":
            sample = (sin(p) + 0.19 * sin(p * 2) + 0.065 * sin(p * 3))
                * min(1, t / 0.009) * exp(-t * 1.3) * release
        case "pulse":
            sample = sin(p * 0.5) * exp(-t * 67) * min(1, t / 0.0015)
        case "kick":
            let phaseSweep = tau * (44 * t + 36 * (1 - exp(-t * 30)) / 30)
            sample = sin(phaseSweep) * exp(-t * 15) * min(1, t / 0.002)
        case "rim":
            sample = (sin(tau * 1820 * t) * 0.50 + sin(tau * 1240 * t) * 0.30
                      + noise() * 0.15) * exp(-t * 70) * min(1, t / 0.001)
        case "hat":
            let n = noise(), high = n - previousNoise
            previousNoise = n
            sample = high * 0.36 * exp(-t * 94) * min(1, t / 0.001)
        default: break
        }
        left[first + i] += sample * velocity * panL
        right[first + i] += sample * velocity * panR
    }
}

// Short, filtered cross echoes. No sample library, convolution IR or downloads.
for (delay, gain) in [(0.15, 0.12), (0.225, 0.09), (0.375, 0.055)] {
    let d = Int(delay * rate)
    var wetL = 0.0, wetR = 0.0
    for i in d..<frameCount {
        wetL += 0.18 * (right[i - d] - wetL)
        wetR += 0.18 * (left[i - d] - wetR)
        left[i] += wetL * gain
        right[i] += wetR * gain
    }
}
let peak = max(left.map { abs($0) }.max()!, right.map { abs($0) }.max()!)
var pcm = Data(capacity: frameCount * 4)
for i in 0..<frameCount {
    let t = Double(i) / rate
    let fade = min(1, t / 0.035) * pow(min(1, max(0, (duration - t) / 1.10)), 1.4)
    for value in [left[i], right[i]] {
        var sample = Int16((tanh(value / peak * 1.05) * 0.85 * fade * 32767).rounded()).littleEndian
        withUnsafeBytes(of: &sample) { pcm.append(contentsOf: $0) }
    }
}
func u32(_ v: UInt32) -> Data { var v = v.littleEndian; return withUnsafeBytes(of: &v) { Data($0) } }
func u16(_ v: UInt16) -> Data { var v = v.littleEndian; return withUnsafeBytes(of: &v) { Data($0) } }
var wav = Data("RIFF".utf8)
wav.append(u32(UInt32(36 + pcm.count))); wav.append(Data("WAVEfmt ".utf8))
wav.append(u32(16)); wav.append(u16(1)); wav.append(u16(2)); wav.append(u32(48000))
wav.append(u32(192000)); wav.append(u16(4)); wav.append(u16(16))
wav.append(Data("data".utf8)); wav.append(u32(UInt32(pcm.count))); wav.append(pcm)
try wav.write(to: root.appendingPathComponent("original-score-clock.wav"), options: .atomic)
let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
try encoder.encode(notes).write(to: root.appendingPathComponent("clock-score-notes.json"), options: .atomic)
print("Original local score: \(duration) s, \(notes.count) notes, 100 BPM, E major, stereo 48 kHz. No samples or provider calls.")
