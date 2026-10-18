"""Attach source-design expression layers to the existing animated head."""
import json
import shutil
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
EMOTIONS = {
    "neutral": ("喜", 0.15, 0),
    "anger": ("怒", -1.0, 0),
    "sadness": ("哀", -1.0, 0),
    "joy": ("乐", 1.0, 0.25),
    "surprise": ("惊恐", -0.2, 0.65),
    "bored": ("无语", -0.8, 0),
    "shy": ("害羞", 0.4, 0),
    "cry": ("哭", -1.0, 0),
}


def parameter_id(emotion):
    return "ParamArt" + emotion.capitalize()


def attach(rig, layers: Path, name: str):
    from image2live2d.core.mesh.build import build_mesh
    from image2live2d.core.types import Layer
    from image2live2d.irr.schema import Keyform, Parameter, Part, SemanticRole, Texture
    from PIL import Image

    source = HERE / "expression-art" / name
    index = json.loads((source / "index.json").read_text())
    face = rig.mesh_for("13_face_base")
    basis = np.column_stack((face.vertices, np.ones(len(face.vertices))))
    shared = [p for p in rig.parameters if p.id in {
        "ParamBodyAngleX", "ParamBodyAngleY", "ParamBodyAngleZ", "ParamBreath"
    }]
    originals = [p.id for p in rig.parts if p.semantic_role.value.startswith(("eye", "pupil"))]
    rig.parameters.append(Parameter(id="ParamArtBase", min=0, max=1, default=1, keyforms=[
        Keyform(value=0, opacity_overrides={pid: 0 for pid in originals}),
        Keyform(value=1, opacity_overrides={pid: 1 for pid in originals}),
    ]))
    order = max(p.draw_order for p in rig.parts) + 1
    for entry in index:
        emotion = entry["name"]
        if emotion == "neutral":
            continue
        pid = f"art_{emotion}"
        filename = f"{pid}.png"
        shutil.copy2(source / f"{emotion}.png", layers / filename)
        width, height = Image.open(layers / filename).size
        layer = Layer(pid, SemanticRole.accessory, layers / filename, order, width, height,
                      tuple(v / 1600 for v in entry["bbox"]))
        mesh = build_mesh(layer)
        tid = f"tex_{pid}"
        rig.textures.append(Texture(id=tid, path=filename, width=width, height=height))
        rig.parts.append(Part(id=pid, semantic_role=SemanticRole.accessory, texture_id=tid, draw_order=order))
        rig.meshes.append(mesh)
        # Body/breath movement is affine over the face. Transfer the exact common motion,
        # so the newly added art never separates from the existing skin during movement.
        new_basis = np.column_stack((mesh.vertices, np.ones(len(mesh.vertices))))
        for parameter in shared:
            for keyform in parameter.keyforms:
                offsets = keyform.mesh_offsets.get(face.part_id)
                if offsets is not None:
                    transform, *_ = np.linalg.lstsq(basis, np.asarray(offsets), rcond=None)
                    assert np.max(np.abs(basis @ transform - offsets)) < 1e-6
                    keyform.mesh_offsets[pid] = [tuple(v) for v in new_basis @ transform]
        rig.parameters.append(Parameter(id=parameter_id(emotion), min=0, max=1, default=0, keyforms=[
            Keyform(value=0, opacity_overrides={pid: 0}),
            Keyform(value=1, opacity_overrides={pid: 1}),
        ]))
        order += 1


def write_expressions(directory: Path):
    output = directory / "expressions"
    output.mkdir(exist_ok=True)
    references = []
    # Explicit Overwrite values prevent the preceding face / gesture from leaking through.
    for emotion, (_, mouth_form, mouth_open) in EMOTIONS.items():
        values = {"ParamArtBase": int(emotion == "neutral")}
        values.update({parameter_id(e): int(e == emotion) for e in EMOTIONS if e != "neutral"})
        values.update({"ParamMouthForm": mouth_form, "ParamMouthOpenY": mouth_open,
                       "ParamEyeLSmile": 0, "ParamEyeRSmile": 0, "ParamCheek": 0,
                       "ParamBrowLY": 0, "ParamBrowRY": 0, "ParamBrowLForm": 0, "ParamBrowRForm": 0})
        payload = {"Type": "Live2D Expression", "FadeInTime": .18, "FadeOutTime": .18,
                   "Parameters": [{"Id": key, "Value": value, "Blend": "Overwrite"} for key, value in values.items()]}
        filename = f"expressions/{emotion}.exp3.json"
        (directory / filename).write_text(json.dumps(payload, indent=2) + "\n")
        references.append({"Name": emotion, "File": filename})
    # Keep existing callers using the old expression name working.
    references.append({"Name": "smirk", "File": "expressions/joy.exp3.json"})
    return references
