export type CampusTopicId = 'history' | 'achievements' | 'role-models';

export interface CampusStat {
  value: string;
  label: string;
}

export interface CampusSource {
  title: string;
  publisher: string;
  publishedAt: string;
  url: string;
}

export interface CampusKnowledgeSection {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  facts: string[];
  narration: string;
}

export interface CampusTopic {
  id: CampusTopicId;
  navLabel: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  notice: string;
  accent: string;
  softAccent: string;
  stats: CampusStat[];
  introNarration: string;
  sections: CampusKnowledgeSection[];
  sources: CampusSource[];
}

export const demoSchool = {
  name: '佛山市南海区石实实验学校',
  formerName: '佛山市南海区石门实验学校',
  shortName: '石实实验学校',
  slogan: '让每一个孩子都能成长、成才、成功',
  updatedAt: '2026-08-02',
  disclaimer: '校史与成就依据公开资料整理；1999年始建、2019年前后迁址等基础信息参照用户提供的公开百科页面。学习标兵内容来自南海区政府、教育局公开报道，仅保留公开姓名和成长方法。',
};

const officialSources = {
  rename: {
    title: '关于同意佛山市南海区石门实验学校变更名称的行政许可决定',
    publisher: '佛山市南海区教育局',
    publishedAt: '2023-09-08',
    url: 'https://www.nanhai.gov.cn/fsnhq/bmdh/zfbm/qjyj/xxgkml/xzzf/xzxk/content/post_5765434.html',
  },
  earthquake: {
    title: '持续推进示范创建 深化校园地震防范',
    publisher: '佛山市南海区应急管理局',
    publishedAt: '2024-02-25',
    url: 'https://www.nanhai.gov.cn/fsnhq/bmdh/zfbm/qyjj/xxgkml/gzdt/content/post_5908947.html',
  },
  studentMethods: {
    title: '好成绩怎么来的？经验在这里',
    publisher: '佛山市南海区教育局',
    publishedAt: '2024-07-18',
    url: 'https://www.nanhai.gov.cn/fsnhq/bmdh/zfbm/qjyj/xxgkml/gzdt/content/post_6047755.html',
  },
  teacherGrowth: {
    title: '南海两名教师经验上榜',
    publisher: '佛山市南海区教育局',
    publishedAt: '2024-01-24',
    url: 'https://www.nanhai.gov.cn/fsnhq/bmdh/zfbm/qjyj/xxgkml/gzdt/content/post_5888985.html',
  },
  reading: {
    title: '学生花式荐书！南海区举办第七届中小学生“书香伴我行，好书我推荐”展示活动',
    publisher: '佛山市南海区人民政府',
    publishedAt: '2023-05-12',
    url: 'https://www.nanhai.gov.cn/fsnhq/zwgk/zwdt/gzdt/content/post_5606471.html',
  },
  arts: {
    title: '市级美育大比拼，南海区19个一等奖拿下“半壁江山”！',
    publisher: '佛山市南海区教育局',
    publishedAt: '2026-07-08',
    url: 'https://www.nanhai.gov.cn/fsnhq/zwgk/zwdt/gzdt/content/post_7189407.html',
  },
  information: {
    title: '喜讯！大沥又一位学子保送北大！',
    publisher: '佛山市南海区人民政府',
    publishedAt: '2025-07-04',
    url: 'https://www.nanhai.gov.cn/fsnhq/zwgk/zwdt/zjyw/content/post_6632746.html',
  },
  afterSchool: {
    title: '均衡筑基，美好赋能，南海绘就义务教育优质均衡“国字号”答卷',
    publisher: '佛山市南海区教育局',
    publishedAt: '2026-01-14',
    url: 'https://www.nanhai.gov.cn/fsnhq/bmdh/zfbm/qjyj/xxgkml/gzdt/content/post_6945094.html',
  },
  publicReference: {
    title: '佛山市南海区石实实验学校（用户提供的公开百科页面）',
    publisher: '公开百科资料',
    publishedAt: '页面信息，待校方档案进一步核验',
    url: 'https://baike.baidu.com/item/佛山市南海区石实实验学校',
  },
};

export const campusTopics: CampusTopic[] = [
  {
    id: 'history',
    navLabel: '校史',
    eyebrow: 'SCHOOL HISTORY',
    title: '从石门实验学校，到石实实验学校',
    subtitle: '沿着创办、迁址和正式更名三个节点，了解这所大沥寄宿制学校的发展轨迹。',
    statusLabel: '公开资料整理',
    notice: '2023年更名信息来自南海区教育局行政许可；1999年始建、2019年前后迁至太平新校区等基础信息参照用户提供的公开百科页面。',
    accent: '#002FA7',
    softAccent: '#E8EEFF',
    stats: [
      { value: '1999', label: '公开资料记载始建' },
      { value: '2019', label: '迁入太平新校区' },
      { value: '2023', label: '正式更名石实实验学校' },
    ],
    introNarration: '欢迎来到佛山市南海区石实实验学校校史展页。学校原名佛山市南海区石门实验学校，南海区教育局于二零二三年九月八日批复更名为佛山市南海区石实实验学校，并明确学校仍由大沥镇教育办公室负责日常业务管理。根据用户提供的公开百科资料，学校始建于一九九九年，并在二零一九年前后由大沥黄岐迁至大沥太平新校区。',
    sections: [
      {
        id: 'history-1999',
        eyebrow: '1999 · 创办',
        title: '从寄宿制实验办学起步',
        summary: '公开资料记载，学校始建于1999年，原名石门实验学校，长期服务于大沥及周边家庭。',
        facts: [
          '原校名：佛山市南海区石门实验学校',
          '办学类型：全日制寄宿制民办实验学校',
          '办学管理归属大沥镇教育体系',
        ],
        narration: '公开资料记载，石实实验学校始建于一九九九年，最初以石门实验学校的名称开展办学。寄宿制办学让学校形成了学习、生活和成长相互融合的校园节奏，也让教师陪伴、同伴合作和自主管理成为学校记忆中的重要部分。',
      },
      {
        id: 'history-2019',
        eyebrow: '2019 · 迁址',
        title: '从黄岐走进太平新校区',
        summary: '学校完成从大沥黄岐到大沥太平的校区迁移，校园空间和体育、教学配套进一步扩展。',
        facts: [
          '用户提供的公开资料记载迁址时间为2019年',
          '现校区位于大沥镇太平体育南路一带',
          '官方公开文件持续记录太平校区建设与运行',
        ],
        narration: '在发展过程中，学校从大沥黄岐迁往大沥太平新校区。新校区为教学、住宿、体育和综合实践提供了更大的空间。对学生来说，迁址不只是校园位置的变化，也意味着学校开始用更完整的场景承载学习与生活。',
      },
      {
        id: 'history-2023',
        eyebrow: '2023 · 更名',
        title: '“石实”成为新的学校标识',
        summary: '南海区教育局正式批准学校由“石门实验学校”变更为“石实实验学校”。',
        facts: [
          '批复时间：2023年9月8日',
          '现用全称：佛山市南海区石实实验学校',
          '日常业务管理仍由大沥镇教育办公室负责',
        ],
        narration: '二零二三年九月八日，南海区教育局正式批复学校更名。石门实验学校变更为石实实验学校，“石实”既保留了原有的学校记忆，也成为面向新阶段的校园标识。名称变化的背后，是学校继续深耕大沥教育、服务学生成长的延续。',
      },
      {
        id: 'history-future',
        eyebrow: '持续发展 · 育人',
        title: '把校园变成更丰富的成长现场',
        summary: '从书香活动到课后特色社团，学校持续拓展阅读、体育、艺术、心理与实践学习场景。',
        facts: [
          '参与南海区书香校园与综合素养活动',
          '课后服务覆盖体育、艺术和心理等特色社团',
          '以社团、阅读和实践拓展成长场景',
        ],
        narration: '学校的发展不只体现在校园建筑和名称上，也体现在每天发生的教育细节里。公开报道显示，石实实验学校参与南海区书香校园和综合素养活动，并开设体育、艺术、心理等课后特色社团。校园因此不只是上课的地方，也成为阅读、运动、表达和发现兴趣的成长现场。',
      },
    ],
    sources: [officialSources.rename, officialSources.earthquake, officialSources.afterSchool, officialSources.publicReference],
  },
  {
    id: 'achievements',
    navLabel: '学校成就',
    eyebrow: 'SCHOOL ACHIEVEMENTS',
    title: '在科普、育人、美育与成长中留下成果',
    subtitle: '从全国防震减灾科普示范校，到教师成长、阅读活动与学生发展，看看石实的多元办学成果。',
    statusLabel: '公开资料整理',
    notice: '以下项目均来自南海区政府、教育局或相关部门公开报道；学生姓名和个人成绩明细已做隐私处理。',
    accent: '#002FA7',
    softAccent: '#E8EEFF',
    stats: [
      { value: '全国', label: '防震减灾科普示范校' },
      { value: '13 位', label: '报道所称信息学特长保送清北学子' },
      { value: '一等奖', label: '2026年美育报道入选' },
    ],
    introNarration: '现在看到的是石实实验学校成就展页。学校的成果不只是一张成绩单，也包括面向真实生活的安全教育、长期积累的教师专业成长、阅读与美育活动，以及信息学等特色发展方向。下面的内容都来自公开报道，涉及学生个人的地方只保留经过概括的集体信息。',
    sections: [
      {
        id: 'achievement-earthquake',
        eyebrow: '全国示范 · 科普安全',
        title: '把防震减灾教育做成校园日常',
        summary: '学校被评为2023年度全国防震减灾科普示范学校，也是佛山市当时唯一获此荣誉的学校。',
        facts: [
          '入选2023年度全国防震减灾科普示范学校',
          '开展地震应急演练与安全教育活动',
          '将科普知识融入课堂、实践与校园管理',
        ],
        narration: '石实实验学校在防震减灾教育方面形成了鲜明特色。南海区应急管理部门公开报道显示，学校被评为二零二三年度全国防震减灾科普示范学校，并介绍了学校开展应急演练、安全科普和校园防范工作的做法。对学生而言，安全教育不是一次活动，而是需要理解、练习并真正能够行动的生活能力。',
      },
      {
        id: 'achievement-information',
        eyebrow: '信息学 · 长期培养',
        title: '让兴趣成为持续发展的方向',
        summary: '公开报道提到，学校长期重视信息学特长培养，近年来已有多位学生凭信息学特长进入清华大学、北京大学等高校。',
        facts: [
          '2025年公开报道提到近年来已有13位相关学生保送清北',
          '强调兴趣、长期训练与项目实践的结合',
          '页面不展示未成年人的姓名、班级和具体分数',
        ],
        narration: '在信息学方向，石实实验学校形成了长期培养的公开口碑。南海区政府报道提到，学校近年来已有多位学生凭信息学特长保送进入清华大学、北京大学等高校。这里更值得关注的不是一个数字，而是兴趣如何通过持续训练、问题解决和项目实践，逐步变成真正的能力。',
      },
      {
        id: 'achievement-teachers',
        eyebrow: '教师成长 · 育人案例',
        title: '教师的专业成长，最终回到学生身上',
        summary: '学校教师的育人故事、班级建设方略和主题班会案例进入全国中小学班主任基本功展示交流活动典型经验名单。',
        facts: [
          '教师典型经验进入全国展示交流活动名单',
          '案例覆盖育人故事、带班方略和主题班会',
          '关注班级文化、劳动实践与地方文化传承',
        ],
        narration: '学校成就的另一面，是教师持续学习和反思的过程。南海区教育局公开报道显示，石实实验学校教师的育人故事、带班方略和主题班会案例入选全国中小学班主任基本功展示交流活动典型经验。好的教育成果，往往先从教师愿意研究学生、理解班级和改进课堂开始。',
      },
      {
        id: 'achievement-arts-reading',
        eyebrow: '阅读 · 美育 · 社团',
        title: '让每个孩子找到愿意投入的舞台',
        summary: '阅读推荐、书香活动和美育赛事，为学生提供表达、审美、合作与展示的机会。',
        facts: [
          '石实实验学校参加南海区“书香伴我行，好书我推荐”活动',
          '2026年南海市级美育比拼报道列入一等奖名单',
          '课后服务开设体育、艺术、心理等特色社团',
        ],
        narration: '阅读和美育让成长拥有更多入口。公开报道显示，石实实验学校参与南海区书香活动，并在二零二六年市级美育比拼相关报道中列入一等奖名单。同时，学校课后服务开设体育、艺术和心理等特色社团。学生可以通过阅读、创作、运动和合作，找到适合自己的表达方式。',
      },
    ],
    sources: [officialSources.earthquake, officialSources.information, officialSources.teacherGrowth, officialSources.reading, officialSources.arts, officialSources.afterSchool],
  },
  {
    id: 'role-models',
    navLabel: '学习标兵',
    eyebrow: 'STUDENT ROLE MODELS',
    title: '从公开报道中看见可执行的学习方法',
    subtitle: '选取两位中考学习方法报道学生与一位公开报道的升学案例，仅呈现公开姓名、届次和方法，不展示个人分数。',
    statusLabel: '公开报道整理',
    notice: '以下内容来自南海区政府或教育局公开报道，页面仅保留公开姓名、届次和成长方法；不展示分数、联系方式等隐私信息。',
    accent: '#002FA7',
    softAccent: '#E8EEFF',
    stats: [
      { value: '3 位', label: '公开报道学生案例' },
      { value: '2024', label: '中考学习方法报道' },
      { value: '2025', label: '北大保送报道' },
    ],
    introNarration: '欢迎来到学习标兵展页。这里选取石实实验学校公开报道中的三位学生案例：两位来自南海区教育局发布的中考学习方法报道，另一位是南海区人民政府报道的二零二二届毕业生陈哲章。页面只呈现公开姓名、届次和学习成长方法，不把分数或个人隐私放进展示内容。',
    sections: [
      {
        id: 'student-chen-manhan',
        eyebrow: '2024 · 中考优秀学生',
        title: '陈曼涵：把每一步学习做成闭环',
        summary: '南海区教育局公开报道中的石实实验学校902班学生，分享预习、课堂投入、课后复习和错题复盘方法。',
        facts: [
          '公开报道身份：石实实验学校902班学生',
          '方法关键词：预习、课堂投入、课后复习',
          '把错题复盘作为下一轮学习的起点',
        ],
        narration: '陈曼涵是南海区教育局公开报道中的石实实验学校九零二班学生。报道分享了她的学习方法：课前预习，课堂保持投入，课后及时复习，并通过错题复盘找到下一步改进方向。这个方法的价值不在于把时间排得很满，而在于让每一次练习都能回到自己的理解上。',
      },
      {
        id: 'student-deng-zhen',
        eyebrow: '2024 · 中考优秀学生',
        title: '邓桢：用时间管理给目标留出位置',
        summary: '南海区教育局公开报道中的石实实验学校901班学生，分享阶段任务、阅读积累和笔记整理方法。',
        facts: [
          '公开报道身份：石实实验学校901班学生',
          '用阶段任务拆解较长期的学习目标',
          '通过阅读积累与笔记整理巩固理解',
        ],
        narration: '邓桢是同一篇南海区教育局公开报道中的石实实验学校九零一班学生。她分享的重点是时间管理：把较大的目标拆成阶段任务，再用阅读积累和笔记整理帮助自己持续前进。对同学们来说，这是一种可以立即练习的能力——先看清今天要完成什么，再为它留出完整而专注的时间。',
      },
      {
        id: 'student-chen-zhezhang',
        eyebrow: '2022届 · 公开升学案例',
        title: '陈哲章：从信息学兴趣走向长期训练',
        summary: '南海区人民政府公开报道的石实实验学校2022届毕业生，曾因信息学特长保送北京大学。',
        facts: [
          '公开报道身份：石实实验学校2022届毕业生',
          '公开报道结果：曾因信息学特长保送北京大学',
          '成长关键词：兴趣、训练、项目实践',
        ],
        narration: '陈哲章是石实实验学校二零二二届毕业生。南海区人民政府公开报道提到，他曾凭信息学特长保送北京大学。这个案例让我们看到，兴趣需要长期训练来支撑，训练又需要真实的问题和项目来检验。比起追逐一个结果，更重要的是找到愿意长期投入的方向，并一步步把它做深。',
      },
    ],
    sources: [officialSources.studentMethods, officialSources.information],
  },
];

export const campusTopicMap = Object.fromEntries(
  campusTopics.map((topic) => [topic.id, topic]),
) as Record<CampusTopicId, CampusTopic>;

export const isCampusTopicId = (value: string): value is CampusTopicId => (
  campusTopics.some((topic) => topic.id === value)
);
