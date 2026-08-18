"""
校园专题 API 测试脚本
测试校史、学校成就、学习标兵专题的数据接口
"""

import requests
import json
from pathlib import Path
import sys

# 修复 Windows 控制台编码问题
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


# API 基础 URL
API_BASE_URL = "http://localhost:8000"


def test_api_health():
    """测试 API 健康检查"""
    print("🔍 测试 API 健康检查...")
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            print(f"   响应: {response.json()}")
            print("✅ 健康检查通过\n")
            return True
        else:
            print("❌ 健康检查失败\n")
            return False
    except Exception as e:
        print(f"❌ 健康检查异常: {e}\n")
        return False


def test_topics_overview():
    """测试专题概览接口"""
    print("🔍 测试专题概览接口...")
    try:
        response = requests.get(f"{API_BASE_URL}/api/topics/", timeout=5)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   学校名称: {data.get('school_name')}")
            print(f"   校史节点数: {data.get('history', {}).get('total_nodes')}")
            print(f"   成就数量: {data.get('achievements', {}).get('total')}")
            print(f"   标兵数量: {data.get('students', {}).get('total')}")
            print("✅ 专题概览接口通过\n")
            return True
        else:
            print(f"   错误响应: {response.text}")
            print("❌ 专题概览接口失败\n")
            return False
    except Exception as e:
        print(f"❌ 专题概览接口异常: {e}\n")
        return False


def test_history_topic():
    """测试校史专题接口"""
    print("🔍 测试校史专题接口...")
    try:
        response = requests.get(f"{API_BASE_URL}/api/topics/history", timeout=5)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            nodes = data.get("nodes", [])
            print(f"   学校名称: {data.get('school_name')}")
            print(f"   节点数量: {len(nodes)}")
            if nodes:
                print(f"   第一个节点: {nodes[0].get('title')}")
            print("✅ 校史专题接口通过\n")
            return True
        else:
            print(f"   错误响应: {response.text}")
            print("❌ 校史专题接口失败\n")
            return False
    except Exception as e:
        print(f"❌ 校史专题接口异常: {e}\n")
        return False


def test_achievements_topic():
    """测试学校成就专题接口"""
    print("🔍 测试学校成就专题接口...")
    try:
        response = requests.get(f"{API_BASE_URL}/api/topics/achievements", timeout=5)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            achievements = data.get("achievements", [])
            print(f"   学校名称: {data.get('school_name')}")
            print(f"   成就数量: {data.get('total')}")
            if achievements:
                print(f"   第一个成就: {achievements[0].get('title')}")
            print("✅ 学校成就专题接口通过\n")
            return True
        else:
            print(f"   错误响应: {response.text}")
            print("❌ 学校成就专题接口失败\n")
            return False
    except Exception as e:
        print(f"❌ 学校成就专题接口异常: {e}\n")
        return False


def test_students_topic():
    """测试学习标兵专题接口"""
    print("🔍 测试学习标兵专题接口...")
    try:
        response = requests.get(f"{API_BASE_URL}/api/topics/students", timeout=5)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            students = data.get("students", [])
            print(f"   学校名称: {data.get('school_name')}")
            print(f"   标兵数量: {data.get('total')}")
            if students:
                print(f"   第一个标兵: {students[0].get('name')}")
            print("✅ 学习标兵专题接口通过\n")
            return True
        else:
            print(f"   错误响应: {response.text}")
            print("❌ 学习标兵专题接口失败\n")
            return False
    except Exception as e:
        print(f"❌ 学习标兵专题接口异常: {e}\n")
        return False


def verify_data_files():
    """验证数据文件是否存在"""
    print("🔍 验证数据文件...")
    project_root = Path(__file__).parent
    data_dir = project_root / "school_rag" / "models"

    files_to_check = [
        ("校史数据", data_dir / "data.json"),
        ("成就数据", data_dir / "achievements.json"),
        ("标兵数据", data_dir / "students.json"),
    ]

    all_exist = True
    for name, file_path in files_to_check:
        exists = file_path.exists()
        status = "✅" if exists else "❌"
        print(f"   {status} {name}: {file_path}")
        if not exists:
            all_exist = False

    if all_exist:
        print("✅ 所有数据文件存在\n")
    else:
        print("❌ 部分数据文件缺失\n")

    return all_exist


def main():
    """主测试函数"""
    print("=" * 60)
    print("校园专题 API 测试")
    print("=" * 60)
    print()

    # 首先验证数据文件
    files_ok = verify_data_files()

    # 测试健康检查
    health_ok = test_api_health()

    if not health_ok:
        print("⚠️  服务器未启动，请先启动服务器:")
        print("   cd D:\\SRP\\AI_school\\Open-LLM-VTuber")
        print("   uv run run_server.py")
        print()
        return

    # 测试各个接口
    results = {
        "数据文件": files_ok,
        "健康检查": health_ok,
        "专题概览": test_topics_overview(),
        "校史专题": test_history_topic(),
        "学校成就": test_achievements_topic(),
        "学习标兵": test_students_topic(),
    }

    # 输出测试结果
    print("=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    for test_name, result in results.items():
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{test_name:12s}: {status}")

    print()
    passed_count = sum(1 for r in results.values() if r)
    total_count = len(results)
    print(f"总计: {passed_count}/{total_count} 测试通过")
    print()


if __name__ == "__main__":
    main()
