"""
学校知识库管理后台 API

提供知识库 CRUD、文档上传、统计查询等接口。
"""

from .app import create_app

__all__ = ['create_app']
