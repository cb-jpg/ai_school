"""Extract the supplied design-sheet features, excluding the independently animated mouth.

Sources are pages 18 / 22 of 石门实验学校IP设计（终稿）-JPG.rar.
No generated artwork is used. Coordinates below use the 1600px-wide design sheet.
"""
from pathlib import Path
import json

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

HERE = Path(__file__).resolve().parent
NAMES = ["neutral", "anger", "sadness", "joy", "surprise", "bored", "shy", "cry"]
LABELS = ["喜", "怒", "哀", "乐", "惊恐", "无语", "害羞", "哭"]


def largest(mask):
    labels, _ = ndi.label(mask)
    counts = np.bincount(labels.ravel())
    return labels == (1 + counts[1:].argmax())


def extract(name):
    source = Image.open(HERE / "expression-sources" / f"{name}.jpg").convert("RGB")
    scale = source.width / 1600
    array = np.asarray(source)
    base = np.asarray(Image.open(HERE / "layers" / name / "13_face_base.png"))
    ys, xs = np.where(base[..., 3] > 20)
    target = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    destination = HERE / "expression-art" / name
    destination.mkdir(parents=True, exist_ok=True)
    manifest = []
    for i, emotion in enumerate(NAMES):
        cx = 180 + i % 4 * 315
        cy = 190 + i // 4 * (400 if name == "xiaoshi" else 410)
        x0, y0, x1, y1 = [round(v * scale) for v in (cx, cy, cx + 290, cy + 300)]
        rgb = array[y0:y1, x0:x1]
        r, g, b = rgb.astype(float).transpose(2, 0, 1)
        skin = largest((r > 180) & (r > g + 8) & (g > 130) & (b > 130))
        yy, xx = np.where(skin)
        fx, fy, fw, fh = xx.min(), yy.min(), xx.max() - xx.min() + 1, yy.max() - yy.min() + 1
        # Independent dark components identify eyes, eyebrows, sweat and tears. The scalp/
        # outline is the large connected component, and the mouth is excluded by position.
        dark = (np.maximum.reduce([r, g, b]) < 155) | ((b > r + 25) & (g > r + 15))
        labels, count = ndi.label(dark)
        selected = np.zeros(dark.shape, dtype=bool)
        mouth_pixels = np.zeros(dark.shape, dtype=bool)
        for label in range(1, count + 1):
            yy, xx = np.where(labels == label)
            if len(xx) < 5 or len(xx) > fw * fh * .18:
                continue
            u, v = (xx.mean() - fx) / fw, (yy.mean() - fy) / fh
            mouth = .32 < u < .68 and v > .60
            if mouth:
                mouth_pixels |= labels == label
            if .035 < u < .965 and .10 < v < .98 and not mouth:
                selected |= labels == label
        selected = ndi.binary_fill_holes(selected)  # keep eye whites and specular highlights
        row, _ = np.indices(dark.shape)
        selected |= (r > 230) & (g > 230) & (b > 230) & ndi.binary_fill_holes(skin) & (row < fy + .68 * fh)
        selected = ndi.binary_dilation(selected, iterations=2)
        yy, xx = np.indices(dark.shape)
        u, v = (xx - fx) / fw, (yy - fy) / fh
        # Keep the red anger symbol on the hair and the design's nose blush / panic band.
        red = (r > 100) & (r > g * 1.5) & (r > b * 1.3)
        if emotion == "anger":
            selected |= ndi.binary_dilation(red & (u > .55) & (u < 1.15) & (v < .30) & (v > -.2), iterations=2)
        pink = (r > 190) & (g < 210) & (b < 215) & (g > 100)
        if emotion in ("shy", "surprise") or (emotion == "sadness" and name == "xiaomeng"):
            blobs, count = ndi.label(pink)
            for label in range(1, count + 1):
                yy, xx = np.where(blobs == label)
                if len(xx) > 3 and .27 < (xx.mean() - fx) / fw < .73 and .45 < (yy.mean() - fy) / fh < .76:
                    selected |= ndi.binary_dilation(blobs == label, iterations=round(4 * scale))
        # Blush matting must not reintroduce a mouth outline through its dilation fringe.
        selected &= ~ndi.binary_dilation(ndi.binary_fill_holes(mouth_pixels), iterations=3)
        rgba = np.dstack((rgb, selected.astype(np.uint8) * 255))
        sx, sy = (target[2] - target[0]) / fw, (target[3] - target[1]) / fh
        transform = np.array([[sx, 0, target[0] - sx * fx], [0, sy, target[1] - sy * fy]])
        aligned = cv2.warpAffine(rgba, transform, (1600, 1600), flags=cv2.INTER_CUBIC)
        ay, ax = np.where(aligned[..., 3] > 0)
        box = [max(0, int(ax.min()) - 2), max(0, int(ay.min()) - 2), min(1600, int(ax.max()) + 3), min(1600, int(ay.max()) + 3)]
        Image.fromarray(aligned[box[1]:box[3], box[0]:box[2]]).save(destination / f"{emotion}.png")
        manifest.append({"name": emotion, "label": LABELS[i], "bbox": box, "sheetPage": 18 if name == "xiaoshi" else 22})
    (destination / "index.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    for character in ("xiaoshi", "xiaomeng"):
        extract(character)
