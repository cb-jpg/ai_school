/**
 * 官网栏目式信息架构（2026-09-21 简化版省实改版）
 *
 * 结构：学校概况 / 办学成果 / 招生入学 三个栏目，每栏目下多篇文章
 * （省实官网子页式：左侧栏目菜单切换右侧文章就地显示）。
 *
 * ⚠️ 内容边界：
 * - 全部内容从 campus-knowledge.ts 四专题（公开报道/政府公开文件）与校方《数据清单》
 *   （招生简章折页、荣誉牌匾、2026 实景照片）重组搬运，不新造事实。
 * - 招生计划等政策类数字以教育部门和学校当年公布为准（页面上有标注）。
 * - 参考来源仅收录已核实的政府/媒体直链（nanhai.gov.cn、南方+）；公众号文章
 *   永久链接需校方在微信内复制提供（B 路线，见 docs/微信公众号接入说明.md）。
 */
import type { SectionImage } from './campus-images';

import anniversaryPoster from '@/assets/school/anniversary-poster.jpg';
import artFestivalGala from '@/assets/school/art-festival-gala.jpg';
import bannerHistory from '@/assets/school/banner-history.jpg';
import campusChoirRoom from '@/assets/school/campus-choir-room.jpg';
import campusGate from '@/assets/school/campus-gate.jpg';
import campusInformaticsLab from '@/assets/school/campus-informatics-lab.jpg';
import campusTrack from '@/assets/school/campus-track.jpg';
import campusVexLab from '@/assets/school/campus-vex-lab.jpg';
import honorFangzhen from '@/assets/school/honor-fangzhen.jpg';
import honorGaozhiliang from '@/assets/school/honor-gaozhiliang.jpg';
import honorJiankang from '@/assets/school/honor-jiankang.jpg';
import honorJiaoshi from '@/assets/school/honor-jiaoshi.jpg';
import honorKunpeng from '@/assets/school/honor-kunpeng.jpg';
import honorXinxixue from '@/assets/school/honor-xinxixue.jpg';
import honorYuedu from '@/assets/school/honor-yuedu.jpg';
import joyFarm from '@/assets/school/joy-farm.jpg';
import kongshengyuan from '@/assets/school/kongshengyuan.jpg';
import masterGallery from '@/assets/school/master-gallery.jpg';
import masterWall from '@/assets/school/master-wall.jpg';
import mingdeLou from '@/assets/school/mingde-lou.jpg';
import quakeStation from '@/assets/school/quake-station.jpg';
import smartCampus from '@/assets/school/smart-campus.jpg';
import stemOpenDay from '@/assets/school/stem-open-day.jpg';
import stuChenManhan from '@/assets/school/stu-chen-manhan.jpg';
import stuChenZhezhang from '@/assets/school/stu-chen-zhezhang.jpg';

export type SiteColumnId = 'overview' | 'achievements' | 'admissions';

/** 参考来源（url 留空 = 暂无已核实直链，渲染为纯文字） */
export interface ColumnSource {
  title: string;
  publisher: string;
  publishedAt: string;
  url?: string;
}

export interface ColumnVideo {
  /** 站内路径（/media 静态挂载）或完整 URL */
  src: string;
  poster?: string;
  caption: string;
  /** 备用外链（公众号视频号文章等，待校方提供） */
  externalUrl?: string;
}

export interface ColumnArticle {
  id: string;
  title: string;
  eyebrow?: string;
  summary: string;
  paragraphs: string[];
  facts: string[];
  images: SectionImage[];
  video?: ColumnVideo;
  /** 数字人"讲解本文"播报词 */
  narration: string;
  sources: ColumnSource[];
}

export interface SiteColumn {
  id: SiteColumnId;
  navLabel: string;
  eyebrow: string;
  /** 栏目页顶部 banner 条背景图 */
  banner: string;
  /** 面包屑/侧栏之下的栏目导语 */
  intro: string;
  articles: ColumnArticle[];
}

const govSources = {
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
    title: '学生花式荐书！南海区举办第七届中小学生"书香伴我行，好书我推荐"展示活动',
    publisher: '佛山市南海区人民政府',
    publishedAt: '2023-05-12',
    url: 'https://www.nanhai.gov.cn/fsnhq/zwgk/zwdt/gzdt/content/post_5606471.html',
  },
  arts: {
    title: '市级美育大比拼，南海区19个一等奖拿下"半壁江山"！',
    publisher: '佛山市南海区教育局',
    publishedAt: '2026-07-08',
    url: 'https://www.nanhai.gov.cn/fsnhq/zwgk/zwdt/gzdt/content/post_7189407.html',
  },
  information: {
    title: '佛山唯一！保送北大！',
    publisher: '南方+（南方日报）',
    publishedAt: '2025-06-30',
    url: 'https://static.nfnews.com/content/202506/30/c11454630.html',
  },
  afterSchool: {
    title: '均衡筑基，美好赋能，南海绘就义务教育优质均衡"国字号"答卷',
    publisher: '佛山市南海区教育局',
    publishedAt: '2026-01-14',
    url: 'https://www.nanhai.gov.cn/fsnhq/bmdh/zfbm/qjyj/xxgkml/gzdt/content/post_6945094.html',
  },
  baike: {
    title: '佛山市南海区石实实验学校（公开百科页面）',
    publisher: '公开百科资料',
    publishedAt: '页面信息，待校方档案进一步核验',
    url: 'https://baike.baidu.com/item/佛山市南海区石实实验学校',
  },
  brochure: {
    title: '石实实验学校招生简章（校方印制折页）',
    publisher: '石实实验学校',
    publishedAt: '2024-01 至 2025-05 印制版',
  },
  zsjz2026: {
    title: '石实实验学校2026年招生简章（微信公众号"石实"）',
    publisher: '学校微信公众号',
    publishedAt: '2026 年发布；计划数以教育部门和学校当年公布为准',
  },
} satisfies Record<string, ColumnSource>;

export const siteColumns: SiteColumn[] = [
  {
    id: 'overview',
    navLabel: '学校概况',
    eyebrow: 'SCHOOL OVERVIEW',
    banner: campusGate,
    intro: '从学校简介到历史文化，了解一所致力于让每一个孩子都能成长、成才、成功的实验学校。',
    articles: [
      {
        id: 'overview-intro',
        title: '学校简介',
        eyebrow: '学校概况',
        summary:
          '石实实验学校是一所九年一贯制全日制寄宿制民办实验学校，位于佛山市南海区大沥镇，前身为石门实验学校。',
        paragraphs: [
          '佛山市南海区石实实验学校原名佛山市南海区石门实验学校，始建于1999年，是一所全日制寄宿制民办实验学校。学校位于佛山市南海区大沥镇太平社区体育南路，由大沥镇教育办公室负责日常业务管理。',
          '2023年9月8日，经南海区教育局批复，学校正式更名为"佛山市南海区石实实验学校"。2024年起学校复办小学部，成为九年一贯制学校，实现小初一体化培养。',
          '寄宿制办学为学生提供了全天候的学习生活环境，也让教师陪伴和同伴合作成为校园文化的重要组成部分。学校长期重视信息学特长培养，同时开设体育、艺术、心理等特色社团，为学生提供多样化的成长平台。',
        ],
        facts: [
          '现用全称：佛山市南海区石实实验学校',
          '曾用名：佛山市南海区石门实验学校',
          '建校时间：1999年',
          '办学类型：九年一贯制 · 全日制寄宿制民办实验学校',
          '所属区域：佛山市南海区大沥镇',
          '日常管理：大沥镇教育办公室负责',
        ],
        images: [
          { src: mingdeLou, variant: 'card', caption: '明德楼与校门广场（大沥太平校区）' },
          { src: campusTrack, variant: 'card', caption: '田径运动场（2026 校方实景）' },
        ],
        narration:
          '欢迎了解佛山市南海区石实实验学校。学校原名石门实验学校，始建于1999年，是一所全日制寄宿制民办实验学校。2023年经南海区教育局批复更名为石实实验学校，2024年起复办小学部，成为九年一贯制学校。学校位于大沥镇，以"让每一个孩子都能成长、成才、成功"为育人追求，为学生提供优质的教育服务。',
        sources: [govSources.baike, govSources.rename],
      },
      {
        id: 'overview-philosophy',
        title: '办学理念',
        eyebrow: '育人追求',
        summary: '学校秉承"任重道远、毋忘奋斗"校训，坚持"扬长教育、人人出彩"办学理念，"五育并举"全面育人。',
        paragraphs: [
          '学校始终秉承"任重道远、毋忘奋斗"的校训，坚持"扬长教育、人人出彩"的办学理念，弘扬"以爱治校、尊重你我"的共同价值观，"五育并举"全面育人。',
          '办学理念的核心，是让每一个孩子都能成长、成才、成功：不仅关注学业成绩，更注重学生的品格养成、能力提升和兴趣发展。学校通过寄宿制管理与个性化培养相结合，为不同特点的学生提供适合的成长路径。',
          '在具体育人场景中，学校把中华传统文化熏陶、劳动教育、科学教育融入日常：孔圣园祭孔仪式、名生长廊与名人文化、爱乐农场劳动实践等，都成为理念落地的校园现场。',
        ],
        facts: [
          '校训：任重道远、毋忘奋斗',
          '办学理念：扬长教育、人人出彩',
          '共同价值观：以爱治校、尊重你我',
          '育人路径："五育并举"全面育人',
          '培养目标：让每一个孩子都能成长、成才、成功',
        ],
        images: [
          { src: kongshengyuan, variant: 'card', caption: '孔圣园祭孔仪式' },
          { src: joyFarm, variant: 'card', caption: '爱乐农场：学生、家长与教师并肩劳作' },
        ],
        narration:
          '石实实验学校秉承"任重道远、毋忘奋斗"的校训，坚持"扬长教育、人人出彩"的办学理念，弘扬"以爱治校、尊重你我"的共同价值观，五育并举全面育人。学校希望让每一个孩子都能成长、成才、成功，通过寄宿制管理和个性化培养相结合，为不同特点的学生提供适合的成长路径。',
        sources: [govSources.brochure],
      },
      {
        id: 'overview-history',
        title: '历史沿革',
        eyebrow: '校史',
        summary:
          '沿着创办、迁址、更名、复办小学与25周年校庆的节点，了解这所大沥寄宿制学校的发展轨迹。',
        paragraphs: [
          '公开资料记载，学校始建于一九九九年，最初以"石门实验学校"的名称开展办学。寄宿制办学让学校形成了学习、生活和成长相互融合的校园节奏。',
          '2019年前后，学校从大沥黄岐迁往大沥太平新校区。新校区为教学、住宿、体育和综合实践提供了更大的空间，也让学校开始用更完整的场景承载学习与生活。',
          '2023年9月8日，南海区教育局正式批复学校更名："石门实验学校"变更为"石实实验学校"，日常业务管理仍由大沥镇教育办公室负责。"石实"既保留了原有的学校记忆，也成为面向新阶段的校园标识。',
          '2024年，学校复办小学部，九年一贯制办学格局形成。2024年11月，学校举行25周年校庆系列活动，两万余名校友共叙情谊，校庆晚会大咖云集，成为全校师生与校友的共同记忆。',
        ],
        facts: [
          '1999年：始建，原名石门实验学校',
          '2019年前后：迁入大沥太平新校区',
          '2023年9月8日：经南海区教育局批复更名"石实实验学校"',
          '2024年：复办小学部，形成九年一贯制办学',
          '2024年11月：举行25周年校庆系列活动',
        ],
        images: [{ src: bannerHistory, variant: 'card', caption: '校园记忆' }],
        video: {
          src: '/media/anniversary-25.mp4',
          poster: anniversaryPoster,
          caption: '25周年校庆晚会现场实拍（舞狮表演）',
        },
        narration:
          '欢迎来到石实实验学校校史篇。学校始建于一九九九年，原名石门实验学校；二零一九年前后迁入大沥太平新校区；二零二三年九月八日经南海区教育局批复更名为石实实验学校；二零二四年复办小学部，并在当年十一月举行二十五周年校庆。从黄岐到太平，从石门到石实，变化的是校园与名称，不变的是让每一个孩子成长、成才、成功的追求。',
        sources: [govSources.rename, govSources.baike],
      },
      {
        id: 'overview-culture',
        title: '校园文化与新貌',
        eyebrow: '今日石实',
        summary:
          '孔圣园、名生长廊、智慧校园指挥中心、体艺节大舞台——传统文化与现代治理在校园里交汇。',
        paragraphs: [
          '校园里，中华传统文化的熏陶随处可见：孔圣园的祭孔仪式让学生在礼乐中理解"任重道远"；名生长廊与名人文化柱把校史与时代楷模的故事立在每日经过的路上；明德楼取"大学之道，在明明德"之意，是校园文化地标。',
          '现代化学苦治理同样在推进：智慧校园指挥中心把校园安全、教学与后勤数据汇于一屏；校园食堂获评食品安全卫生等级 A 级单位，"阳光厨房"守护每一餐。',
          '学生的舞台则更加广阔：第26届体艺节精品节目展演以"以爱筑未来·扬长共出彩"为主题，超3000名学生同台表演；首届数学文化周暨科技节开放日吸引近万人打卡；扬长大舞台让学生自编自导自演，绽放个人风采。',
        ],
        facts: [
          '孔圣园：祭孔仪式等中华传统文化活动',
          '名生长廊 / 名人文化柱：校史与榜样教育',
          '智慧校园指挥中心：数字化校园治理',
          '食堂获评食品安全卫生等级 A 级单位',
          '第26届体艺节：超3000名学生同台展演',
          '首届数学文化周暨科技节开放日：近万人打卡',
        ],
        images: [
          { src: masterGallery, variant: 'card', caption: '名生长廊（"任重道远·毋忘奋斗"）' },
          { src: masterWall, variant: 'card', caption: '名人文化柱廊（时代楷模画像）' },
          { src: smartCampus, variant: 'card', caption: '智慧校园指挥中心' },
          { src: artFestivalGala, variant: 'card', caption: '第26届体艺节精品节目展演（2025.11）' },
          { src: stemOpenDay, variant: 'card', caption: '首届数学文化周暨科技节开放日（2026.03）' },
        ],
        narration:
          '在石实实验学校的校园里，传统文化与现代治理交相辉映：孔圣园的祭孔仪式、名生长廊与名人文化柱承载着学校的精神底色；智慧校园指挥中心和阳光厨房守护着每天的校园生活；体艺节晚会超三千名学生同台表演，数学文化周暨科技节开放日吸引近万人打卡。校园不只是上课的地方，更是阅读、运动、表达和发现兴趣的成长现场。',
        sources: [govSources.brochure],
      },
    ],
  },
  {
    id: 'achievements',
    navLabel: '办学成果',
    eyebrow: 'ACHIEVEMENTS',
    banner: honorGaozhiliang,
    intro: '从国家级示范荣誉到信息学竞赛、教师成长与美育舞台，看看石实多元办学的成果。',
    articles: [
      {
        id: 'ach-honors',
        title: '荣誉墙',
        eyebrow: '办学成果',
        summary:
          '2个国家级、6个省级、4个市级、10个区级荣誉；连续三年荣获南海区初中教育高质量发展一等奖和英才培养"鲲鹏奖"。',
        paragraphs: [
          '学校坚持高质量、高品位办学。据校方招生简章，2021年以来学校累计获得2个国家级荣誉、6个省级荣誉、4个市级荣誉、10个区级荣誉。',
          '2023年、2024年、2025年，学校连续三年荣获南海区初中教育高质量发展一等奖，并连续三年荣获南海区英才培养先进单位"鲲鹏奖"（一等奖），赢得了社会各界的广泛赞誉。',
          '国家级荣誉包括：首批全国健康学校建设单位（佛山义务教育阶段学校仅5所）、国家防震减灾科普示范学校（全市唯一）。省级荣誉包括：广东省中小学科学教育示范区示范校、广东省青少年信息学竞赛优秀组织单位、广东省学校卫生监督实训基地现场教学点（全省初中唯一）、广东省绿色学校、广东省最美阅读空间等。',
        ],
        facts: [
          '国家级：首批全国健康学校建设单位（佛山义务教育仅5所）',
          '国家级：国家防震减灾科普示范学校（全市唯一）',
          '省级：广东省中小学科学教育示范区示范校',
          '省级：广东省青少年信息学竞赛优秀组织单位',
          '省级：广东省学校卫生监督实训基地现场教学点（全省初中唯一）',
          '省级：广东省绿色学校 / 广东省最美阅读空间',
          '区级：连续3年南海区初中教育高质量发展一等奖',
          '区级：连续3年南海区英才培养先进单位"鲲鹏奖"',
        ],
        images: [
          { src: honorJiankang, variant: 'card', caption: '首批全国健康学校建设单位（国家级）' },
          { src: honorFangzhen, variant: 'card', caption: '国家防震减灾科普示范学校（全市唯一）' },
          { src: honorXinxixue, variant: 'card', caption: '广东省青少年信息学竞赛优秀组织单位' },
          { src: honorYuedu, variant: 'card', caption: '广东省中小学最美阅读空间' },
          { src: honorKunpeng, variant: 'card', caption: '南海区英才培养先进单位"鲲鹏奖"' },
          { src: honorGaozhiliang, variant: 'card', caption: '南海区初中教育高质量发展先进学校' },
        ],
        narration:
          '石实实验学校的荣誉墙上，挂满了师生共同挣得的荣誉：首批全国健康学校建设单位、国家防震减灾科普示范学校这两个国家级荣誉；广东省科学教育示范区示范校、省信息学竞赛优秀组织单位等省级荣誉；还有连续三年的南海区初中教育高质量发展一等奖和英才培养先进单位鲲鹏奖。每一块牌匾背后，都是学校高质量办学的日常。',
        sources: [govSources.brochure, govSources.earthquake],
      },
      {
        id: 'ach-earthquake',
        title: '防震减灾全国示范',
        eyebrow: '全国示范 · 科普安全',
        summary:
          '2023年度全国防震减灾科普示范学校，佛山市当时唯一获此荣誉的学校；校园里建有防震减灾科普站。',
        paragraphs: [
          '石实实验学校在防震减灾教育方面形成了鲜明特色。南海区应急管理部门公开报道显示，学校被评为2023年度全国防震减灾科普示范学校，并介绍了学校开展应急演练、安全科普和校园防范工作的做法。',
          '校园里建有防震减灾科普站，VR 地震体验等设备让学生在沉浸式体验中真实感受地震场景，掌握逃生方法和注意事项。安全教育在这里不是一次活动，而是需要理解、练习并真正能够行动的生活能力。',
        ],
        facts: [
          '入选2023年度全国防震减灾科普示范学校（全市唯一）',
          '校内建有防震减灾科普站（VR地震体验）',
          '开展地震应急演练与安全教育活动',
          '将科普知识融入课堂、实践与校园管理',
        ],
        images: [
          { src: quakeStation, variant: 'card', caption: '防震减灾科普站 · VR地震体验区' },
          { src: honorFangzhen, variant: 'card', caption: '国家防震减灾科普示范学校牌匾' },
        ],
        narration:
          '石实实验学校在防震减灾教育方面形成了鲜明特色。南海区应急管理部门公开报道显示，学校被评为二零二三年度全国防震减灾科普示范学校，是当时佛山市唯一获此荣誉的学校。校园里还建有防震减灾科普站，同学们可以通过 VR 地震体验，在沉浸式场景中学习逃生方法。安全教育不是一次活动，而是真正能够行动的生活能力。',
        sources: [govSources.earthquake],
      },
      {
        id: 'ach-informatics',
        title: '信息学与升学',
        eyebrow: '竞赛领航 · 长期培养',
        summary:
          '公开报道提到近年来13位学子凭信息学特长保送清北；GDOI2025 省选34人获全国一等奖，包揽区赛2个特等奖。',
        paragraphs: [
          '在信息学方向，学校形成了长期培养的公开口碑。2025年南方+报道提到，学校近年来已有13位学子凭信息学特长保送进入清华大学、北京大学等高校；校方招生简章则显示，办学以来已有40名优秀毕业生入读清华、北大，其中2025年高考4名毕业生入读清北（陈哲章保送北京大学、蔡涵森被清华大学飞行员班录取）。',
          '竞赛成绩同样亮眼：2024年信息学竞赛再创新高，GDOI2025 暨 NOI2025 广东省队选拔赛中，34人获全国赛一等奖、10人获全省一等奖，1枚全国金牌、1个全省团体第一；包揽区赛2个特等奖，全区前5独占4人。学校还承办了2025年广东省信息学选拔赛。',
          '这里更值得关注的不是一个数字，而是兴趣如何通过持续训练、问题解决和项目实践，逐步变成真正的能力。页面不展示未成年人的姓名、班级和具体分数。',
        ],
        facts: [
          '2025年南方+报道：近年来13位学子凭信息学特长保送清北',
          '校方简章：办学以来40名优秀毕业生入读清华、北大',
          '2025年高考：4名毕业生入读清北（陈哲章保送北大、蔡涵森清华"飞班"）',
          'GDOI2025省选：34人全国一等奖、10人全省一等奖',
          '1枚全国金牌、1个全省团体第一、包揽区赛2个特等奖',
          '2025年广东省信息学选拔赛由学校承办',
        ],
        images: [
          { src: campusInformaticsLab, variant: 'card', caption: '信息学专训室（2026 校方实景）' },
          { src: campusVexLab, variant: 'card', caption: 'VEX机器人专训室（2026 校方实景）' },
        ],
        narration:
          '在信息学方向，石实实验学校形成了长期培养的公开口碑。南方加二零二五年报道提到，学校近年来已有十三位学子凭信息学特长保送清华、北大；校方招生简章显示，办学以来已有四十名优秀毕业生入读清北。竞赛方面，GDOI二零二五省队选拔赛中学校三十四人获全国一等奖，并包揽区赛两个特等奖。比数字更重要的，是兴趣通过持续训练变成真正能力的过程。',
        sources: [govSources.information, govSources.brochure],
      },
      {
        id: 'ach-teachers',
        title: '教师成长',
        eyebrow: '师资雄厚 · 育人案例',
        summary:
          '260余名专任教师中，有全国骨干校长、正高级教师3人、特级教师2人、博士教师2人；教师案例进入全国展示名单。',
        paragraphs: [
          '学校拥有一支高水平的教师队伍。据校方招生简章：学校现有逾260名专任教师，其中全国骨干校长1人、正高级教师3人、特级教师2人、博士教师2人，市区级学科带头人、名师、名班主任等中坚力量逾百人；拥有3个广东省优秀科组、8个佛山市优秀科组以及3个佛山市学科基地。',
          '教师的专业成长最终回到学生身上。南海区教育局公开报道显示，学校教师的育人故事、带班方略和主题班会案例入选全国中小学班主任基本功展示交流活动典型经验名单，案例覆盖班级文化、劳动实践与地方文化传承。',
          '多位全国知名专家受聘担任学校教育顾问、荣誉科学副校长，为拔尖创新人才早期培养提供专业指导。',
        ],
        facts: [
          '逾260名专任教师',
          '全国骨干校长1人、正高级教师3人、特级教师2人、博士教师2人',
          '市区级学科带头人、名师、名班主任等逾百人',
          '3个广东省优秀科组、8个佛山市优秀科组、3个佛山市学科基地',
          '教师案例入选全国班主任基本功展示交流活动典型经验',
        ],
        images: [
          { src: honorJiaoshi, variant: 'card', caption: '南海区教育发展研究中心首个基地学校' },
          { src: masterWall, variant: 'card', caption: '名人文化柱廊（榜样教育）' },
        ],
        narration:
          '石实实验学校拥有一支高水平的教师队伍：两百六十多名专任教师中，有全国骨干校长、正高级教师、特级教师和博士教师，市区级学科带头人、名师、名班主任等中坚力量超过百人。南海区教育局公开报道还显示，学校教师的育人故事、带班方略和主题班会案例入选了全国中小学班主任基本功展示交流活动典型经验。好的教育成果，往往从教师愿意研究学生、理解班级开始。',
        sources: [govSources.brochure, govSources.teacherGrowth],
      },
      {
        id: 'ach-arts',
        title: '美育与社团',
        eyebrow: '全面发展 · 五育并举',
        summary:
          '体艺节被称作中学体艺节"天花板"、健美操蝉联全省初中第一、戏剧全市初中第一；阅读、美育、劳动教育全面开花。',
        paragraphs: [
          '阅读和美育让成长拥有更多入口。公开报道显示，学校参加南海区"书香伴我行，好书我推荐"活动，博文致远图书馆获评广东省最美阅读空间；2026年市级美育比拼相关报道中，学校列入一等奖名单。',
          '体艺舞台是石实的名片：连年举办的体艺节被称为中学体艺节"天花板"，第26届体艺节精品节目展演超3000名学生同台表演；健美操队蝉联全省初中第一；校级戏剧成绩全市初中第一。',
          '五育并举还落在田间地头：爱乐农场里，学生、家长与教师并肩劳作，让劳动教育的种子落地生根；数学文化周暨科技节开放日、VEX机器人、合唱团、美术之夜等平台，让每个孩子找到愿意投入的舞台。',
        ],
        facts: [
          '体艺节被称作中学体艺节"天花板"，第26届展演超3000人同台',
          '健美操蝉联全省初中第一；校级戏剧全市初中第一',
          '博文致远图书馆获评广东省最美阅读空间',
          '2026年市级美育比拼报道列入一等奖名单',
          '爱乐农场：劳动教育实践基地',
          '课后服务开设体育、艺术、心理等特色社团',
        ],
        images: [
          { src: artFestivalGala, variant: 'card', caption: '第26届体艺节精品节目展演（2025.11）' },
          { src: honorYuedu, variant: 'card', caption: '广东省中小学最美阅读空间（博文致远图书馆）' },
          { src: campusChoirRoom, variant: 'card', caption: '合唱室（2026 校方实景）' },
          { src: joyFarm, variant: 'card', caption: '爱乐农场劳动教育' },
        ],
        narration:
          '石实的美育与社团生活十分丰富：体艺节被称为中学体艺节的天花板，第26届展演超三千名学生同台表演；健美操蝉联全省初中第一，校级戏剧全市初中第一；博文致远图书馆获评广东省最美阅读空间；爱乐农场里，同学们和老师、家长一起劳作，感受劳动教育的快乐。每个孩子都可以通过阅读、创作、运动和合作，找到适合自己的表达方式。',
        sources: [govSources.reading, govSources.arts, govSources.brochure],
      },
      {
        id: 'ach-role-models',
        title: '学习标兵',
        eyebrow: '榜样 · 可执行的学习方法',
        summary:
          '从公开报道中看见可执行的学习方法：两位中考学习方法报道学生与一位保送北大的升学案例。',
        paragraphs: [
          '陈曼涵（公开报道中的902班学生）把每一步学习做成闭环：课前预习，课堂保持投入，课后及时复习，并通过错题复盘找到下一步改进方向。这个方法的价值不在于把时间排满，而在于让每一次练习都回到自己的理解上。',
          '邓桢（同一篇报道中的901班学生）用时间管理给目标留出位置：把较大的目标拆成阶段任务，再用阅读积累和笔记整理帮助自己持续前进。',
          '陈哲章（2022届毕业生）从信息学兴趣走向长期训练，公开报道提到他曾凭信息学特长保送北京大学。兴趣需要长期训练来支撑，训练又需要真实的问题和项目来检验。页面仅保留公开姓名、届次和方法，不展示分数等隐私信息。',
        ],
        facts: [
          '陈曼涵：预习 → 课堂投入 → 课后复习 → 错题复盘',
          '邓桢：阶段任务拆解目标 + 阅读积累与笔记整理',
          '陈哲章：2022届毕业生，公开报道其凭信息学特长保送北京大学',
        ],
        images: [
          { src: stuChenManhan, variant: 'portrait', caption: '2024届902班 · 《芝兰玉树》画册' },
          { src: stuChenZhezhang, variant: 'portrait', caption: '信息学奥赛金牌 · 保送北京大学' },
        ],
        narration:
          '这里选取石实公开报道中的三位学生案例。陈曼涵同学的方法是把每一步学习做成闭环：预习、课堂投入、课后复习、错题复盘；邓桢同学用时间管理给目标留出位置，把大目标拆成阶段任务；陈哲章是二零二二届毕业生，公开报道提到他曾凭信息学特长保送北京大学。比起追逐结果，更重要的是找到愿意长期投入的方向，并一步步把它做深。',
        sources: [govSources.studentMethods, govSources.information],
      },
    ],
  },
  {
    id: 'admissions',
    navLabel: '招生入学',
    eyebrow: 'ADMISSIONS',
    banner: stemOpenDay,
    intro: '报读石实实验学校：招生简章、报读咨询与常见问答。招生政策以教育部门和学校当年公布为准。',
    articles: [
      {
        id: 'adm-brochure',
        title: '招生简章',
        eyebrow: '2026 年招生',
        summary:
          '九年一贯制寄宿制学校：2026年计划招收七年级新生950人（面向大沥镇570个）；小学部2024年复办。',
        paragraphs: [
          '石实实验学校是九年一贯制全日制寄宿制民办实验学校，现校址占地120亩，现有86个教学班。学校地处佛山市南海区大沥镇太平社区，校园教学、住宿、体育设施完善。',
          '据学校微信公众号"石实"发布的2026年招生简章，学校2026年计划招收七年级新生950人，其中面向大沥镇招生570个。小学部于2024年复办，复办首年一年级计划招生160人。',
          '具体招生范围、报名方式与录取办法以南海区教育行政部门和学校当年正式公布为准，家长可通过"石实"微信公众号及招生办咨询电话了解最新信息。',
        ],
        facts: [
          '办学层次：九年一贯制（小学部2024年复办）',
          '校园占地：120亩 · 现有86个教学班',
          '2026年七年级计划：950人（面向大沥镇570个）',
          '2024年小学一年级计划：160人',
          '住宿：全日制寄宿制',
          '⚠️ 计划数以教育部门和学校当年公布为准',
        ],
        images: [
          { src: stemOpenDay, variant: 'card', caption: '校园开放日（2026.03 数学文化周暨科技节）' },
          { src: campusGate, variant: 'card', caption: '学校大门' },
        ],
        narration:
          '石实实验学校是九年一贯制全日制寄宿制民办实验学校，现校址占地一百二十亩，现有八十六个教学班。根据学校公众号发布的二零二六年招生简章，学校计划招收七年级新生九百五十人，其中面向大沥镇五百七十个；小学部于二零二四年复办。请注意，具体招生政策以教育部门和学校当年公布为准。',
        sources: [govSources.zsjz2026, govSources.brochure],
      },
      {
        id: 'adm-consult',
        title: '报读咨询',
        eyebrow: '联系方式',
        summary: '初中部、小学部分别设有招生办咨询电话，亦可关注学校公众号或填写入读意向登记。',
        paragraphs: [
          '学校初中部、小学部招生办均开通了咨询电话，家长可在工作日工作时间致电咨询招生政策、校园开放日安排与入读意向登记等事项。',
          '也可以通过学校微信公众号"石实"了解学校动态与招生信息，或按招生简章指引扫码填写入读意向。欢迎家长和同学到校实地参观，感受扬长教育的校园氛围。',
        ],
        facts: [
          '初中招生办咨询电话：18925911573（蔡老师）',
          '小学招生办咨询电话：18927205583（马老师）',
          '学校邮箱：18925911573@163.com',
          '学校微信公众号：石实',
          '学校地址：佛山市南海区大沥镇太平社区体育南路20号',
        ],
        images: [],
        narration:
          '如需报读咨询，可以拨打学校招生办电话：初中部一八九二五九一一五七三蔡老师，小学部一八九二七二零五五八三马老师；也可以关注学校微信公众号"石实"，或按招生简章指引填写入读意向。学校地址在佛山市南海区大沥镇太平社区体育南路二十号，欢迎家长和同学到校参观。',
        sources: [govSources.brochure],
      },
      {
        id: 'adm-faq',
        title: '常见问答',
        eyebrow: 'FAQ',
        summary: '关于学校性质、位置、办学特色与成果的常见问题，数字人"小石同学"也可以随时为你解答。',
        paragraphs: [
          '问：石实实验学校是什么性质的学校？答：九年一贯制全日制寄宿制民办实验学校，前身为1999年创办的石门实验学校，2023年经南海区教育局批复更名。',
          '问：学校在哪里？答：佛山市南海区大沥镇太平社区体育南路20号（太平校区），2019年前后由大沥黄岐迁入。',
          '问：学校有什么办学特色？答：秉承"任重道远、毋忘奋斗"校训，坚持"扬长教育、人人出彩"理念；信息学竞赛成绩突出，防震减灾科普、美育体艺、劳动教育全面发展。',
          '问：办学成果如何？答：据公开报道与校方资料，全国防震减灾科普示范学校（全市唯一）、首批全国健康学校建设单位；办学以来40名毕业生入读清北；连续三年获南海区初中教育高质量发展一等奖。',
          '问：想了解更多或预约参观怎么办？答：拨打招生办电话、关注微信公众号"石实"，或直接在对话页与数字人"小石同学"交流。',
        ],
        facts: [
          'Q：学校性质？A：九年一贯制寄宿制民办实验学校',
          'Q：地址？A：南海区大沥镇太平社区体育南路20号',
          'Q：特色？A：扬长教育 · 信息学 · 防震减灾科普 · 美育体艺',
          'Q：成果？A：40名毕业生入读清北 · 连续三年区高质量发展一等奖',
          'Q：了解更多？A：招生办电话 / 公众号"石实" / 与小石同学对话',
        ],
        images: [{ src: campusTrack, variant: 'card', caption: '田径运动场（2026 校方实景）' }],
        narration:
          '关于招生入学的常见问题：石实实验学校是九年一贯制全日制寄宿制民办实验学校，位于大沥镇太平社区体育南路二十号。学校秉承扬长教育、人人出彩的理念，信息学竞赛成绩突出，办学以来已有四十名毕业生入读清华北大。想了解更多，可以拨打招生办电话或关注学校公众号，也可以在对话页和我聊聊。',
        sources: [govSources.baike, govSources.brochure],
      },
    ],
  },
];

export const siteColumnMap = Object.fromEntries(
  siteColumns.map((column) => [column.id, column]),
) as Record<SiteColumnId, SiteColumn>;

export const isSiteColumnId = (value: string): value is SiteColumnId =>
  siteColumns.some((column) => column.id === value);

export function findArticle(columnId: SiteColumnId, articleId: string): ColumnArticle | undefined {
  return siteColumnMap[columnId]?.articles.find((article) => article.id === articleId);
}

/** 旧专题路由 → 新栏目/文章 兼容映射 */
export const LEGACY_TOPIC_MAP: Record<string, { column: SiteColumnId; article: string }> = {
  intro: { column: 'overview', article: 'overview-intro' },
  history: { column: 'overview', article: 'overview-history' },
  achievements: { column: 'achievements', article: 'ach-honors' },
  'role-models': { column: 'achievements', article: 'ach-role-models' },
};
