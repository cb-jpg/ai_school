/**
 * 学校官网门户（2026-09-20 需求 #5）内容数据
 *
 * ⚠️ 数据来源与边界：
 * - 照片/荣誉/优秀学生/联系方式：全部来自校方提供的真实资料（数据清单、2026 新实景照片、
 *   宣纸折页），与 App 内知识库同源。
 * - 「学校新闻」「公告与通知」目前为**占位示例**（条目基于知识库真实事件，日期可能不精确），
 *   正式上线前请校方宣传审核替换。其中 n1/n4/n6 已附上核实的政府/媒体直链，可点击跳转；
 *   其余条目暂无直链（公众号永久链接需校方在微信内复制提供），渲染为不可点击。
 * - 未来接入学校通知（需求 #5 规划）：服务器侧由公众号同步/后台发布（三期，见
 *   docs/微信公众号接入说明.md 落地节奏），前端只需把本文件的静态数组替换为
 *   `GET /api/portal/content` 之类的接口数据，页面结构不变。字段已按接口形态设计。
 */

import campusArtFestival from '@/assets/school/campus-art-festival.jpg';
import campusChoirRoom from '@/assets/school/campus-choir-room.jpg';
import campusGate from '@/assets/school/campus-gate.jpg';
import campusGym from '@/assets/school/campus-gym.jpg';
import campusInformaticsLab from '@/assets/school/campus-informatics-lab.jpg';
import campusTeachingBuilding from '@/assets/school/campus-teaching-building.jpg';
import campusTrack from '@/assets/school/campus-track.jpg';
import campusVexLab from '@/assets/school/campus-vex-lab.jpg';
import honorFangzhen from '@/assets/school/honor-fangzhen.jpg';
import honorGaozhiliang from '@/assets/school/honor-gaozhiliang.jpg';
import honorJiankang from '@/assets/school/honor-jiankang.jpg';
import honorJiaoshi from '@/assets/school/honor-jiaoshi.jpg';
import honorKunpeng from '@/assets/school/honor-kunpeng.jpg';
import honorXinxixue from '@/assets/school/honor-xinxixue.jpg';
import honorYuedu from '@/assets/school/honor-yuedu.jpg';
import stuChenManhan from '@/assets/school/stu-chen-manhan.jpg';
import stuChenZhezhang from '@/assets/school/stu-chen-zhezhang.jpg';

export interface NewsItem {
  id: string;
  title: string;
  /** YYYY-MM-DD 或 YYYY-MM（占位数据允许只到月） */
  date: string;
  category: '校园新闻' | '荣誉喜报' | '媒体聚焦';
  /** 文章详情链接。已核实的政府/媒体直链（nanhai.gov.cn、南方+）已填；
   * 公众号文章永久链接需在微信内复制，待校方提供（B 路线）。
   * 无 url 的条目渲染为不可点击。 */
  url?: string;
  /** 链接来源名称（如"南方+"、"南海区教育局"） */
  source?: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  date: string;
  /** 面向对象（面向家长学生，需求 #5） */
  audience: '全体' | '家长' | '学生';
  url?: string;
}

/** 学校新闻（占位示例，条目取自知识库真实事件；上线前校方审核替换） */
export const PORTAL_NEWS: NewsItem[] = [
  {
    id: 'n1',
    title: '佛山唯一！13名学子凭信息学特长保送清华大学、北京大学',
    date: '2025-06-30',
    category: '荣誉喜报',
    url: 'https://static.nfnews.com/content/202506/30/c11454630.html',
    source: '南方+（南方日报）',
  },
  {
    id: 'n2',
    title: '石实实验学校正式复办小学，一年级计划招生160人',
    date: '2025-04',
    category: '校园新闻',
  },
  {
    id: 'n3',
    title: '获评首批全国健康学校建设单位',
    date: '2025-05',
    category: '荣誉喜报',
  },
  {
    id: 'n4',
    title: '获评国家防震减灾科普示范学校（全市唯一）',
    date: '2024-02-25',
    category: '荣誉喜报',
    url: 'https://www.nanhai.gov.cn/fsnhq/bmdh/zfbm/qyjj/xxgkml/gzdt/content/post_5908947.html',
    source: '南海区应急管理局',
  },
  {
    id: 'n5',
    title: '25周年校庆晚会举行，两万余名校友共叙情谊',
    date: '2025-11',
    category: '校园新闻',
  },
  {
    id: 'n6',
    title: '南海区教育局媒体系列报道：扬长教育、人人出彩',
    date: '2026-04',
    category: '媒体聚焦',
    url: 'https://www.nanhai.gov.cn/fsnhq/bmdh/zfbm/qjyj/xxgkml/gzdt/content/post_6945094.html',
    source: '南海区教育局',
  },
];

/** 公告与通知（占位示例：正式通知流未来由后台发布/公众号同步接入） */
export const PORTAL_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'a1',
    title: '2026年秋季学期开学返校安排及注意事项',
    date: '2026-08-25',
    audience: '全体',
  },
  {
    id: 'a2',
    title: '南海区优秀学生、优秀学生干部评选结果公示',
    date: '2026-03-10',
    audience: '学生',
  },
  {
    id: 'a3',
    title: '校园开放日暨招生咨询活动安排',
    date: '2026-04-12',
    audience: '家长',
  },
  {
    id: 'a4',
    title: '期中考试日程与诚信考试须知',
    date: '2026-04-20',
    audience: '学生',
  },
  {
    id: 'a5',
    title: '校车线路与课后服务报名通知',
    date: '2026-02-18',
    audience: '家长',
  },
];

/** 校园风光（2026 校方实景照片） */
export const CAMPUS_PHOTOS: Array<{ src: string; caption: string }> = [
  { src: campusGate, caption: '学校大门' },
  { src: campusTrack, caption: '田径运动场' },
  { src: campusTeachingBuilding, caption: '教学楼' },
  { src: campusGym, caption: '体育馆' },
  { src: campusVexLab, caption: 'VEX机器人专训室' },
  { src: campusInformaticsLab, caption: '信息学专训室' },
  { src: campusChoirRoom, caption: '合唱室' },
  { src: campusArtFestival, caption: '体艺节' },
];

/** 荣誉墙（牌匾实拍，说明文字与 App 专题页一致） */
export const HONOR_ITEMS: Array<{ src: string; title: string; caption: string }> = [
  { src: honorJiankang, title: '首批全国健康学校建设单位', caption: '国家级' },
  { src: honorFangzhen, title: '国家防震减灾科普示范学校', caption: '国家级 · 全市唯一' },
  { src: honorXinxixue, title: '广东省青少年信息学竞赛优秀组织单位', caption: '省级' },
  { src: honorYuedu, title: '广东省中小学最美阅读空间', caption: '省级 · 博文致远图书馆' },
  { src: honorJiaoshi, title: '南海区教育发展研究中心首个基地学校', caption: '区级 · 教师发展中心' },
  { src: honorKunpeng, title: '南海区英才培养先进单位"鲲鹏奖"', caption: '区级' },
  { src: honorGaozhiliang, title: '教学质量高质量发展先进学校', caption: '区级' },
];

/** 优秀学生风采（真实学生，与知识库/App 专题页一致） */
export const FEATURED_STUDENTS: Array<{ src: string; name: string; desc: string }> = [
  { src: stuChenZhezhang, name: '陈哲章', desc: '信息学奥赛金牌 · 保送北京大学' },
  { src: stuChenManhan, name: '陈曼涵', desc: '2024届902班 · 南海区优秀学生' },
];

/** 校长寄语/办学理念（来自知识库：校训及办学理念） */
export const SCHOOL_MOTTO_LINES = ['扬长教育、人人出彩', '以爱治校、尊重你我', '任重道远、毋忘奋斗'];

/** 联系方式（与知识库「学校联系方式」条目一致；官方现用号码建议向校方核实） */
export const SCHOOL_CONTACT = {
  address: '佛山市南海区大沥镇太平社区体育南路20号',
  phone: '0757-85930080',
};
