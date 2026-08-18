"""
专题展示 API 路由

提供校史、学校成就、学习标兵专题的数据接口。
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from pathlib import Path
import json
from loguru import logger

from .school_history import SchoolHistoryNode, SchoolHistoryData
from .school_achievement import SchoolAchievement, AchievementCategory
from .student_model import StudentModel


# 创建路由器
router = APIRouter(prefix="/api/topics", tags=["专题展示"])

# 数据存储路径
DATA_DIR = Path(__file__).parent
HISTORY_DATA_FILE = DATA_DIR / "data.json"
ACHIEVEMENTS_DATA_FILE = DATA_DIR / "achievements.json"
STUDENTS_DATA_FILE = DATA_DIR / "students.json"


# ========== 校史专题 ==========

@router.get("/history", response_model=SchoolHistoryData)
async def get_school_history():
    """
    获取校史专题所有节点

    Returns:
        校史专题数据
    """
    try:
        with open(HISTORY_DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 添加分类统计
        categories = {}
        for node in data.get("nodes", []):
            category = node.get("category", "")
            categories[category] = categories.get(category, 0) + 1

        data["total_nodes"] = len(data.get("nodes", []))
        data["categories"] = categories

        return SchoolHistoryData(**data)

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="校史数据文件不存在")
    except Exception as e:
        logger.error(f"获取校史数据失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{node_id}", response_model=SchoolHistoryNode)
async def get_history_node(node_id: str):
    """
    获取单个校史节点

    Args:
        node_id: 节点ID

    Returns:
        校史节点数据
    """
    try:
        with open(HISTORY_DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)

        nodes = data.get("nodes", [])
        for node in nodes:
            if node.get("id") == node_id:
                return SchoolHistoryNode(**node)

        raise HTTPException(status_code=404, detail="校史节点不存在")

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="校史数据文件不存在")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取校史节点失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/category/{category}", response_model=List[SchoolHistoryNode])
async def get_history_by_category(category: str):
    """
    按分类获取校史节点

    Args:
        category: 分类（创办|迁址|更名|发展）

    Returns:
        校史节点列表
    """
    try:
        with open(HISTORY_DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)

        nodes = [
            SchoolHistoryNode(**node)
            for node in data.get("nodes", [])
            if node.get("category") == category
        ]

        return nodes

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="校史数据文件不存在")
    except Exception as e:
        logger.error(f"获取校史节点失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== 学校成就 ==========

@router.get("/achievements")
async def get_achievements(
    category: Optional[str] = Query(None, description="成就分类过滤"),
    year: Optional[str] = Query(None, description="年份过滤"),
):
    """
    获取学校成就列表

    Args:
        category: 分类过滤
        year: 年份过滤

    Returns:
        成就列表
    """
    try:
        with open(ACHIEVEMENTS_DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)

        achievements = data.get("achievements", [])

        # 应用过滤
        if category:
            achievements = [a for a in achievements if a.get("category") == category]
        if year:
            achievements = [a for a in achievements if a.get("year") == year]

        # 按显示顺序排序
        achievements = sorted(achievements, key=lambda x: x.get("display_order", 0))

        return {
            "school_name": data.get("school_name", ""),
            "achievements": achievements,
            "total": len(achievements)
        }

    except FileNotFoundError:
        logger.warning(f"成就数据文件不存在，返回空列表")
        return {"school_name": "", "achievements": [], "total": 0}
    except Exception as e:
        logger.error(f"获取学校成就失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/achievements/categories", response_model=List[str])
async def get_achievement_categories():
    """
    获取所有成就分类

    Returns:
        分类列表
    """
    try:
        with open(ACHIEVEMENTS_DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)

        achievements = data.get("achievements", [])
        categories = sorted(set(a.get("category", "") for a in achievements))

        return categories

    except FileNotFoundError:
        return AchievementCategory.all_categories()
    except Exception as e:
        logger.error(f"获取成就分类失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/achievements/{achievement_id}")
async def get_achievement(achievement_id: str):
    """
    获取单个学校成就详情

    Args:
        achievement_id: 成就ID

    Returns:
        成就详情
    """
    try:
        with open(ACHIEVEMENTS_DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)

        achievements = data.get("achievements", [])
        for achievement in achievements:
            if achievement.get("id") == achievement_id:
                return achievement

        raise HTTPException(status_code=404, detail="成就不存在")

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="成就数据文件不存在")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取成就详情失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== 学习标兵 ==========

@router.get("/students")
async def get_student_models(
    grade: Optional[str] = Query(None, description="届次过滤"),
    limit: int = Query(10, description="返回数量限制"),
):
    """
    获取学习标兵列表

    Args:
        grade: 届次过滤
        limit: 返回数量限制

    Returns:
        学习标兵列表
    """
    try:
        with open(STUDENTS_DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)

        students = data.get("students", [])

        # 应用过滤
        if grade:
            students = [s for s in students if s.get("grade") == grade]

        # 按显示顺序排序
        students = sorted(students, key=lambda x: x.get("display_order", 0))

        # 限制数量
        students = students[:limit]

        return {
            "school_name": data.get("school_name", ""),
            "students": students,
            "total": len(students)
        }

    except FileNotFoundError:
        logger.warning(f"学习标兵数据文件不存在，返回空列表")
        return {"school_name": "", "students": [], "total": 0}
    except Exception as e:
        logger.error(f"获取学习标兵失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/students/{student_id}")
async def get_student_model(student_id: str):
    """
    获取单个学习标兵详情

    Args:
        student_id: 学生ID

    Returns:
        学习标兵详情
    """
    try:
        with open(STUDENTS_DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)

        students = data.get("students", [])
        for student in students:
            if student.get("id") == student_id:
                return student

        raise HTTPException(status_code=404, detail="学习标兵不存在")

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="学习标兵数据文件不存在")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取学习标兵详情失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== 综合接口 ==========

@router.get("/")
async def get_all_topics():
    """
    获取所有专题的概览信息

    Returns:
        所有专题的概览
    """
    try:
        # 读取校史数据
        with open(HISTORY_DATA_FILE, 'r', encoding='utf-8') as f:
            history_data = json.load(f)

        # 读取成就数据
        with open(ACHIEVEMENTS_DATA_FILE, 'r', encoding='utf-8') as f:
            achievements_data = json.load(f)

        # 读取学习标兵数据
        with open(STUDENTS_DATA_FILE, 'r', encoding='utf-8') as f:
            students_data = json.load(f)

        return {
            "school_name": history_data.get("school_name", "石实实验学校"),
            "history": {
                "total_nodes": len(history_data.get("nodes", [])),
                "categories": history_data.get("categories", {})
            },
            "achievements": {
                "total": len(achievements_data.get("achievements", [])),
                "categories": list(set(a.get("category", "") for a in achievements_data.get("achievements", [])))
            },
            "students": {
                "total": len(students_data.get("students", [])),
                "grades": list(set(s.get("grade", "") for s in students_data.get("students", [])))
            }
        }

    except Exception as e:
        logger.error(f"获取专题概览失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
