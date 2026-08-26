# 知识库后台功能验证核对清单（§7）

> 运行前提：后端 `run_server.py`（:12393）已启动；probe_frontend_chain 另需前端 `vite --mode web`（:3000）。
> 复跑方式：`.venv/Scripts/python.exe verification/<脚本名>`（在仓库根目录）。
> 控制台中文乱码为 GBK 显示问题，不影响判定；看每行 PASS/FAIL 与末尾 RESULT。

## 验证结果总览（2026-08-26，全部通过）

| §7 功能点 | 验证脚本 | 结果 |
|---|---|---|
| 管理员登录（含首启引导） | probe_health.py、probe_frontend_chain.py | ✅ 401 拦截 / 引导密码 / token / 角色 |
| 批量上传与处理状态 | probe_admin_features.py §5 | ✅ 2 文件全部 completed |
| 切分与向量化状态 | probe_admin_features.py §1 | ✅ 1200 字→3 块→indexed→检索命中 |
| 分类 / 标签 / 关键词 | probe_admin_features.py §2 | ✅ 分类过滤 + 标签更新 |
| 版本与更新记录 | probe_admin_features.py §3 | ⚠️ 部分（见下） |
| 未命中 / 低置信问题查看 | probe_rag_endpoints.py、probe_rag_service 单测 | ✅ 11 断言 + 15 断言 |
| 索引重建 | probe_admin_features.py §4 | ✅ 单条 + 全库 bulk + 重建后检索仍命中 |
| 网页资料添加（URL） | test_url_processing.py | ✅ 6 断言（file:// 拒绝 / PDF 提示 / 实抓） |
| 前端全链路（页面→代理→后端） | probe_frontend_chain.py | ✅ 9 断言 |

## 已知缺失 / 待决事项

1. **版本管理不完整**：条目模型无 version 字段、无历史版本列表。
   现状仅 `updated_at` 时间戳（更新后前移已验证）。§7 若要求完整版本管理需另开任务。
2. **孤儿向量文件**：`data/knowledge/vectors/` 存在 4 个早期测试遗留文件
   （3ffe4296 / 8cb96e94 / a1da5b66 / d96c8eb5），对应条目已不存在。
   RAG 检索按条目状态过滤不受影响；待确认后删除。
3. **预存前端类型错误**：后台旧页面存在 Chakra UI v2→v3 写法问题
   （toaster `status`→`type` 等），运行时基本无感；已约定验收后单独 `fix:` 批次处理。

## 脚本清单

| 脚本 | 断言数 | 覆盖 |
|---|---|---|
| probe_health.py | 5 | 健康 + 两段式登录引导 |
| test_rag_service.py | 15 | RAG 触发词 / 检索 / 未命中 / 低置信 / 增强 prompt（离线单测） |
| probe_rag_endpoints.py | 11 | 路由顺序 / 未命中低置信真数据 / stats / 详情 / 401 |
| test_url_processing.py | 6 | URL 抓取边界（scheme / 类型 / 超时） |
| probe_frontend_chain.py | 9 | 页面 / 代理 / 登录 / 知识库端点 / 401 |
| probe_admin_features.py | 18 | §7 核心：切分向量化 / 分类标签 / 更新记录 / 索引重建 / 批量上传（自清理） |
