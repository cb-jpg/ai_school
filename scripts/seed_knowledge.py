"""学校知识库灌库脚本：把真实校情内容写入新知识库（data/knowledge）

背景：对话 RAG（knowledge/rag_service.py）检索的是新知识库，
此前库里为空，导致所有学校问题 has_context=False（回答全靠人设兜底）。
本脚本把 campus-knowledge.ts 中经核实的公开资料整理成知识条目，
走与后台 /api/knowledge/create 相同的流程（切分 → 向量化 → 索引）。

用法（服务器上）:
    cd ~/ai_school
    HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 .venv/bin/python scripts/seed_knowledge.py

特性:
- 幂等：按标题去重，重复执行不会灌入重复条目
- 灌完自检：用几个典型问题跑一次检索，验证命中分数
"""

import asyncio
import sys
import time
from pathlib import Path

# HF 离线必须在 import transformers/sentence_transformers 之前生效
import os

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src"))

from open_llm_vtuber.knowledge.crud import get_knowledge_crud  # noqa: E402
from open_llm_vtuber.knowledge.document_processor import (  # noqa: E402
    DocumentProcessor,
)
from open_llm_vtuber.knowledge.models import KnowledgeCategory  # noqa: E402
from open_llm_vtuber.knowledge.vector_store import get_vector_store  # noqa: E402

SCHOOL = "佛山市南海区石实实验学校"

# (title, category, tags, summary, content)
ENTRIES = [
    (
        "学校概况",
        KnowledgeCategory.SCHOOL_INTRO,
        ["学校简介", "寄宿制", "大沥镇", "基本信息"],
        "石实实验学校是一所全日制寄宿制民办实验学校，位于佛山市南海区大沥镇。",
        f"{SCHOOL}（曾用名：佛山市南海区石门实验学校，简称石实实验学校）是一所全日制寄宿制民办实验学校，"
        "始建于1999年，2023年9月经南海区教育局批复更名。学校位于佛山市南海区大沥镇太平体育南路一带，"
        "由大沥镇教育办公室负责日常业务管理。办学理念是让每一个孩子都能成长、成才、成功。"
        "寄宿制办学为学生提供全天候的学习生活环境，教师陪伴和同伴合作是校园文化的重要组成部分。",
    ),
    (
        "办学理念",
        KnowledgeCategory.PHILOSOPHY,
        ["办学理念", "育人目标", "成长成才成功"],
        "学校以让每一个孩子都能成长、成才、成功为办学理念和育人目标。",
        f"{SCHOOL}的办学理念是：让每一个孩子都能成长、成才、成功。这一理念体现学校对学生全面发展的重视，"
        "不仅关注学业成绩，更注重学生的品格养成、能力提升和兴趣发展。"
        "学校通过寄宿制管理和个性化培养相结合的方式，为不同特点的学生提供适合的成长路径。",
    ),
    (
        "校区位置与迁址",
        KnowledgeCategory.SCHOOL_INTRO,
        ["校址", "大沥镇", "太平", "黄岐", "迁址"],
        "学校现址位于大沥镇太平体育南路一带，2019年前后从大沥黄岐迁入。",
        f"{SCHOOL}现址位于佛山市南海区大沥镇太平体育南路一带。根据公开资料，学校于2019年前后完成了"
        "从大沥黄岐到大沥太平新校区的迁址。新校区教学、住宿、体育设施完善，为寄宿制办学提供了"
        "更大的空间和更优质的学习生活环境。",
    ),
    (
        "教学特色",
        KnowledgeCategory.COURSES,
        ["课程", "信息学", "社团", "课后服务", "特色"],
        "学校开设多元课程，重视信息学、艺术、体育等特色发展。",
        f"{SCHOOL}形成了多元化的课程体系：长期重视信息学特长培养，在信息学竞赛和升学方面成绩显著；"
        "积极参与美育和艺术活动，在区级美育赛事中表现优异；将防震减灾科普教育融入日常教学；"
        "课后服务开设体育、艺术、心理等特色社团，为学生提供多样化成长平台。",
    ),
    (
        "校史：1999年创办",
        KnowledgeCategory.HISTORY,
        ["校史", "创办", "1999", "石门实验学校"],
        "公开资料记载学校始建于1999年，原名石门实验学校。",
        f"公开资料记载，{SCHOOL}始建于1999年，最初以佛山市南海区石门实验学校的名称开展办学，"
        "是一所全日制寄宿制民办实验学校。寄宿制办学让学校形成了学习、生活和成长相互融合的校园节奏，"
        "教师陪伴、同伴合作和自主管理成为学校记忆的重要组成部分。",
    ),
    (
        "校史：2019年迁入太平新校区",
        KnowledgeCategory.HISTORY,
        ["校史", "迁址", "2019", "太平", "黄岐"],
        "学校2019年前后完成从大沥黄岐到大沥太平的校区迁移。",
        f"{SCHOOL}在发展过程中从大沥黄岐迁往大沥太平新校区（公开资料记载迁址时间为2019年前后）。"
        "新校区位于大沥镇太平体育南路一带，为教学、住宿、体育和综合实践提供了更大空间。"
        "迁址意味着学校开始用更完整的场景承载学生的学习与生活。",
    ),
    (
        "校史：2023年更名为石实实验学校",
        KnowledgeCategory.HISTORY,
        ["校史", "更名", "2023", "石实", "教育局批复"],
        "2023年9月8日南海区教育局批复学校由石门实验学校更名为石实实验学校。",
        "2023年9月8日，佛山市南海区教育局发布行政许可决定，同意佛山市南海区石门实验学校变更名称为"
        "佛山市南海区石实实验学校，学校仍由大沥镇教育办公室负责日常业务管理。"
        "「石实」既保留了原有的学校记忆，也成为学校面向新阶段的校园标识。",
    ),
    (
        "全国防震减灾科普示范学校",
        KnowledgeCategory.HONORS,
        ["荣誉", "防震减灾", "科普", "示范学校", "安全教育"],
        "学校被评为2023年度全国防震减灾科普示范学校，是佛山市当时唯一获此荣誉的学校。",
        f"{SCHOOL}在防震减灾教育方面特色鲜明。南海区应急管理部门2024年公开报道显示，学校被评为"
        "2023年度全国防震减灾科普示范学校，是佛山市当时唯一获此荣誉的学校。学校开展地震应急演练、"
        "安全科普教育和校园防范工作，把科普知识融入课堂、实践与校园管理。",
    ),
    (
        "信息学特长培养与清北保送",
        KnowledgeCategory.HONORS,
        ["信息学", "保送", "清华", "北大", "竞赛", "特长"],
        "学校长期重视信息学特长培养，近年已有多位学生凭信息学特长保送清北。",
        f"{SCHOOL}长期重视信息学特长培养，形成了公开口碑。南海区政府2025年报道提到，"
        "近年来学校已有13位学生凭信息学特长保送进入清华大学、北京大学等高校。"
        "学校强调兴趣、长期训练与项目实践的结合，让兴趣通过持续训练、问题解决和项目实践变成真正的能力。",
    ),
    (
        "教师成长与班主任育人案例",
        KnowledgeCategory.TEACHERS,
        ["教师", "班主任", "育人", "基本功", "展示交流"],
        "学校教师育人案例入选全国中小学班主任基本功展示交流活动典型经验名单。",
        "南海区教育局2024年公开报道显示，佛山市南海区石实实验学校教师的育人故事、带班方略和主题班会案例"
        "入选全国中小学班主任基本功展示交流活动典型经验名单。案例覆盖育人故事、带班方略和主题班会，"
        "关注班级文化、劳动实践与地方文化传承。",
    ),
    (
        "阅读、美育与社团活动",
        KnowledgeCategory.ACTIVITIES,
        ["阅读", "书香", "美育", "艺术", "社团", "活动"],
        "学校参与南海区书香活动和市级美育赛事，课后服务开设体育、艺术、心理等特色社团。",
        f"{SCHOOL}参与南海区「书香伴我行，好书我推荐」展示活动；2026年市级美育比拼相关报道中，"
        "学校列入一等奖名单。学校课后服务开设体育、艺术、心理等特色社团，"
        "学生可以通过阅读、创作、运动和合作找到适合自己的表达方式。",
    ),
    (
        "学习标兵：陈曼涵的学习方法",
        KnowledgeCategory.STUDENTS,
        ["学习标兵", "陈曼涵", "学习方法", "预习", "错题复盘", "中考"],
        "902班陈曼涵分享预习、课堂投入、课后复习和错题复盘方法。",
        "陈曼涵是南海区教育局2024年公开报道中的佛山市南海区石实实验学校902班学生（中考优秀学生）。"
        "她的学习方法：课前预习，课堂保持投入，课后及时复习，并通过错题复盘找到下一步改进方向，"
        "把每一步学习做成闭环。方法的价值在于让每一次练习都回到自己的理解上。",
    ),
    (
        "学习标兵：邓桢的学习方法",
        KnowledgeCategory.STUDENTS,
        ["学习标兵", "邓桢", "学习方法", "时间管理", "阅读积累", "笔记"],
        "901班邓桢分享阶段任务、阅读积累和笔记整理方法。",
        "邓桢是南海区教育局2024年公开报道中的佛山市南海区石实实验学校901班学生（中考优秀学生）。"
        "她分享的重点是时间管理：把较大的目标拆成阶段任务，再用阅读积累和笔记整理帮助自己持续前进，"
        "为每个目标留出完整而专注的时间。",
    ),
    (
        "学习标兵：陈哲章的信息学成长路径",
        KnowledgeCategory.STUDENTS,
        ["学习标兵", "陈哲章", "信息学", "保送", "北京大学", "2022届"],
        "2022届毕业生陈哲章曾凭信息学特长保送北京大学。",
        "陈哲章是佛山市南海区石实实验学校2022届毕业生。南海区人民政府2025年公开报道提到，"
        "他曾凭信息学特长保送北京大学。他的成长路径说明：兴趣需要长期训练来支撑，"
        "训练需要真实的问题和项目来检验，找到愿意长期投入的方向并一步步做深。",
    ),
    (
        "学校信息速查（校名/创办/校址/管理）",
        KnowledgeCategory.FAQ,
        ["校名", "创办", "校址", "更名", "常见问题"],
        "学校名称、创办时间、校址等高频事实速查。",
        f"问：学校全称是什么？答：{SCHOOL}，曾用名佛山市南海区石门实验学校。"
        "问：学校是什么时候创办的？答：公开资料记载始建于是1999年。"
        "问：学校什么时候更名的？答：2023年9月8日经南海区教育局批复更名。"
        "问：学校在哪里？答：佛山市南海区大沥镇太平体育南路一带（2019年前后从大沥黄岐迁入）。"
        "问：学校是什么性质？答：全日制寄宿制民办实验学校，由大沥镇教育办公室负责日常业务管理。",
    ),
]


async def seed() -> None:
    crud = get_knowledge_crud()
    processor = DocumentProcessor()
    store = get_vector_store()

    existing_titles = {e.title for e in crud.get_all(include_archived=True)}
    created, skipped = 0, 0
    for title, category, tags, summary, content in ENTRIES:
        if title in existing_titles:
            print(f"SKIP (已存在): {title}")
            skipped += 1
            continue
        entry, chunks = await processor.create_manual_entry(
            title=title, content=content, category=category, tags=tags, summary=summary,
            created_by="seed_script",
        )
        crud.create(entry)
        if chunks:
            await asyncio.to_thread(store.index_chunks, entry.id, chunks)
        print(f"OK: {title}（{len(chunks)} 块）")
        created += 1

    print(f"\n灌库完成：新增 {created} 条，跳过 {skipped} 条")


def selfcheck() -> None:
    """用典型问题验证检索命中"""
    from open_llm_vtuber.knowledge.rag_service import get_rag_service

    rag = get_rag_service()
    questions = [
        "学校是什么时候创办的？",
        "学校在哪里？",
        "学校有哪些荣誉？",
        "有没有学习方法的例子？",
    ]
    print("\n=== 检索自检 ===")
    for q in questions:
        docs = asyncio.run(rag.search(q, top_k=3))
        if docs:
            tops = "；".join(f"{d['title']}({d['score']:.2f})" for d in docs[:2])
            print(f"[命中] {q} → {tops}")
        else:
            print(f"[未命中] {q}")


if __name__ == "__main__":
    start = time.time()
    asyncio.run(seed())
    selfcheck()
    print(f"\n总耗时 {time.time() - start:.1f}s")
