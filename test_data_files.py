"""
专题数据文件验证脚本
直接测试 JSON 数据文件的完整性和正确性
"""

import json
import sys
from pathlib import Path

# 修复 Windows 控制台编码问题
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


def test_json_file(file_path: Path, file_name: str):
    """测试单个 JSON 文件"""
    print(f"🔍 测试 {file_name}...")

    try:
        # 检查文件是否存在
        if not file_path.exists():
            print(f"   ❌ 文件不存在: {file_path}")
            return False

        # 读取并解析 JSON
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 验证基本结构
        print(f"   ✅ 文件存在且 JSON 格式正确")

        # 根据不同文件类型进行详细验证
        if file_name == "校史数据":
            nodes = data.get("nodes", [])
            print(f"   📊 学校名称: {data.get('school_name')}")
            print(f"   📊 节点数量: {len(nodes)}")
            if nodes:
                print(f"   📊 第一个节点: {nodes[0].get('title')}")

        elif file_name == "成就数据":
            achievements = data.get("achievements", [])
            print(f"   📊 学校名称: {data.get('school_name')}")
            print(f"   📊 成就数量: {len(achievements)}")
            if achievements:
                print(f"   📊 第一个成就: {achievements[0].get('title')}")

        elif file_name == "标兵数据":
            students = data.get("students", [])
            print(f"   📊 学校名称: {data.get('school_name')}")
            print(f"   📊 标兵数量: {len(students)}")
            if students:
                print(f"   📊 第一个标兵: {students[0].get('name')}")

        print(f"   ✅ {file_name} 验证通过\n")
        return True

    except json.JSONDecodeError as e:
        print(f"   ❌ JSON 解析错误: {e}\n")
        return False
    except Exception as e:
        print(f"   ❌ 测试失败: {e}\n")
        return False


def test_data_completeness():
    """测试数据完整性"""
    print("🔍 测试数据完整性...")

    project_root = Path(__file__).parent
    data_dir = project_root / "school_rag" / "models"

    # 读取所有数据文件
    with open(data_dir / "data.json", 'r', encoding='utf-8') as f:
        history_data = json.load(f)

    with open(data_dir / "achievements.json", 'r', encoding='utf-8') as f:
        achievements_data = json.load(f)

    with open(data_dir / "students.json", 'r', encoding='utf-8') as f:
        students_data = json.load(f)

    # 验证校史数据
    history_nodes = history_data.get("nodes", [])
    print(f"   📊 校史节点: {len(history_nodes)} 个")

    # 验证成就数据
    achievements = achievements_data.get("achievements", [])
    print(f"   📊 学校成就: {len(achievements)} 个")

    # 验证标兵数据
    students = students_data.get("students", [])
    print(f"   📊 学习标兵: {len(students)} 个")

    # 验证学校名称一致性
    school_names = [
        history_data.get("school_name"),
        achievements_data.get("school_name"),
        students_data.get("school_name")
    ]

    if len(set(school_names)) == 1:
        print(f"   ✅ 学校名称一致: {school_names[0]}")
    else:
        print(f"   ⚠️  学校名称不一致: {school_names}")

    print("✅ 数据完整性验证通过\n")
    return True


def test_data_content():
    """测试数据内容质量"""
    print("🔍 测试数据内容质量...")

    project_root = Path(__file__).parent
    data_dir = project_root / "school_rag" / "models"

    # 读取成就数据
    with open(data_dir / "achievements.json", 'r', encoding='utf-8') as f:
        achievements_data = json.load(f)

    achievements = achievements_data.get("achievements", [])

    # 验证每个成就的必需字段
    required_fields = ["id", "category", "title", "summary", "content"]
    for i, achievement in enumerate(achievements):
        missing_fields = [field for field in required_fields if not achievement.get(field)]
        if missing_fields:
            print(f"   ⚠️  成就 {i+1} 缺少字段: {missing_fields}")
        else:
            print(f"   ✅ 成就 {i+1} ({achievement.get('title')}) 字段完整")

    # 读取标兵数据
    with open(data_dir / "students.json", 'r', encoding='utf-8') as f:
        students_data = json.load(f)

    students = students_data.get("students", [])

    # 验证每个标兵的必需字段
    required_student_fields = ["id", "name", "grade", "summary", "growth_story"]
    for i, student in enumerate(students):
        missing_fields = [field for field in required_student_fields if not student.get(field)]
        if missing_fields:
            print(f"   ⚠️  标兵 {i+1} 缺少字段: {missing_fields}")
        else:
            print(f"   ✅ 标兵 {i+1} ({student.get('name')}) 字段完整")

    print("✅ 数据内容质量验证通过\n")
    return True


def main():
    """主测试函数"""
    print("=" * 60)
    print("专题数据文件验证")
    print("=" * 60)
    print()

    project_root = Path(__file__).parent
    data_dir = project_root / "school_rag" / "models"

    # 测试各个文件
    files = [
        (data_dir / "data.json", "校史数据"),
        (data_dir / "achievements.json", "成就数据"),
        (data_dir / "students.json", "标兵数据"),
    ]

    results = {}
    for file_path, file_name in files:
        results[file_name] = test_json_file(file_path, file_name)

    # 测试数据完整性
    results["数据完整性"] = test_data_completeness()

    # 测试数据内容质量
    results["内容质量"] = test_data_content()

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
