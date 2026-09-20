"""Compatibility entrypoint. The shared avatar kit owns the asset builder."""
from pathlib import Path
import runpy
import sys

kit = Path(__file__).resolve().parents[2] / "conclavia-avatar-kit"
# Old documented output paths now target the canonical assets, never a consumer copy.
if "--output" in sys.argv:
    index = sys.argv.index("--output") + 1
    if index < len(sys.argv) and Path(sys.argv[index]).resolve() == Path(__file__).resolve().parents[1] / "public/avatars/rigged-v1":
        sys.argv[index] = str(kit / "assets/rigged-v1")
runpy.run_path(str(kit / "scripts/build-rigged-avatars.py"), run_name="__main__")
