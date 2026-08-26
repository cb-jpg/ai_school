/**
 * 校园知识专题 API 服务
 * 从后端获取校史、学校成就、学习标兵数据
 */

interface CampusStat {
  value: string;
  label: string;
}

interface CampusSource {
  title: string;
  publisher: string;
  publishedAt: string;
  url: string;
}

interface CampusKnowledgeSection {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  facts: string[];
  narration: string;
}

interface CampusTopic {
  id: 'history' | 'achievements' | 'role-models';
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

interface SchoolInfo {
  name: string;
  formerName: string;
  shortName: string;
  slogan: string;
  updatedAt: string;
  disclaimer: string;
}

// API 基础 URL - 从环境变量或使用相对路径
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * 获取学校信息
 */
async function fetchSchoolInfo(): Promise<SchoolInfo> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/topics/`);
    const data = await response.json();
    return {
      name: data.school_name || '佛山市南海区石实实验学校',
      formerName: '佛山市南海区石门实验学校',
      shortName: '石实实验学校',
      slogan: '让每一个孩子都能成长、成才、成功',
      updatedAt: '2026-08-02',
      disclaimer: '校史与成就依据公开资料整理；1999年始建、2019年前后迁址等基础信息参照用户提供的公开百科页面。学习标兵内容来自南海区政府、教育局公开报道，仅保留公开姓名和成长方法。',
    };
  } catch (error) {
    console.error('Failed to fetch school info:', error);
    // 返回默认值
    return {
      name: '佛山市南海区石实实验学校',
      formerName: '佛山市南海区石门实验学校',
      shortName: '石实实验学校',
      slogan: '让每一个孩子都能成长、成才、成功',
      updatedAt: '2026-08-02',
      disclaimer: '校史与成就依据公开资料整理',
    };
  }
}

/**
 * 获取校史专题数据
 */
async function fetchHistoryTopic(): Promise<CampusTopic> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/topics/history`);
    const data = await response.json();

    // 转换后端数据为前端格式
    const sections: CampusKnowledgeSection[] = (data.nodes || []).map((node: any) => ({
      id: node.id,
      eyebrow: `${node.time} · ${node.category}`,
      title: node.title,
      summary: node.summary,
      facts: node.facts || [],
      narration: node.content,
    }));

    return {
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
      sections,
      sources: [
        {
          title: '关于同意佛山市南海区石门实验学校变更名称的行政许可决定',
          publisher: '佛山市南海区教育局',
          publishedAt: '2023-09-08',
          url: 'https://www.nanhai.gov.cn/fsnhq/bmdh/zfbm/qjyj/xxgkml/xzzf/xzxk/content/post_5765434.html',
        },
      ],
    };
  } catch (error) {
    console.error('Failed to fetch history topic:', error);
    throw error;
  }
}

/**
 * 获取学校成就专题数据
 */
async function fetchAchievementsTopic(): Promise<CampusTopic> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/topics/achievements`);
    const data = await response.json();

    // 转换后端数据为前端格式
    const sections: CampusKnowledgeSection[] = (data.achievements || []).map((item: any) => ({
      id: item.id,
      eyebrow: `${item.year || ''} · ${item.category || ''}`,
      title: item.title,
      summary: item.summary,
      facts: Object.entries(item.facts || {}).map(([key, value]) => `${key}：${value}`),
      narration: item.content,
    }));

    // 收集所有来源
    const sources: CampusSource[] = [];
    (data.achievements || []).forEach((item: any) => {
      if (item.sources) {
        sources.push(...item.sources);
      }
    });

    return {
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
      sections,
      sources,
    };
  } catch (error) {
    console.error('Failed to fetch achievements topic:', error);
    throw error;
  }
}

/**
 * 获取学习标兵专题数据
 */
async function fetchRoleModelsTopic(): Promise<CampusTopic> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/topics/students`);
    const data = await response.json();

    // 转换后端数据为前端格式
    const sections: CampusKnowledgeSection[] = (data.students || []).map((student: any) => {
      // 将方法对象转换为描述文本
      const methodDescriptions = Object.entries(student.methods || {})
        .filter(([_, methods]: [string, any]) => methods.length > 0)
        .map(([category, methods]: [string, any]) => {
          const methodList = Array.isArray(methods) ? methods.join('、') : methods;
          return `${category}：${methodList}`;
        });

      return {
        id: student.id,
        eyebrow: `${student.grade || ''} · ${student.class_name ? student.class_name.replace('班', '') + '班' : '毕业生'}`,
        title: `${student.name}：${student.summary.split('，')[0]}`,
        summary: student.summary,
        facts: [
          `公开报道身份：${student.class_name || student.grade}学生`,
          ...methodDescriptions.slice(0, 3),
        ],
        narration: student.growth_story,
      };
    });

    // 收集所有来源
    const sources: CampusSource[] = [];
    (data.students || []).forEach((student: any) => {
      if (student.sources) {
        sources.push(...student.sources);
      }
    });

    return {
      id: 'role-models',
      navLabel: '学习标兵',
      eyebrow: 'STUDENT ROLE MODELS',
      title: '从公开报道中看见可执行的学习方法',
      subtitle: '选取两位中考学习方法报道学生与一位公开报道的升学案例，仅呈现公开姓名、届次和方法，不展示个人分数。',
      statusLabel: '公开报道整理',
      notice: '以下内容来自南海区政府或教育局公开报道，页面仅保留公开姓名、届次和学习成长方法；不展示分数、联系方式等隐私信息。',
      accent: '#002FA7',
      softAccent: '#E8EEFF',
      stats: [
        { value: `${data.students?.length || 3} 位`, label: '公开报道学生案例' },
        { value: '2024', label: '中考学习方法报道' },
        { value: '2025', label: '北大保送报道' },
      ],
      introNarration: '欢迎来到学习标兵展页。这里选取石实实验学校公开报道中的三位学生案例：两位来自南海区教育局发布的中考学习方法报道，另一位是南海区人民政府报道的二零二二届毕业生陈哲章。页面只呈现公开姓名、届次和学习成长方法，不把分数或个人隐私放进展示内容。',
      sections,
      sources,
    };
  } catch (error) {
    console.error('Failed to fetch role models topic:', error);
    throw error;
  }
}

/**
 * 获取指定专题数据
 */
export async function fetchCampusTopic(topicId: 'history' | 'achievements' | 'role-models'): Promise<CampusTopic> {
  switch (topicId) {
    case 'history':
      return fetchHistoryTopic();
    case 'achievements':
      return fetchAchievementsTopic();
    case 'role-models':
      return fetchRoleModelsTopic();
    default:
      throw new Error(`Unknown topic ID: ${topicId}`);
  }
}

/**
 * 获取所有专题列表
 */
export async function fetchCampusTopics(): Promise<CampusTopic[]> {
  try {
    const [history, achievements, roleModels] = await Promise.all([
      fetchHistoryTopic(),
      fetchAchievementsTopic(),
      fetchRoleModelsTopic(),
    ]);

    return [history, achievements, roleModels];
  } catch (error) {
    console.error('Failed to fetch campus topics:', error);
    throw error;
  }
}

/**
 * 获取学校基本信息
 */
export async function fetchDemoSchool(): Promise<SchoolInfo> {
  return fetchSchoolInfo();
}
