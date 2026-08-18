"""
学习标兵专题数据模型
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class StudentMethod(BaseModel):
    """学习方法数据模型"""

    category: str = Field(..., description="方法类别: 预习|课堂|复习|错题|时间管理|阅读|训练")
    description: str = Field(..., description="方法描述")
    examples: List[str] = Field(default_factory=list, description="具体做法示例")

    class Config:
        json_schema_extra = {
            "example": {
                "category": "预习",
                "description": "提前预习课程内容",
                "examples": [
                    "前一天晚上预习20分钟",
                    "标记不懂的知识点",
                    "准备相关问题"
                ]
            }
        }


class StudentModel(BaseModel):
    """学习标兵数据模型"""

    id: str = Field(..., description="学生ID")
    name: str = Field(..., description="学生姓名")
    grade: str = Field(..., description="届次，如 '2023届'")
    class_name: Optional[str] = Field(None, description="班级")

    # 成长故事
    growth_story: str = Field("", description="成长经历和故事")
    summary: str = Field("", description="简要介绍")

    # 学习方法
    methods: Dict[str, List[str]] = Field(
        default_factory=dict,
        description="学习方法，key为方法类别，value为具体做法"
    )

    # 成就和荣誉
    achievements: List[str] = Field(default_factory=list, description="获奖和荣誉")

    # 学习成果
    scores: Dict[str, Any] = Field(default_factory=dict, description="成绩和排名")

    # 特点和品质
    characteristics: List[str] = Field(default_factory=list, description="个人特点和品质")

    # 媒体资源
    photo_url: Optional[str] = Field(None, description="照片URL")

    # 元数据
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    display_order: int = Field(0, description="显示顺序")

    def get_methods_categories(self) -> List[str]:
        """获取学习方法类别列表"""
        return list(self.methods.keys())

    def get_methods_by_category(self, category: str) -> List[str]:
        """按类别获取学习方法"""
        return self.methods.get(category, [])

    class Config:
        json_schema_extra = {
            "example": {
                "id": "student_001",
                "name": "张三",
                "grade": "2023届",
                "class_name": "高三(1)班",
                "growth_story": "张三同学从高一入学时成绩平平...",
                "summary": "通过三年努力，以优异成绩考入清华",
                "methods": {
                    "预习": ["提前一天预习", "标记重点难点"],
                    "课堂": ["认真听讲", "积极提问"],
                    "复习": ["当天复习", "整理笔记"],
                    "错题": ["建立错题本", "定期回顾"],
                    "时间管理": ["制定学习计划", "劳逸结合"],
                    "阅读": ["广泛阅读", "做读书笔记"],
                    "训练": ["坚持刷题", "模拟考试"]
                },
                "achievements": [
                    "2023年高考理科全市第一名",
                    "全国中学生物理竞赛一等奖",
                    "优秀学生干部"
                ],
                "scores": {
                    "高考总分": 712,
                    "语文": 138,
                    "数学": 148,
                    "英语": 145,
                    "理综": 281,
                    "全市排名": 1
                },
                "characteristics": [
                    "自律性强",
                    "善于总结",
                    "乐于助人",
                    "兴趣广泛"
                ],
                "photo_url": "/images/student_zhangsan.jpg",
                "display_order": 1
            }
        }
