"""Repair one verified splice in an isolated Daily pilot; never alter its parent.

Uses a 6 ms raised-cosine fade on each side of the known edit. No denoiser,
time shift, TTS, ASR, database or publication. Encoded video streams are copied.
"""
import argparse
import array
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import wave

parser = argparse.ArgumentParser()
parser.add_argument("--from-id", required=True)
parser.add_argument("--to-id", required=True)
parser.add_argument("--cue-text", required=True)
args = parser.parse_args()
for value in [args.from_id, args.to_id]:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}-it-pilot(?:-r[1-9]\d*)?", value):
        raise ValueError("Explicit named local pilot required")
if args.from_id == args.to_id:
    raise ValueError("Preserve the parent; choose a new candidate")
root = Path.cwd()
parent = root / "public/daily-launch/editions" / args.from_id
target = parent.parent / args.to_id
private = root / ".tg-artifacts/.launch-promo/editions"
private_target = private / args.to_id
if target.exists() or private_target.exists():
    raise ValueError("Candidate already exists; no overwrite")
m = json.loads((parent / "manifest.json").read_text())
if m.get("id") != args.from_id or not m.get("previewOnly") or m.get("duration") != 240:
    raise ValueError("Expected isolated four-minute pilot")
cues = [c for c in m["cues"] if c["text"] == args.cue_text]
if len(cues) != 1:
    raise ValueError("The splice must match exactly one measured cue")
at = cues[0]["start"]
if not 4 < at < m["duration"] - 4:
    raise ValueError("Repair must be outside intro music and closing")
target.mkdir()
private_target.mkdir(mode=0o700)
def run(*command):
    return subprocess.check_output(command).decode().strip()
def sha(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()
def repair(source, destination):
    with wave.open(str(source), "rb") as w:
        params = w.getparams()
        if params.sampwidth != 2 or params.comptype != "NONE":
            raise ValueError("Expected uncompressed PCM16 master")
        original = w.readframes(params.nframes)
    pcm = array.array("h")
    pcm.frombytes(original)
    before = pcm[:]
    boundary = round(at * params.framerate)
    frames = round(.006 * params.framerate)
    for j in range(frames):
        left = .5 * (1 + math.cos(math.pi * (j + 1) / frames))
        right = .5 * (1 - math.cos(math.pi * j / (frames - 1)))
        for ch in range(params.nchannels):
            li = (boundary - frames + j) * params.nchannels + ch
            ri = (boundary + j) * params.nchannels + ch
            pcm[li] = round(pcm[li] * left)
            pcm[ri] = round(pcm[ri] * right)
    start = (boundary - frames) * params.nchannels
    end = (boundary + frames) * params.nchannels
    assert pcm[:start] == before[:start] and pcm[end:] == before[end:]
    assert len(pcm) == len(before)
    def jump(a):
        return max(abs(a[boundary * params.nchannels + ch] - a[(boundary - 1) * params.nchannels + ch]) for ch in range(params.nchannels)) / 32768
    with wave.open(str(destination), "wb") as w:
        w.setparams(params)
        w.writeframes(pcm.tobytes())
    return {"sourceSha256": sha(source), "resultSha256": sha(destination),
            "rate": params.framerate, "channels": params.nchannels,
            "seconds": params.nframes / params.framerate,
            "windowStart": (boundary - frames) / params.framerate,
            "windowEnd": (boundary + frames) / params.framerate,
            "boundaryJumpBefore": jump(before), "boundaryJumpAfter": jump(pcm),
            "unchangedOutsideRepairWindow": True}
voice = repair(private / args.from_id / "voice.wav", private_target / "voice.wav")
master = repair(parent / "audio.wav", target / "audio.wav")
video_checks = {}
for name in ["landscape.mp4", "portrait.mp4"]:
    output = target / name
    run("ffmpeg", "-v", "error", "-i", str(parent / name), "-i", str(target / "audio.wav"),
        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac",
        "-b:a", "192k", "-ar", "48000", "-ac", "2", "-t", "240",
        "-map_metadata", "0", "-movflags", "+faststart", str(output))
    hashes = [run("ffmpeg", "-v", "error", "-i", str(p), "-map", "0:v:0",
                  "-c:v", "copy", "-f", "hash", "-hash", "sha256", "-")
              for p in [parent / name, output]]
    assert hashes[0] == hashes[1], "Video stream changed"
    run("ffmpeg", "-v", "error", "-i", str(output), "-f", "null", "-")
    seconds = float(run("ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", str(output)))
    assert abs(seconds - 240) < .001
    video_checks[name] = {"sha256": sha(output), "seconds": seconds,
                          "encodedVideoUnchanged": True, "fullDecode": "passed"}
for name in ["caption.txt", "script.txt", "captions.vtt", "cover-landscape.jpg", "cover-portrait.jpg"]:
    shutil.copyfile(parent / name, target / name)
report = {"parentId": args.from_id, "id": args.to_id, "atSeconds": at,
          "reportedByUser": "around 00:14, at the first news item",
          "method": "raised-cosine, 6 ms each side of the verified splice",
          "voice": voice, "master": master, "videos": video_checks,
          "timeShift": 0, "providerCalls": 0, "editorialContentChanged": False,
          "newsSelectionStillNeedsRevision": True, "previewOnly": True}
m.update(id=args.to_id, revision=int(args.to_id.rsplit("-r", 1)[-1]),
         audioRepair=report)
m["mediaVersion"] = hashlib.sha256(json.dumps(m, sort_keys=True).encode()).hexdigest()[:12]
(private_target / "audio-repair.json").write_text(json.dumps(report, indent=2) + "\n")
(target / "manifest.json").write_text(json.dumps(m, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"id": args.to_id, "mediaVersion": m["mediaVersion"], **report}))
