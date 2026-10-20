# -*- coding: utf-8 -*-
"""AIGC 溯源标识工具（2026-10-14 合规材料包）：把 GB 45438-2025 的 7 字段
显式-隐式标识元数据写入图片/音频/视频文件，体现方式=修改文件元数据。

写入的元数据（JSON 序列化后按容器类型落盘，键统一为 "AIGC"）：
  Label             "1"
  ContentProducer   企业信用代码（明文，2026-10-20 校方要求两字段均用明码）
  ProduceID         md5(算法版本+文件唯一ID)  算法服务版本号+生成文件ID
  ReservedCode1     md5(文件名+生成时间)
  ContentPropagator 企业社会信用代码（明文，供传播链路核验）
  PropagateID       md5(时间戳+用户ID+用户手机号)  —— 手机号只进 MD5，绝不落明文
  ReservedCode2     "hash:"+md5(信用代码)

支持的容器：
  PNG  PIL tEXt chunk（key=AIGC）
  JPEG SOI 后插入 COM 段（PIL 不提供写 COM 的接口，手工拼段）
  MP3  mutagen ID3v2 TXXX 帧
  WAV  mutagen WAVE（ID3 容器）TXXX 帧
  MP4  mutagen MP4 freeform ----:com.apple.iTunes:AIGC（预留）

用法:
  python aigc_labeling.py label   <文件...>   # 打标（原地写回）
  python aigc_labeling.py verify  <文件...>   # 读回并校验 7 字段
  python aigc_labeling.py read    <文件...>   # 仅打印元数据
配置: 同目录 aigc_labeling_config.json（provider/credit_code/版本/演示手机号）。
依赖: Pillow、mutagen（本地 D:/python 已装 mutagen 1.48.1 / Pillow 12.x）。
"""
import argparse
import hashlib
import json
import struct
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")

CONFIG_PATH = Path(__file__).resolve().parent / "aigc_labeling_config.json"

AIGC_KEYS = [
    "Label", "ContentProducer", "ProduceID", "ReservedCode1",
    "ContentPropagator", "PropagateID", "ReservedCode2",
]


def md5(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def load_config() -> dict:
    cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    for key in ("provider_name", "credit_code", "algorithm_version"):
        if not cfg.get(key):
            raise SystemExit(f"配置缺少 {key}，请补全 {CONFIG_PATH.name}")
    return cfg


def build_aigc_payload(path: Path, cfg: dict) -> dict:
    """组装 7 字段标识。ProduceID 每个文件独立（uuid4），ReservedCode1 绑定文件名+生成时刻。

    ContentProducer / ContentPropagator 均写企业信用代码明文（2026-10-20 校方要求
    「这两个字段改为企业信用代码明码」）；provider_name 保留在配置中供文档引用。
    """
    produce_uuid = uuid.uuid4().hex
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    credit = cfg["credit_code"]
    return {
        "Label": "1",
        "ContentProducer": credit,
        "ProduceID": md5(f"{cfg['algorithm_version']}+{produce_uuid}"),
        "ReservedCode1": md5(f"{path.name}+{now}"),
        "ContentPropagator": credit,
        "PropagateID": md5(
            f"{now}+{cfg.get('user_id', 'system')}+{cfg.get('user_phone', '')}"
        ),
        "ReservedCode2": f"hash:{md5(credit)}",
    }


# ---------------- 各容器写入/读取 ----------------

def _write_png(path: Path, payload: dict) -> None:
    from PIL import Image

    with Image.open(path) as img:
        img.save(path, pnginfo=_png_info(json.dumps(payload, ensure_ascii=False)))


def _png_info(aigc_json: str):
    from PIL import Image, PngImagePlugin

    info = PngImagePlugin.PngInfo()
    info.add_text("AIGC", aigc_json)
    return info


def _read_png(path: Path):
    from PIL import Image

    with Image.open(path) as img:
        return img.info.get("AIGC")


def _write_jpeg(path: Path, payload: dict) -> None:
    """SOI(FFD8) 后插入 COM 段：FFFE + 2字节段长(含长度域) + 数据。"""
    data = path.read_bytes()
    if not data.startswith(b"\xff\xd8"):
        raise ValueError("不是 JPEG 文件")
    comment = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    segment = b"\xff\xfe" + struct.pack(">H", len(comment) + 2) + comment
    marked = data[:2] + segment + data[2:]
    path.write_bytes(marked)


def _read_jpeg(path: Path):
    data = path.read_bytes()
    idx = 2
    while idx + 4 <= len(data):
        if data[idx] != 0xFF:
            break
        marker = data[idx + 1]
        if marker == 0xD9:  # EOI
            break
        seg_len = struct.unpack(">H", data[idx + 2 : idx + 4])[0]
        if marker == 0xFE:  # COM
            try:
                return data[idx + 4 : idx + 2 + seg_len].decode("utf-8")
            except UnicodeDecodeError:
                return None
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            idx += 2
            continue
        idx += 2 + seg_len
    return None


def _id3_txxx(path: Path, payload: dict) -> None:
    from mutagen.id3 import ID3, TXXX
    from mutagen.mp3 import MP3

    audio = MP3(str(path))
    tags = audio.tags or ID3()
    tags.setall("TXXX:AIGC", [])
    tags.add(TXXX(encoding=3, desc="AIGC", text=json.dumps(payload, ensure_ascii=False)))
    tags.save(str(path))


def _read_id3(path: Path):
    from mutagen.id3 import ID3

    try:
        tags = ID3(str(path))
    except Exception:  # noqa: BLE001
        return None
    frame = tags.getall("TXXX:AIGC")
    if not frame:
        return None
    texts = frame[0].text
    return texts[0] if texts else None


def _write_wav(path: Path, payload: dict) -> None:
    from mutagen.id3 import ID3, TXXX
    from mutagen.wave import WAVE

    audio = WAVE(str(path))
    tags = audio.tags or ID3()
    tags.setall("TXXX:AIGC", [])
    tags.add(TXXX(encoding=3, desc="AIGC", text=json.dumps(payload, ensure_ascii=False)))
    tags.save(str(path))


def _write_mp4(path: Path, payload: dict) -> None:
    from mutagen.mp4 import MP4

    audio = MP4(str(path))
    audio["----:com.apple.iTunes:AIGC"] = [
        json.dumps(payload, ensure_ascii=False).encode("utf-8")
    ]
    audio.save()


def _read_mp4(path: Path):
    from mutagen.mp4 import MP4

    values = MP4(str(path)).get("----:com.apple.iTunes:AIGC")
    if not values:
        return None
    return values[0].decode("utf-8")


WRITERS = {
    ".png": _write_png,
    ".jpg": _write_jpeg,
    ".jpeg": _write_jpeg,
    ".mp3": _id3_txxx,
    ".wav": _write_wav,
    ".mp4": _write_mp4,
}
READERS = {
    ".png": _read_png,
    ".jpg": _read_jpeg,
    ".jpeg": _read_jpeg,
    ".mp3": _read_id3,
    ".wav": _read_id3,
    ".mp4": _read_mp4,
}


def label_file(path: Path, cfg: dict) -> dict:
    writer = WRITERS.get(path.suffix.lower())
    if writer is None:
        raise ValueError(f"不支持的文件类型：{path.suffix}")
    payload = build_aigc_payload(path, cfg)
    writer(path, payload)
    return payload


def verify_file(path: Path) -> tuple:
    reader = READERS.get(path.suffix.lower())
    if reader is None:
        raise ValueError(f"不支持的文件类型：{path.suffix}")
    raw = reader(path)
    if not raw:
        return False, "未读到 AIGC 元数据"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return False, "元数据不是合法 JSON"
    missing = [k for k in AIGC_KEYS if k not in data]
    if missing:
        return False, f"缺少字段: {','.join(missing)}"
    if data.get("Label") != "1":
        return False, "Label != 1"
    return True, data


def main() -> int:
    parser = argparse.ArgumentParser(description="AIGC 溯源标识工具（GB 45438-2025）")
    parser.add_argument("action", choices=["label", "verify", "read"])
    parser.add_argument("files", nargs="+", help="图片/音频/视频文件路径")
    args = parser.parse_args()

    cfg = load_config()
    failures = 0
    for raw_path in args.files:
        path = Path(raw_path)
        if not path.exists():
            print(f"FAIL | {path} | 文件不存在")
            failures += 1
            continue
        try:
            if args.action == "label":
                payload = label_file(path, cfg)
                print(f"OK   | 已打标 {path} | ProduceID={payload['ProduceID'][:12]}…")
            else:
                ok, result = verify_file(path)
                if args.action == "verify":
                    if ok:
                        print(f"PASS | {path}")
                        print(json.dumps(result, ensure_ascii=False, indent=2))
                    else:
                        print(f"FAIL | {path} | {result}")
                        failures += 1
                else:
                    print(f"---- {path} ----")
                    print(result if isinstance(result, str)
                          else json.dumps(result, ensure_ascii=False, indent=2))
        except Exception as e:  # noqa: BLE001
            print(f"FAIL | {path} | {e}")
            failures += 1
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
