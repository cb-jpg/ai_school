"""Rebuild the school avatars with the patched image2live2d checkout.

Usage: python scripts/avatars/rebuild.py /tmp/rebuilt-avatars
The output must be separate from live2d-models so the originals stay available.
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from art_expressions import attach, write_expressions

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def finish_model(generated: Path, original: Path, name: str) -> None:
    """Preserve expressions and app metadata; install Idle and Talk variants."""
    model_file = f"{name}.model3.json"
    model = json.loads((generated / model_file).read_text())
    previous = json.loads((original / model_file).read_text())
    # Preserve app-specific metadata, such as expression names used by emotionMap.
    for key, value in previous.items():
        if key not in {"FileReferences", "Groups", "HitAreas"}:
            model[key] = value
    model["FileReferences"]["Expressions"] = write_expressions(generated)
    subprocess.run([sys.executable, str(HERE / "gen_motions.py"), str(generated), name], check=True)
    index_file = generated / "_motion_index.json"
    index = json.loads(index_file.read_text())
    index_file.unlink()
    for group, files in index.items():
        model["FileReferences"]["Motions"][group] = [
            {"File": filename, "FadeInTime": 0.4, "FadeOutTime": 0.4}
            for filename in files
        ]
    (generated / model_file).write_text(json.dumps(model, ensure_ascii=False, indent=2) + "\n")


def main() -> None:
    from image2live2d.backends.live2d import Live2DEmitter
    from image2live2d.backends.live2d.moc3_emit import native_moc_writer
    from image2live2d.core import decompose
    from image2live2d.pipeline import rig_from_stack

    output = Path(sys.argv[1]).resolve()
    if output == ROOT / "live2d-models" or output.exists():
        raise SystemExit("Choose a new output directory; review it before replacing runtime models.")
    for name in ("xiaoshi", "xiaomeng"):
        with tempfile.TemporaryDirectory() as tmp:
            layers = Path(tmp) / "layers"
            shutil.copytree(HERE / "layers" / name, layers)
            stack = decompose.from_layer_dir(layers)
            rig = rig_from_stack(stack, name=name, source=str(HERE / "layers" / name))
            # These cutouts store the cheek/jaw outline in the back-hair layer.
            # Independent strand physics would pull that outline off the face.
            for parameter in rig.parameters:
                if parameter.id.startswith("ParamHairBack"):
                    for keyform in parameter.keyforms:
                        keyform.mesh_offsets.pop("01_hair_back", None)
                # The auto-rigger mistakes the uniform/shirt cutouts for loose skirt
                # panels. Their independent sway pulls sleeves off the arms and shorts
                # off the legs when pointer tracking drives ParamBodyAngleX.
                # Keep IDs for compatibility, but remove these invalid deformations.
                if parameter.id.startswith(("ParamSkirt", "ParamCloth")):
                    for keyform in parameter.keyforms:
                        keyform.mesh_offsets.clear()
            rig.physics = [p for p in rig.physics
                           if not p.output_param.startswith(("ParamSkirt", "ParamCloth"))]
            attach(rig, layers, name)
            generated = output / name
            bundle = Live2DEmitter(asset_root=layers, moc_writer=native_moc_writer).build(rig, generated)
            assert bundle.moc_written, "The native moc3 writer is required"
            finish_model(generated, ROOT / "live2d-models" / name, name)
            print(f"Built {name}: {len(rig.parts)} parts -> {generated}")


if __name__ == "__main__":
    main()
