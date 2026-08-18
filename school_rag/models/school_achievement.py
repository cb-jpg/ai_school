"""
学校成就专题数据模型
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class AchievementCategory:
    """成就分类常量"""

    SAFETY_EDUCATION = "安全科普"  # 安全教育成果
    INFO_SCIENCE = "信息学培养"    # 信息学竞赛
    TEACHER_GROWTH = "教师成长"    # 教师发展
    READING = "阅读"              # 阅读推广
    ARTS = "美育"                # 艺术教育
    CLUBS = "社团"               # 社团活动

    @classmethod
    def all_categories(cls) -> List[str]:
        """获取所有分类"""
        return [
            cls.SAFETY_EDUCATION,
            cls.INFO_SCIENCE,
            cls.TEACHER_GROWTH,
            cls.READING,
            cls.ARTS,
            cls.CLUBS,
        ]


class SchoolAchievement(BaseModel):
    """学校成就数据模型"""

    id: str = Field(..., description="成就ID")
    category: str = Field(..., description="成就分类")
    title: str = Field(..., description="成就标题")

    # 文本内容
    summary: str = Field("", description="成就摘要")
    content: str = Field("", description="详细内容（用于数字人讲解）")

    # 关键事实和统计
    facts: Dict[str, Any] = Field(default_factory=dict, description="关键事实和统计信息")

    # 媒体资源
    images: List[str] = Field(default_factory=list, description="相关图片URL")
    video_url: Optional[str] = Field(None, description="相关视频URL")

    # 时间信息
    year: Optional[str] = Field(None, description="年份")
    date: Optional[str] = Field(None, description="具体日期")

    # 元数据
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    display_order: int = Field(0, description="显示顺序")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "achieve_001",
                "category": "信息学培养",
                "title": "全国信息学奥赛一等奖",
                "summary": "我校学生在全国信息学奥林匹克竞赛中斩获一等奖",
                "content": "在2024年全国信息学奥林匹克竞赛中...",
                "facts": {
                    "获奖人数": 5,
                    "指导教师": "李老师",
                    "竞赛级别": "国家级"
                },
                "images": ["/images/noi_2024.jpg"],
                "year": "2024",
                "display_order": 1
            }
        }
