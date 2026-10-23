"""Mix the locally composed score into a private Daily revision, preserving video.

No providers, paid calls or sample downloads. Refuses to activate a public intro.
TG_LAUNCH_VOICE_DIR=... python3 scripts/tg/mix-clock-score.py CANDIDATE_DIRECTORY
Append --intro-only for a four-second ident followed by voice alone.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


def run(*args):
    subprocess.run(["ffmpeg", "-y", "-v", "error", *map(str, args)], check=True)


candidate = Path(sys.argv[1]).resolve()
if any(arg != "--intro-only" for arg in sys.argv[2:]):
    raise ValueError("Only the optional --intro-only mix policy is supported")
intro_only = "--intro-only" in sys.argv[2:]
revisions = Path("public/daily-launch/revisions").resolve()
private = Path(os.environ["TG_LAUNCH_VOICE_DIR"]).resolve()
cache = Path(".tg-artifacts/.launch-promo").resolve()
if not candidate.is_relative_to(revisions) or not private.is_relative_to(cache):
    raise ValueError("Use a private launch cache and a candidate under revisions")
manifest_path = candidate / "manifest.json"
manifest = json.loads(manifest_path.read_text())
if manifest.get("previewOnly") is not True:
    raise ValueError("This helper only mixes private preview candidates")
duration = str(manifest["duration"])

# Keep the approved voice waveform and all ASR/cue times. The bed is filtered
# away from the speech presence range, then gently ducked by the same voice.
filters = (
    "[0:a]aresample=48000,asplit=2[voice][side];"
    "[1:a]highpass=f=85,equalizer=f=2500:t=q:w=0.8:g=-3,"
    "volume='0.28*(1+0.65*lt(t,0.18)+0.80*max(0,min(1,(t-36.45)/0.7)))':eval=frame[score];"
    "[score][side]sidechaincompress=threshold=0.018:ratio=3:attack=25:release=260:"
    "makeup=1:link=average,asplit=2[bed][bedcopy];"
    "[voice][bed]amix=inputs=2:duration=first:normalize=0,"
    "alimiter=limit=0.870964:level=false:latency=true[mix]"
)
if intro_only:
    filters = (
        "[0:a]aresample=48000[voice];"
        "[1:a]atrim=start=0:end=4,asetpts=PTS-STARTPTS,"
        "afade=t=in:st=0:d=0.04,afade=t=out:st=2.8:d=1.2,"
        "volume=0.18,apad,asplit=2[bed][bedcopy];"
        "[voice][bed]amix=inputs=2:duration=first:normalize=0,"
        "alimiter=limit=0.870964:level=false:latency=true[mix]"
    )
run("-i", private / "voice.wav", "-i", private / "original-score-clock.wav",
    "-filter_complex", filters, "-map", "[mix]", "-ar", "48000", "-ac", "2",
    "-t", duration, candidate / "audio.partial.wav", "-map", "[bedcopy]",
    "-ar", "48000", "-ac", "2", "-t", duration,
    private / ("music-bed-intro-only.wav" if intro_only else "music-bed.wav"))
(candidate / "audio.partial.wav").replace(candidate / "audio.wav")

# Reuse the already reviewed H.264 frames; a soundtrack change must not alter
# character movement, typography, subtitles or the timing of the voice.
for orientation in ("portrait", "landscape"):
    target = candidate / f"{orientation}.mp4"
    partial = candidate / f"{orientation}.partial.mp4"
    run("-i", target, "-i", candidate / "audio.wav", "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-t", duration, "-movflags", "+faststart", partial)
    run("-i", partial, "-f", "null", "-")
    partial.replace(target)

run("-i", private / "original-score-clock.wav", "-af", "volume=0.85",
    "-c:a", "libmp3lame", "-b:a", "192k", candidate / "sigla-originale.mp3")
digest = hashlib.sha256()
for orientation in ("portrait", "landscape"):
    digest.update((candidate / f"{orientation}.mp4").read_bytes())
manifest["mediaVersion"] = digest.hexdigest()[:12]
manifest["rightsStatus"] = "Original local instrumental; Free-plan Alex voice is private review only, commercial voice rights unresolved"
manifest["music"] = {
    "title": "Primo piano", "source": "original local synthesis", "bpm": 100,
    "samples": False, "providerCalls": 0, "voiceDucking": not intro_only,
    "mode": "intro-only" if intro_only else "bed",
    **({"endsAtSeconds": 4, "newsBed": False, "outroBed": False} if intro_only else {}),
}
partial_manifest = candidate / "manifest.partial.json"
partial_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
partial_manifest.replace(manifest_path)
print(json.dumps({"mediaVersion": manifest["mediaVersion"], "duration": manifest["duration"],
                  "music": "original local composition", "published": False}))
