"""
校史专题数据模型
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class SchoolHistoryNode(BaseModel):
    """校史节点数据模型"""

    id: str = Field(..., description="节点ID")
    time: str = Field(..., description="时间，如 '1958年'")
    title: str = Field(..., description="标题，如 '学校创办'")
    category: str = Field(..., description="分类: 创办|迁址|更名|发展")

    # 文本内容
    summary: str = Field("", description="简要介绍")
    content: str = Field("", description="详细内容（用于数字人讲解）")

    # 关键事实
    facts: List[str] = Field(default_factory=list, description="关键事实列表")

    # 元数据
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    display_order: int = Field(0, description="显示顺序")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "history_001",
                "time": "1958年",
                "title": "学校创办",
                "category": "创办",
                "summary": "XX中学正式成立，位于北京市海淀区",
                "content": "1958年9月，XX中学在北京市海淀区正式成立...",
                "facts": [
                    "创办时间：1958年9月",
                    "首任校长：张三",
                    "首批学生：200人"
                ],
                "display_order": 1
            }
        }


class SchoolHistoryData(BaseModel):
    """校史专题数据容器"""

    school_name: str = Field(..., description="学校名称")
    school_badge_url: Optional[str] = Field(None, description="校徽图片URL")

    # 校史节点列表
    nodes: List[SchoolHistoryNode] = Field(default_factory=list, description="校史节点")

    # 统计信息
    total_nodes: int = Field(0, description="节点总数")
    categories: Dict[str, int] = Field(default_factory=dict, description="各分类节点数")

    def add_node(self, node: SchoolHistoryNode) -> None:
        """添加校史节点"""
        self.nodes.append(node)
        self.total_nodes += 1
        self.categories[node.category] = self.categories.get(node.category, 0) + 1

    def get_nodes_by_category(self, category: str) -> List[SchoolHistoryNode]:
        """按分类获取节点"""
        return [n for n in self.nodes if n.category == category]

    def get_ordered_nodes(self) -> List[SchoolHistoryNode]:
        """按显示顺序获取节点"""
        return sorted(self.nodes, key=lambda x: x.display_order)

    class Config:
        json_schema_extra = {
            "example": {
                "school_name": "XX中学",
                "school_badge_url": "/images/badge.png",
                "nodes": [],
                "total_nodes": 0,
                "categories": {}
            }
        }
