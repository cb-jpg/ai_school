"""
校园专题展示路由
提供校史、学校成就、学习标兵专题的数据接口
"""

from fastapi import APIRouter, HTTPException
from pathlib import Path
import json
from loguru import logger


def init_campus_topics_route() -> APIRouter:
    """
    创建校园专题展示路由

    Returns:
        APIRouter: 配置好的路由器
    """

    router = APIRouter(prefix="/api/topics", tags=["专题展示"])

    # 数据存储路径 - 修复为使用相对于脚本文件的正确路径
    # 从 campus_routes.py 到 school_rag/models 需要向上 3 级然后进入 school_rag/models
    data_dir = Path(__file__).parent.parent.parent / "school_rag" / "models"
    history_data_file = data_dir / "data.json"
    achievements_data_file = data_dir / "achievements.json"
    students_data_file = data_dir / "students.json"

    # ========== 校史专题 ==========

    @router.get("/history")
    async def get_school_history():
        """
        获取校史专题所有节点

        Returns:
            校史专题数据
        """
        try:
            with open(history_data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # 添加分类统计
            categories = {}
            for node in data.get("nodes", []):
                category = node.get("category", "")
                categories[category] = categories.get(category, 0) + 1

            data["total_nodes"] = len(data.get("nodes", []))
            data["categories"] = categories

            return data

        except FileNotFoundError:
            logger.warning(f"校史数据文件不存在: {history_data_file}")
            raise HTTPException(status_code=404, detail="校史数据文件不存在")
        except Exception as e:
            logger.error(f"获取校史数据失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/history/{node_id}")
    async def get_history_node(node_id: str):
        """
        获取单个校史节点

        Args:
            node_id: 节点ID

        Returns:
            校史节点数据
        """
        try:
            with open(history_data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            nodes = data.get("nodes", [])
            for node in nodes:
                if node.get("id") == node_id:
                    return node

            raise HTTPException(status_code=404, detail="校史节点不存在")

        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="校史数据文件不存在")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取校史节点失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    # ========== 学校成就 ==========

    @router.get("/achievements")
    async def get_achievements():
        """
        获取学校成就列表

        Returns:
            成就列表
        """
        try:
            with open(achievements_data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            achievements = data.get("achievements", [])

            # 按显示顺序排序
            achievements = sorted(achievements, key=lambda x: x.get("display_order", 0))

            return {
                "school_name": data.get("school_name", ""),
                "achievements": achievements,
                "total": len(achievements)
            }

        except FileNotFoundError:
            logger.warning(f"成就数据文件不存在: {achievements_data_file}")
            return {"school_name": "", "achievements": [], "total": 0}
        except Exception as e:
            logger.error(f"获取学校成就失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    # ========== 学习标兵 ==========

    @router.get("/students")
    async def get_student_models():
        """
        获取学习标兵列表

        Returns:
            学习标兵列表
        """
        try:
            with open(students_data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            students = data.get("students", [])

            # 按显示顺序排序
            students = sorted(students, key=lambda x: x.get("display_order", 0))

            return {
                "school_name": data.get("school_name", ""),
                "students": students,
                "total": len(students)
            }

        except FileNotFoundError:
            logger.warning(f"学习标兵数据文件不存在: {students_data_file}")
            return {"school_name": "", "students": [], "total": 0}
        except Exception as e:
            logger.error(f"获取学习标兵失败: {e}")
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
            with open(history_data_file, 'r', encoding='utf-8') as f:
                history_data = json.load(f)

            # 读取成就数据
            with open(achievements_data_file, 'r', encoding='utf-8') as f:
                achievements_data = json.load(f)

            # 读取学习标兵数据
            with open(students_data_file, 'r', encoding='utf-8') as f:
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

    return router
