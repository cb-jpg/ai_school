/**
 * 校园专题页图片配置
 * 素材来源：校方《数据清单》——《芝兰玉树》25周年画册（学生头像）、2024宣纸折页（校园照片）、
 * 荣誉牌匾照片、25周年校庆照片；已裁切压缩后打包进前端（assets/school/）。
 * 匹配策略：按 section 标题关键词匹配（本地静态数据与后端 API 数据的 id 可能不一致，标题更稳定）。
 */
import bannerHistory from '@/assets/school/banner-history.jpg';
import campusGate from '@/assets/school/campus-gate.jpg';
import campusTrack from '@/assets/school/campus-track.jpg';
import honorFangzhen from '@/assets/school/honor-fangzhen.jpg';
import honorGaozhiliang from '@/assets/school/honor-gaozhiliang.jpg';
import honorJiankang from '@/assets/school/honor-jiankang.jpg';
import honorJiaoshi from '@/assets/school/honor-jiaoshi.jpg';
import honorKunpeng from '@/assets/school/honor-kunpeng.jpg';
import honorXinxixue from '@/assets/school/honor-xinxixue.jpg';
import honorYuedu from '@/assets/school/honor-yuedu.jpg';
import stuChenManhan from '@/assets/school/stu-chen-manhan.jpg';
import stuChenZhezhang from '@/assets/school/stu-chen-zhezhang.jpg';
import { CampusTopicId } from './campus-knowledge';

/** 专题页头部横图（标题下方、统计行上方） */
export const topicBanners: Partial<Record<CampusTopicId, string>> = {
  intro: campusGate,
  history: bannerHistory,
  achievements: honorGaozhiliang,
};

export interface SectionImage {
  src: string;
  /** portrait=人物头像（圆形小图随文） card=牌匾/场景（横向大图） */
  variant: 'portrait' | 'card';
  caption?: string;
}

const sectionRules: Array<{ keywords: string[]; image: SectionImage }> = [
  {
    keywords: ['陈曼涵'],
    image: { src: stuChenManhan, variant: 'portrait', caption: '2024届902班 · 《芝兰玉树》画册' },
  },
  {
    keywords: ['陈哲章'],
    image: { src: stuChenZhezhang, variant: 'portrait', caption: '信息学奥赛金牌 · 保送北京大学' },
  },
  {
    keywords: ['防震减灾', '安全'],
    image: { src: honorFangzhen, variant: 'card', caption: '国家防震减灾科普示范学校（全市唯一）' },
  },
  {
    keywords: ['信息学', '兴趣'],
    image: { src: honorXinxixue, variant: 'card', caption: '广东省青少年信息学竞赛优秀组织单位' },
  },
  {
    keywords: ['教师', '班主任'],
    image: { src: honorJiaoshi, variant: 'card', caption: '南海区教育发展研究中心（教师发展中心）首个基地学校' },
  },
  {
    keywords: ['舞台', '课后'],
    image: { src: honorJiankang, variant: 'card', caption: '首批全国健康学校建设单位' },
  },
  {
    keywords: ['阅读', '书香', '美育'],
    image: { src: honorYuedu, variant: 'card', caption: '广东省中小学最美阅读空间（博文致远图书馆）' },
  },
  {
    keywords: ['鲲鹏', '英才'],
    image: { src: honorKunpeng, variant: 'card', caption: '南海区英才培养先进单位"鲲鹏奖"' },
  },
  {
    keywords: ['太平', '校区', '迁址', '概况'],
    image: { src: campusTrack, variant: 'card', caption: '大沥太平校区' },
  },
];

/** 按 section 标题匹配配图；无匹配返回 null（卡片保持纯文字） */
export function imageForSection(title: string): SectionImage | null {
  const hit = sectionRules.find((rule) => rule.keywords.some((k) => title.includes(k)));
  return hit ? hit.image : null;
}
