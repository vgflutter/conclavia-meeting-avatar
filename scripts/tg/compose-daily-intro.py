"""Daily audio policy: optional four-second ident, then voice only.

python3 scripts/tg/compose-daily-intro.py --id=YYYY-MM-DD-it-pilot-r2 \
  --intro=PATH_TO_ORIGINAL_LOCAL_SCORE.wav
"""
import argparse
import json
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("--id", required=True)
parser.add_argument("--intro", type=Path)
args = parser.parse_args()
if not re.fullmatch(r"\d{4}-\d{2}-\d{2}-it-pilot(?:-r[1-9]\d*)?", args.id):
    raise ValueError("An explicit local pilot ID is required")
root = Path(".tg-artifacts/.launch-promo/editions") / args.id
public = Path("public/daily-launch/editions") / args.id
manifest = json.loads((public / "manifest.json").read_text())
if manifest.get("id") != args.id or not manifest.get("previewOnly"):
    raise ValueError("This mixer only prepares private pilot candidates")
duration = str(manifest["duration"])
command = ["ffmpeg", "-y", "-v", "error", "-i", str(root / "voice.wav")]
if args.intro:
    # Force the musical stem to digital zero after 4.0 s; no scene accents,
    # outro lift or compressor release can extend it into the news stories.
    command += ["-i", str(args.intro), "-filter_complex",
                "[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0[voice];"
                "[1:a]atrim=start=0:end=4,asetpts=PTS-STARTPTS,"
                "afade=t=in:st=0:d=0.04,afade=t=out:st=2.8:d=1.2,"
                "volume=0.18,apad[ident];"
                "[voice][ident]amix=inputs=2:normalize=0:duration=first,"
                "alimiter=limit=0.870964:level=false:latency=true[mix]",
                "-map", "[mix]"]
else:
    command += ["-af", "aresample=48000,pan=stereo|c0=c0|c1=c0"]
command += ["-t", duration, "-ar", "48000", "-ac", "2", str(public / "audio.partial.wav")]
subprocess.run(command, check=True)
(public / "audio.partial.wav").replace(public / "audio.wav")
manifest["music"] = {"mode": "intro-only" if args.intro else "none",
                     "endsAtSeconds": 4 if args.intro else 0,
                     "newsBed": False, "outroBed": False}
(public / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"duration": manifest["duration"], "music": manifest["music"], "providerCalls": 0}))
