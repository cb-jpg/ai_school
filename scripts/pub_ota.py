"""App 在线更新（OTA）发布工具：把本地 dist/web 打包发布为热更新包。

流程（本地跑，不是服务器）：
    python scripts/pub_ota.py --version 2.3 --notes "修复xxx"
  1. 压缩 frontend/dist/web → 临时 zip（先 npm run build:web + npx cap sync android 之外的热更不需要 sync）
  2. 计算 sha256
  3. scp 上传到服务器 ~/ai_school/data/app-releases/
  4. 原子写 manifest.json（version/version_code/notes/url/sha256/ts）
  5. 回读校验

App 端（@capgo/capacitor-updater）：启动时拉 /app-releases/manifest.json，
version_code 大于本机构建号则弹窗更新（kiosk 静默换包）。
注意：OTA 只更新 web 层；原生层改动（MainActivity/插件/权限）仍需重打 APK。

服务器需重启一次让 server.py 的 /app-releases 挂载生效（之后发布不再需要重启）。
"""

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parent / "frontend"
DIST_WEB = FRONTEND / "dist" / "web"
SSH_TARGET = "liucb@183.36.243.124"
REMOTE_DIR = "ai_school/data/app-releases"


def read_version_from_gradle() -> tuple[int, str]:
    gradle = HERE.parent / "frontend" / "android" / "app" / "build.gradle"
    code, name = 0, ""
    for line in gradle.read_text(encoding="utf-8", errors="ignore").splitlines():
        s = line.strip()
        if s.startswith("versionCode"):
            code = int(s.split()[1])
        elif s.startswith("versionName"):
            name = s.split()[1].strip('"')
    if not code or not name:
        sys.exit("无法从 android/app/build.gradle 解析 versionCode/versionName")
    return code, name


def make_zip(version: str) -> Path:
    if not (DIST_WEB / "index.html").exists():
        sys.exit(f"dist/web 不存在：{DIST_WEB}（先 npm run build:web）")
    tmp = Path(tempfile.gettempdir()) / f"ota-web-{version}-{int(time.time())}.zip"
    n = 0
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for p in sorted(DIST_WEB.rglob("*")):
            if p.is_file():
                z.write(p, p.relative_to(DIST_WEB).as_posix())
                n += 1
    print(f"打包 {n} 个文件 → {tmp}（{tmp.stat().st_size // 1024}KB）")
    return tmp


def sha256_of(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ssh(cmd: str, **kw) -> str:
    r = subprocess.run(["ssh", "-o", "BatchMode=yes", SSH_TARGET, cmd],
                       capture_output=True, text=True, timeout=120, **kw)
    if r.returncode != 0:
        sys.exit(f"ssh 失败：{r.stderr.strip()[:300]}")
    return r.stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", help="OTA 包版本号（默认取 build.gradle versionName）")
    ap.add_argument("--notes", default="", help="更新说明（弹窗展示给用户）")
    ap.add_argument("--zip", help="使用现成 zip（默认重新打包 dist/web）")
    args = ap.parse_args()

    gradle_code, gradle_name = read_version_from_gradle()
    version = args.version or gradle_name
    print(f"OTA 版本 {version}（本机原生包 versionCode {gradle_code} / versionName {gradle_name}）")

    zpath = Path(args.zip) if args.zip else make_zip(version)
    digest = sha256_of(zpath)
    print(f"sha256 {digest}")

    # version_code：热更包取「当前原生 versionCode」，App 端用它判断"是否比我新"。
    # 原生层升级后（versionCode 更大的新 APK），热更包必须重新发布一次以抬高基准。
    remote_zip = f"{REMOTE_DIR}/web-{version}.zip"
    subprocess.run(["scp", "-o", "BatchMode=yes", str(zpath), f"{SSH_TARGET}:{remote_zip}"],
                   check=True, timeout=600)
    print(f"zip 已上传 → {remote_zip}")

    manifest = {
        "version": version,
        "version_code": gradle_code,
        "notes": args.notes,
        "url": f"/app-releases/web-{version}.zip",
        "sha256": digest,
        "size": zpath.stat().st_size,
        "ts": int(time.time()),
    }
    mf = json.dumps(manifest, ensure_ascii=False)
    # 原子替换：先写 .tmp 再 mv，避免 App 拉到半截 manifest
    ssh(
        f"cd {REMOTE_DIR} && printf '%s' '{mf}' > manifest.json.tmp && "
        f"mv manifest.json.tmp manifest.json && cat manifest.json"
    )
    print("manifest 已发布")

    # 回读校验（走公网，与 App 同路径）
    import urllib.request
    with urllib.request.urlopen(
        f"http://183.36.243.124:12393/app-releases/manifest.json", timeout=30
    ) as r:
        got = json.loads(r.read().decode("utf-8"))
    assert got["sha256"] == digest, "公网回读 sha256 不一致！"
    print(f"✅ 发布完成并公网校验通过：版本 {got['version']}（version_code {got['version_code']}）")


if __name__ == "__main__":
    main()
