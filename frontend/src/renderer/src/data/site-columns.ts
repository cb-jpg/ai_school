/**
 * 官网栏目式信息架构（2026-09-21 简化版省实改版）
 *
 * 结构：学校概况 / 办学成果 / 招生咨询 三个栏目，每栏目下多篇文章
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
// 校方 2026-11-08「学校建筑照片」压缩包（18 张，原始 3000~7000px 压到 1600px），
// 用于「校园文化与新貌」配图整体替换
import photoArtsFestivalFlags from '@/assets/school/campus/arts-festival-flags.jpg';
import photoArtsFestivalGala from '@/assets/school/campus/arts-festival-gala.jpg';
import photoArtRoom from '@/assets/school/campus/art-room.jpg';
import photoBrightClassroom from '@/assets/school/campus/bright-classroom.jpg';
import photoCanteen from '@/assets/school/campus/canteen.jpg';
import photoChoirRoom from '@/assets/school/campus/choir-room.jpg';
import photoDormitory from '@/assets/school/campus/dormitory.jpg';
import photoFootballField from '@/assets/school/campus/football-field.jpg';
import photoGate from '@/assets/school/campus/gate.jpg';
import photoGym from '@/assets/school/campus/gym.jpg';
import photoKongshengyuan from '@/assets/school/campus/kongshengyuan.jpg';
import photoLibrary from '@/assets/school/campus/library.jpg';
import photoMootCourt from '@/assets/school/campus/moot-court.jpg';
import photoMottoStone from '@/assets/school/campus/motto-stone.jpg';
import photoRoboticsLab from '@/assets/school/campus/robotics-lab.jpg';
import photoTeachingBuilding from '@/assets/school/campus/teaching-building.jpg';
import photoTrackField from '@/assets/school/campus/track-field.jpg';
import photoXingjianBuilding from '@/assets/school/campus/xingjian-building.jpg';
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
import gzhQrCode from '@/assets/school/gzh-qrcode.png';
import kongshengyuan from '@/assets/school/kongshengyuan.jpg';
import masterWall from '@/assets/school/master-wall.jpg';
import mingdeLou from '@/assets/school/mingde-lou.jpg';
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
  /** 微信公众号二维码行（2026-11-08 用户反馈「报读咨询的公众号文字条换成二维码」）：
   *  渲染在 facts 之后、factsAfterQr 之前，同一要点卡片内。src 走打包资源
   *  （同源，老 WebView 不拦 <img>，v2.56 教训）。 */
  wechatQr?: { src: string; caption: string };
  /** 排在二维码行之后的事实要点（如"学校地址"保持压尾） */
  factsAfterQr?: string[];
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
  schoolProfileDoc: {
    title: '学校简介（校方文档）',
    publisher: '石实实验学校',
    publishedAt: '2026-11 校方提供',
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
    intro: '从学校简介到历史文化，了解一所让每一个石实学子都闪闪发光的实验学校。',
    articles: [
      {
        id: 'overview-intro',
        title: '学校简介',
        eyebrow: '学校概况',
        summary:
          '九年一贯制全日制寄宿制民办实验学校，恪守"任重道远、毋忘奋斗"校训，秉持"扬长教育、人人出彩"办学理念，培育"五有好少年"。',
        paragraphs: [
          '学校恪守"任重道远、毋忘奋斗"校训，秉持"扬长教育、人人出彩"办学理念，弘扬"以爱治校、尊重你我"共同价值观，贯通"寻长—育长—见长—成长"全链条育人体系，培育有志、有为、有识、有恒、有趣的"五有好少年"，让每一个石实学子都能闪闪发光。学校位于佛山市南海区大沥镇太平社区体育南路，2024年复办小学部，实现小初一体化培养。',
          '办学实力有据可查：近五年先后获评首批全国健康学校建设单位等国家级荣誉2项、广东省中小学科学教育示范区示范校等省级荣誉6项、市级荣誉4项，连续三年蝉联南海区初中教育高质量发展先进学校一等奖、英才培养先进单位"鲲鹏奖"等区级荣誉10余项，"扬长教育"特色品牌多次登上《中小学德育》《中小学管理》《中国教育报》《广东教育》等权威媒体。学校师资力量雄厚：280余名专任教师中有正高级教师4人、特级教师2人、博士教师2人，市区级学科带头人、名师、名班主任逾百人，并聘请国际宇航科学院何质彬院士等4位行业大咖担任教育顾问，邀请入选全球前2%顶尖科学家榜单的华南理工大学博士生导师钟竞辉教授担任科学副校长、未来科创学院荣誉院长。',
          '学校以卓越育人实力，铸就升学与竞赛双高峰：累计43位学子录取清北、13位凭信息学特长保送（校方2026年10月通报口径），连续2年培养佛山市当年唯一清北保送生陈哲章、梁宝烨，2024年诞生佛山唯一理科类高考屏蔽生；机器人专训队勇夺国际、亚洲及全国赛事一等奖并创下新赛季世界纪录；近三年超百名学子在全国信息学CSP-J/S认证测试中获一等奖，获奖人数稳居佛山第一；数百名学生被港大、港中大、哈佛、剑桥、牛津等国际顶级学府录取。',
          '学校构建"两主两翼三阶八域"特色课程体系，推行"大学式选课"，每学期开设上百门特色课程，覆盖语言、人文、艺术、运动、健康、社会、科学、数理强基八大素养领域；作为"佛山市规范化家长学校领航工程示范点"，打造"1+2+3+N模式"家长学校，先后组建家长讲师团、星光家长艺术团等特色队伍，构建起规范高效的家校共育"石实模式"。',
        ],
        facts: [
          '办学类型：九年一贯制 · 全日制寄宿制民办实验学校',
          '育人体系："寻长—育长—见长—成长"全链条，培育"五有好少年"',
          '荣誉：近五年国家级2项、省级6项、市级4项、区级10余项',
          '师资：专任教师280余名，正高级4人、特级2人、博士2人',
          '升学：43位学子录取清北、13位凭信息学特长保送（校方2026-10通报）',
          '竞赛：近三年超百名学子获信息学CSP-J/S全国一等奖，稳居佛山第一',
          '课程："两主两翼三阶八域"体系，每学期开设上百门特色课程',
          '家校社：佛山市规范化家长学校领航工程示范点，"1+2+3+N"家长学校',
        ],
        images: [
          { src: mingdeLou, variant: 'card', caption: '明德楼与校门广场（大沥太平校区）' },
          { src: campusTrack, variant: 'card', caption: '田径运动场（2026 校方实景）' },
        ],
        narration:
          '欢迎了解佛山市南海区石实实验学校。学校恪守任重道远、毋忘奋斗的校训，秉持扬长教育、人人出彩的办学理念，贯通寻长、育长、见长、成长的全链条育人体系，培育五有好少年。近五年学校获得国家级荣誉两项、省级六项、市级四项、区级十余项；两百八十多名专任教师中有正高级教师、特级教师和博士教师，并请来何质彬院士等大咖担任教育顾问。升学与竞赛双高峰：累计四十三位学子录取清北，其中十三位凭信息学特长保送；近三年超百名学子获信息学全国一等奖，人数稳居佛山第一。',
        sources: [govSources.schoolProfileDoc, govSources.rename, govSources.baike],
      },
      {
        id: 'overview-philosophy',
        title: '办学理念',
        eyebrow: '育人追求',
        summary:
          '"扬长教育、人人出彩"的办学观，"以爱治校、尊重你我"的价值观，"成长比成绩更重要"的育人观。',
        paragraphs: [
          '学校秉持"扬长教育、人人出彩"的办学观：扬长教育是符合人的发展的全人教育，因材施教、以长促全，追求校内教育公平，个性化地大面积提升学生核心素养。',
          '学校弘扬"以爱治校、尊重你我"的共同价值观：尊重教育规律，以"爱"为根本保证。同时坚持"成长比成绩更重要"的育人观：全面发展、个性成长，让每个石实学子闪闪发光——求真、求美、求善，向前、向上、向深、向宽发展。',
          '一训三风是理念的日常表达：校训"任重道远、毋忘奋斗"，校风"从严要求、全面发展，勤教勤学、开拓进取"，教风"科学、协作、拼搏"，学风"尊师、爱校、勤学、俭朴"。孔圣园祭孔仪式、名生长廊与名人文化、爱乐农场劳动实践等，都是理念落地的校园现场。',
        ],
        facts: [
          '办学观：扬长教育、人人出彩（全人教育 · 因材施教以长促全）',
          '价值观：以爱治校、尊重你我（尊重教育规律，以爱为根本保证）',
          '育人观：成长比成绩更重要（求真求美求善，向前向上向深向宽发展）',
          '校训：任重道远、毋忘奋斗',
          '校风：从严要求 全面发展 · 勤教勤学 开拓进取',
          '教风：科学 协作 拼搏',
          '学风：尊师 爱校 勤学 俭朴',
        ],
        images: [
          { src: kongshengyuan, variant: 'card', caption: '孔圣园祭孔仪式' },
          { src: joyFarm, variant: 'card', caption: '爱乐农场：学生、家长与教师并肩劳作' },
        ],
        narration:
          '石实实验学校秉持扬长教育、人人出彩的办学观，这是符合人的发展的全人教育：因材施教、以长促全，追求校内教育公平。学校弘扬以爱治校、尊重你我的共同价值观，尊重教育规律，以爱为根本保证；坚持成长比成绩更重要的育人观，让每个石实学子求真求美求善，向前向上向深向宽发展。校训任重道远、毋忘奋斗，校风从严要求、全面发展，教风科学协作拼搏，学风尊师爱校勤学俭朴。',
        sources: [govSources.schoolProfileDoc],
      },
      {
        id: 'overview-history',
        title: '历史沿革',
        eyebrow: '校史',
        summary:
          '创办、迁址、转制更名、复办小学、全学段招生——沿着节点了解这所大沥寄宿制学校的发展轨迹。',
        paragraphs: [
          '石实实验学校（原石门实验学校）创办于1999年，是佛山市第一所实验类学校，原校址与石门中学一脉相连，深度传承卓越教育基因。寄宿制办学让学校形成了学习、生活和成长相互融合的校园节奏。',
          '2019年，学校迁址大沥太平，校园占地120亩。2023年学校顺利转制，并经南海区教育局批复（2023年9月8日）更名为"佛山市南海区石实实验学校"，日常业务管理由大沥镇教育办公室负责。',
          '2024年，学校复办小学部；2025年实现小学一年级至初中九年级全学段招生，办学规模达到4000人，目前设有93个教学班。2026年，学校硬件设施和校园文化全面升级，高标准建设现代化、信息化、智能化校园。',
          '历经27载耕耘，学校培养了两万多名毕业生。据校方简介文档，40名优秀毕业生入读清华大学、北京大学，38名入读香港大学、香港中文大学，40余名入读哈佛、剑桥、牛津、康奈尔、新加坡国立等国际顶尖院校（另据校方2026年10月通报，办学以来累计43位学子录取清北，两处口径注记并存）。',
        ],
        facts: [
          '1999年：创办（原石门实验学校），佛山市第一所实验类学校',
          '2019年：迁址大沥太平，校园占地120亩',
          '2023年9月8日：转制并经南海区教育局批复更名"石实实验学校"',
          '2024年：复办小学部，九年一贯制格局形成',
          '2025年：实现小学一年级至初三全学段招生，办学规模达4000人',
          '现在：93个教学班；2026年硬件设施与校园文化全面升级',
          '桃李：27载培养两万多名毕业生（校方简介文档：40名清北/38名港大港中大/40余名国际顶尖）',
        ],
        images: [{ src: bannerHistory, variant: 'card', caption: '校园记忆' }],
        video: {
          src: '/media/anniversary-25.mp4',
          poster: anniversaryPoster,
          caption: '25周年校庆晚会现场实拍（舞狮表演）',
        },
        narration:
          '欢迎来到石实实验学校校史篇。学校创办于一九九九年，原名石门实验学校，是佛山市第一所实验类学校，原校址与石门中学一脉相连。二零一九年迁址大沥太平，校园占地一百二十亩；二零二三年学校顺利转制，并经南海区教育局批复更名为石实实验学校。二零二四年复办小学部，二零二五年实现小学一年级至初中九年级全学段招生，办学规模达到四千人，目前设有九十三个教学班。二十七载耕耘，学校培养了两万多名毕业生，一大批学子进入清华、北大和世界顶尖学府。',
        sources: [govSources.schoolProfileDoc, govSources.rename, govSources.baike],
      },
      {
        id: 'overview-culture',
        title: '校园文化与新貌',
        eyebrow: '今日石实',
        summary:
          '120亩校园实拍：从校门、行健楼到体育馆、图书馆，从孔圣园到体艺节大舞台——看今日石实的成长现场。',
        paragraphs: [
          '2019年迁址大沥太平后，学校在120亩校园里完整承载教学、住宿与运动：校门与校训石迎接每一位师生，教学楼与行健楼里是明亮的常规教室，孔圣园让"任重道远"的校训在礼乐中可感可触。',
          '运动与阅读场景一应俱全：400米标准跑道田径场、足球场、体育馆支撑每天的运动量；图书馆是广东省最美阅读空间，合唱室、美术室、机器人专训室、模拟法庭等功能室让扬长课程有真正的落地场景；宿舍与A级阳光饭堂守护寄宿生活的每一天。',
          '学生的舞台则更加广阔：第26届体艺节精品节目展演以"以爱筑未来·扬长共出彩"为主题，超3000名学生同台表演；首届数学文化周暨科技节开放日吸引近万人打卡；扬长大舞台让学生自编自导自演，绽放个人风采。',
        ],
        facts: [
          '校园：占地120亩，93个教学班、4000人办学规模',
          '孔圣园：祭孔仪式等中华传统文化活动',
          '400米跑道田径场 / 足球场 / 体育馆：每天运动有场地',
          '图书馆：广东省最美阅读空间',
          '功能室：合唱室 / 美术室 / 机器人专训室 / 模拟法庭',
          '宿舍与饭堂：寄宿生活配套，食堂获评食品安全卫生等级 A 级单位',
          '第26届体艺节：超3000名学生同台展演',
        ],
        images: [
          { src: photoGate, variant: 'card', caption: '校门' },
          { src: photoTeachingBuilding, variant: 'card', caption: '教学楼' },
          { src: photoXingjianBuilding, variant: 'card', caption: '行健楼' },
          { src: photoMottoStone, variant: 'card', caption: '校训石' },
          { src: photoKongshengyuan, variant: 'card', caption: '孔圣园' },
          { src: photoTrackField, variant: 'card', caption: '400米跑道田径场' },
          { src: photoFootballField, variant: 'card', caption: '足球场' },
          { src: photoGym, variant: 'card', caption: '体育馆' },
          { src: photoLibrary, variant: 'card', caption: '图书馆' },
          { src: photoBrightClassroom, variant: 'card', caption: '明亮教室' },
          { src: photoChoirRoom, variant: 'card', caption: '合唱室' },
          { src: photoArtRoom, variant: 'card', caption: '美术室' },
          { src: photoRoboticsLab, variant: 'card', caption: '机器人专训室' },
          { src: photoMootCourt, variant: 'card', caption: '模拟法庭' },
          { src: photoDormitory, variant: 'card', caption: '学生宿舍' },
          { src: photoCanteen, variant: 'card', caption: '学生饭堂' },
          { src: photoArtsFestivalFlags, variant: 'card', caption: '体艺节现场' },
          { src: photoArtsFestivalGala, variant: 'card', caption: '体艺节晚会' },
        ],
        narration:
          '欢迎来到今日石实。校园占地一百二十亩：校门与校训石迎来送往，教学楼与行健楼里书声琅琅，孔圣园让校训在礼乐中可感可触。四百米跑道田径场、足球场和体育馆支撑每天的运动，图书馆是最美阅读空间，合唱室、美术室、机器人专训室、模拟法庭让扬长课程有真正的落地场景，宿舍与阳光饭堂守护寄宿生活的每一天。体艺节晚会上，三千多名学生同台绽放。校园不只是上课的地方，更是阅读、运动、表达和发现兴趣的成长现场。',
        sources: [govSources.schoolProfileDoc, govSources.brochure],
      },
    ],
  },
  {
    id: 'achievements',
    navLabel: '办学成果',
    eyebrow: 'ACHIEVEMENTS',
    banner: honorGaozhiliang,
    intro: '荣誉墙、信息学、科创、数学强基、美育与社团、扬长课程、教师成长、学习标兵——看看石实多元办学的成果。',
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
        id: 'ach-informatics',
        title: '信息学',
        eyebrow: '竞赛领航 · 长期培养',
        summary:
          '校方通报（2026-10）：累计43位学子录取清北、13位凭信息学特长保送清北；GDOI2025 省选34人获全国一等奖，包揽区赛2个特等奖。',
        paragraphs: [
          '在信息学方向，学校形成了长期培养的公开口碑。校方2026年10月通报：办学以来累计43位学子录取清华、北大，其中13位凭信息学特长保送（此前南方+曾报道《佛山唯一！保送北大！》；2025年高考4名毕业生入读清北——陈哲章保送北京大学、蔡涵森被清华大学飞行员班录取）。',
          '竞赛成绩同样亮眼：2024年信息学竞赛再创新高，GDOI2025 暨 NOI2025 广东省队选拔赛中，34人获全国赛一等奖、10人获全省一等奖，1枚全国金牌、1个全省团体第一；包揽区赛2个特等奖，全区前5独占4人。学校还承办了2025年广东省信息学选拔赛。',
          '这里更值得关注的不是一个数字，而是兴趣如何通过持续训练、问题解决和项目实践，逐步变成真正的能力。页面不展示未成年人的姓名、班级和具体分数。',
        ],
        facts: [
          '校方通报（2026-10）：累计43位学子录取清北，其中13位凭信息学特长保送',
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
          '在信息学方向，石实实验学校形成了长期培养的公开口碑。南方加二零二五年报道提到，学校近年来已有十三位学子凭信息学特长保送清华、北大；校方最新通报显示，办学以来累计四十三位学子录取清华、北大，其中十三位凭信息学特长保送。竞赛方面，GDOI二零二五省队选拔赛中学校三十四人获全国一等奖，并包揽区赛两个特等奖。比数字更重要的，是兴趣通过持续训练变成真正能力的过程。',
        sources: [govSources.information, govSources.brochure],
      },
      {
        id: 'ach-stem',
        title: '科创',
        eyebrow: '人工智能 · 机器人与无人机',
        summary:
          'VEX机器人亚洲公开赛总决赛创星组团队冠军、美国VEX机器人世界锦标赛世界级一等奖；无人机战队首次征战即获全国一等奖。',
        paragraphs: [
          '科创是学校拔尖创新人才培养的重要方向。学校设有科创集训中心（招生简章四大集训中心之一，与信息学、数学强基、人文与科学素养并列），建有VEX机器人专训室等专用场地，由金牌教练团队带队训练。',
          '机器人战队近年战绩（据学校2026年招生简章）：2025-2026 VEX机器人亚洲公开赛总决赛VIQRC赛项创星组团队冠军、技能赛亚军；2025大湾区VEX机器人全国邀请赛初中组冠军；2025佛山VEX机器人校际联赛冠军；2024年1月VEX机器人亚洲公开赛全国邀请赛佛山站国家级一等奖；2024年5月美国VEX机器人世界锦标赛世界级一等奖。',
          '无人机战队首次征战，即斩获全国青少年球形无人机攻防对抗赛全国一等奖，并亮相2025年全国青少年航天创新大赛总决赛颁奖仪式。从搭建、编程到赛场博弈，学生在真实工程问题中把兴趣练成能力。',
        ],
        facts: [
          '2025-2026 VEX机器人亚洲公开赛总决赛VIQRC赛项创星组团队冠军、技能赛亚军',
          '2024年5月美国VEX机器人世界锦标赛世界级一等奖',
          '2025大湾区VEX机器人全国邀请赛初中组冠军',
          '2025佛山VEX机器人校际联赛冠军',
          '2024年1月VEX机器人亚洲公开赛全国邀请赛佛山站国家级一等奖',
          '无人机战队首战获全国青少年球形无人机攻防对抗赛全国一等奖',
        ],
        images: [
          { src: campusVexLab, variant: 'card', caption: 'VEX机器人专训室（2026 校方实景）' },
          { src: smartCampus, variant: 'card', caption: '智慧校园指挥中心' },
        ],
        narration:
          '在科创方向，学校设有科创集训中心，建有VEX机器人专训室。机器人战队在二零二五到二零二六赛季夺得VEX机器人亚洲公开赛总决赛创星组团队冠军和技能赛亚军，还在二零二四年五月美国VEX机器人世界锦标赛上获得世界级一等奖；无人机战队首次征战就拿下全国青少年球形无人机攻防对抗赛全国一等奖。从搭建、编程到赛场博弈，同学们在真实的工程问题中把兴趣练成真正的能力。',
        sources: [govSources.brochure],
      },
      {
        id: 'ach-math',
        title: '数学强基',
        eyebrow: '数学强基 · 拔尖培养',
        summary:
          '数学强基集训中心汇集金牌教练团队；佛山市中小学数学教育高质量发展实验校；数学文化周暨科技节开放日近万人打卡。',
        paragraphs: [
          '学校设有数学强基集训中心（招生简章四大集训中心之一），面向九年一贯制小初一体化拔尖创新人才培养，由竞赛教练团队长期带队。教练团队包括王海瀚（南开大学高材生，数学竞赛总教练）、朱雄伟（初中数学高级教师，全国初中数学竞赛金牌教练、中考备考专家库成员）、赵建华（小学数学特级教师，学校副校长，小学数学名师工作室主持人）等。',
          '学校获评佛山市中小学数学教育高质量发展实验校（市级荣誉）。2026年3月，学校举办首届数学文化周暨科技节开放日，校园开放活动吸引近万人打卡，数学游戏、科技体验与课堂展示让家长和同学近距离感受数学的乐趣。',
          '数学强基与信息学、科创等方向互相贯通：扎实的数学基础既是竞赛能力的地基，也是小初一体化长程培养的起点。',
        ],
        facts: [
          '数学强基集训中心：简章四大集训中心之一',
          '佛山市中小学数学教育高质量发展实验校（市级）',
          '教练团队：数学竞赛总教练王海瀚、全国初中数学竞赛金牌教练朱雄伟、特级教师赵建华等',
          '2026年3月首届数学文化周暨科技节开放日，近万人打卡',
          '九年一贯制小初一体化拔尖创新人才培养',
        ],
        images: [
          { src: stemOpenDay, variant: 'card', caption: '首届数学文化周暨科技节开放日（2026.03）' },
          { src: campusInformaticsLab, variant: 'card', caption: '专训室（2026 校方实景）' },
        ],
        narration:
          '学校设有数学强基集训中心，是招生简章里四大集训中心之一，由王海瀚、朱雄伟、赵建华等竞赛教练和特级教师长期带队，面向九年一贯制的小初一体化拔尖培养。学校还是佛山市中小学数学教育高质量发展实验校。二零二六年三月举办的首届数学文化周暨科技节开放日，吸引了近万人进校打卡。扎实的数学基础，既是竞赛能力的地基，也是长程培养的起点。',
        sources: [govSources.brochure],
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
        id: 'ach-courses',
        title: '扬长课程',
        eyebrow: '扬长教育 · 人人出彩',
        summary:
          '"扬长教育"办学品牌：每学期开设130余门扬长选修课（校方2026-11口径）；四大集训中心与课后服务社团，让每个孩子都有出彩舞台。',
        paragraphs: [
          '"扬长教育、人人出彩"是学校的办学理念。校方2026年11月口径：学校每学期开设130余门扬长选修课（2026年招生简章印载口径为每学期超100门），让学生按兴趣选课、按特长发展，扬长课堂覆盖科技、艺术、体育、人文、劳动等多个领域。',
          '课程体系的高地是四大集训中心：信息学、数学强基、人文与科学素养、科创（招生简章亮点），汇集全国名师与金牌教练，强强联手打造拔尖创新人才培养体系；九年一贯制、小初一体化让长程培养从小学阶段即可起步。',
          '成长不止在教室：课后服务开设体育、艺术、心理等特色社团；爱乐农场里学生、家长与教师并肩劳作；合唱团、美术之夜、校园戏剧等平台常年开放——每个孩子都能找到愿意投入的舞台。',
        ],
        facts: [
          '每学期开设130余门扬长选修课（校方2026-11口径；简章印载超100门）',
          '四大集训中心：信息学、数学强基、人文与科学素养、科创',
          '九年一贯制、小初一体化拔尖创新人才培养',
          '课后服务开设体育、艺术、心理等特色社团',
          '爱乐农场：劳动教育实践基地',
        ],
        images: [
          { src: joyFarm, variant: 'card', caption: '爱乐农场劳动教育课程' },
          { src: campusChoirRoom, variant: 'card', caption: '合唱室（2026 校方实景）' },
        ],
        narration:
          '"扬长教育、人人出彩"是学校的办学理念。按校方二零二六年十一月的口径，学校每学期开设一百三十多门扬长选修课，让学生按兴趣选课、按特长发展。课程体系的高地是信息学、数学强基、人文与科学素养、科创四大集训中心，九年一贯制让长程培养从小学起步。课后还有体育、艺术、心理等特色社团，爱乐农场里同学们和老师家长一起劳作。每个孩子都能找到愿意投入的舞台。',
        sources: [govSources.brochure],
      },
      {
        id: 'ach-teachers',
        title: '教师成长',
        eyebrow: '师资雄厚 · 育人案例',
        summary:
          '280余名专任教师中，有正高级教师4人、特级教师2人、博士教师2人；教师案例进入全国展示名单。',
        paragraphs: [
          '学校拥有一支高水平的教师队伍。据校方招生简章：学校现有逾280名专任教师，其中正高级教师4人、特级教师2人、博士教师2人，市区级学科带头人、名师、名班主任等中坚力量逾百人；拥有3个广东省优秀科组、8个佛山市优秀科组以及3个佛山市学科基地。',
          '教师的专业成长最终回到学生身上。南海区教育局公开报道显示，学校教师的育人故事、带班方略和主题班会案例入选全国中小学班主任基本功展示交流活动典型经验名单，案例覆盖班级文化、劳动实践与地方文化传承。',
          '多位全国知名专家受聘担任学校教育顾问、荣誉科学副校长，为拔尖创新人才早期培养提供专业指导。',
        ],
        facts: [
          '逾280名专任教师',
          '正高级教师4人、特级教师2人、博士教师2人',
          '市区级学科带头人、名师、名班主任等逾百人',
          '3个广东省优秀科组、8个佛山市优秀科组、3个佛山市学科基地',
          '教师案例入选全国班主任基本功展示交流活动典型经验',
        ],
        images: [
          { src: honorJiaoshi, variant: 'card', caption: '南海区教育发展研究中心首个基地学校' },
          { src: masterWall, variant: 'card', caption: '名人文化柱廊（榜样教育）' },
        ],
        narration:
          '石实实验学校拥有一支高水平的教师队伍：两百八十多名专任教师中，有正高级教师、特级教师和博士教师，市区级学科带头人、名师、名班主任等中坚力量超过百人。南海区教育局公开报道还显示，学校教师的育人故事、带班方略和主题班会案例入选了全国中小学班主任基本功展示交流活动典型经验。好的教育成果，往往从教师愿意研究学生、理解班级开始。',
        sources: [govSources.brochure, govSources.teacherGrowth],
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
    navLabel: '招生咨询',
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
          '石实实验学校是九年一贯制全日制寄宿制民办实验学校，现校址占地120亩，现有93个教学班。学校地处佛山市南海区大沥镇太平社区，校园教学、住宿、体育设施完善。',
          '据学校微信公众号"石实"发布的2026年招生简章，学校2026年计划招收七年级新生950人，其中面向大沥镇招生570个。小学部于2024年复办，复办首年一年级计划招生160人。',
          '具体招生范围、报名方式与录取办法以南海区教育行政部门和学校当年正式公布为准，家长可通过"石实"微信公众号及招生办咨询电话了解最新信息。',
        ],
        facts: [
          '办学层次：九年一贯制（小学部2024年复办）',
          '校园占地：120亩 · 现有93个教学班',
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
          '石实实验学校是九年一贯制全日制寄宿制民办实验学校，现校址占地一百二十亩，现有九十三个教学班。根据学校公众号发布的二零二六年招生简章，学校计划招收七年级新生九百五十人，其中面向大沥镇五百七十个；小学部于二零二四年复办。请注意，具体招生政策以教育部门和学校当年公布为准。',
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
          '小学招生办咨询电话：18927205583（蔡老师）',
          '学校邮箱：18925911573@163.com',
        ],
        // 2026-11-08 用户反馈「这个地方换成学校的微信公众号的二维码」（图4：
        // 报读咨询卡片里的"学校微信公众号：石实"文字条 → 可扫的二维码）
        wechatQr: { src: gzhQrCode, caption: '学校微信公众号「石实」' },
        factsAfterQr: [
          '学校地址：佛山市南海区大沥镇太平社区体育南路20号',
        ],
        images: [],
        narration:
          '如需报读咨询，可以拨打学校招生办电话：初中部一八九二五九一一五七三蔡老师，小学部一八九二七二零五五八三蔡老师；也可以关注学校微信公众号"石实"，或按招生简章指引填写入读意向。学校地址在佛山市南海区大沥镇太平社区体育南路二十号，欢迎家长和同学到校参观。',
        sources: [govSources.brochure],
      },
      {
        id: 'adm-faq',
        title: '常见问答',
        eyebrow: 'FAQ',
        summary:
          '关于学校性质、位置、办学特色、成果与收费、宿舍、作息等招生常见问题，数字人"小石同学"也可以随时为你解答。',
        paragraphs: [
          '问：石实实验学校是什么性质的学校？答：九年一贯制全日制寄宿制民办实验学校，前身为1999年创办的石门实验学校，2023年经南海区教育局批复更名。',
          '问：学校在哪里？答：佛山市南海区大沥镇太平社区体育南路20号（太平校区），2019年前后由大沥黄岐迁入。',
          '问：学校有什么办学特色？答：秉承"任重道远、毋忘奋斗"校训，坚持"扬长教育、人人出彩"理念；信息学竞赛成绩突出，防震减灾科普、美育体艺、劳动教育全面发展。',
          '问：办学成果如何？答：据公开报道与校方资料，全国防震减灾科普示范学校（全市唯一）、首批全国健康学校建设单位；校方通报办学以来累计43位学子录取清北、13位凭信息学特长保送；连续三年获南海区初中教育高质量发展一等奖。',
          '问：想了解更多或预约参观怎么办？答：拨打招生办电话、关注微信公众号"石实"，或直接在对话页与数字人"小石同学"交流。',
          // ↓ 2026-11-09 校方《招生常见问题回复》30 题（xlsx 33 题删 3 个无答案：
          //   插班生学籍何时转／初中作息／扬长课有哪些，待校方补充后再录）。
          '问：小学收费标准如何？答：学费20500元/学期；伙食费4200元/学期；住宿费1500元/学期；校服+床品2129元/次；一卡通180元/年。',
          '问：初中收费标准如何？答：学费23000元/学期；伙食费4200元/学期；住宿费1500元/学期；校服+床品1497元/次；一卡通180元/年。',
          '问：幼升小、小升初什么条件才可以报名？答：南海区户口或居住证可以参与摇号；南海区房产、工作证明或社保可以参与补录。',
          '问：小学宿舍是几人间？答：8人间。',
          '问：初中宿舍是几人间？答：6-10人间。',
          '问：宿舍有几个洗澡间、几个厕所？答：2个独立卫浴。',
          '问：小学每个年级有多少个班、每个班多少人？答：班级数量每年视招生政策而定、不固定；小学40人/班。',
          '问：初中每个年级有多少个班、每个班多少人？答：初中每年级大概19个班，50人/班。',
          '问：小学校服在哪里买？答：可通过班主任老师索要商城二维码线上采购。',
          '问：初中校服在哪买？答：可直接在学校小卖部购买。',
          '问：小卖部怎么消费？答：学生刷脸消费，家长需提前充值。',
          '问：伙食一天多少餐？答：一天六餐（3个正餐，3个加餐）。',
          '问：课间餐有什么？答：面包、水果、牛奶，具体按学校食堂每日供货为准。',
          '问：开放日是什么时候？答：请家长留意关注"佛山石实实验学校"微信公众号，开放日具体信息会提前在公众号上发布。',
          '问：插班生招多少人？答：视招生政策而定，不固定。',
          '问：转学的流程是什么？答：开学后提交转学申请表及南海区户口本/居住证/工作证明等资料给到班主任，学校教学处统一处理转学籍相关流程和手续。',
          '问：小学学生作息时间？答：7:30早餐，8:00-8:15教室晨读，8:20-11:35上午课程，11:40-14:00午餐及午休，14:15-16:50下午课程，18:20晚修；一二年级19:40放学，三到六年级20:30放学。',
          '问：小学每个班有几个生活老师？答：每个班有1名生活老师。',
          '问：初中每个班有几个生活老师？答：初中暂不配备生活老师，宿舍会安排宿管处理学生事务。',
          '问：初中可以走读吗？答：如无特殊情况统一住宿不走读；有特殊情况可与班主任老师申请。',
          '问：住宿生可以周中接回去吗？答：有特殊情况可与班主任老师申请；学校每天都有课程和活动安排，建议尽量周五统一接送。',
          '问：家长可以送东西来学校吗？答：可以，提前和班主任老师沟通。',
          '问：哥哥姐姐在这里读，弟弟妹妹想插班能不能不要考试直接过来？答：视招生政策而定。',
          '问：小学学生课程安排？答：每天都固定有语文、数学、英语、体育课；音乐、美术、信息学、道法、心理课等视课时量安排。',
          // 「100多门」按校方 2026-11-08 首页口径「130+门扬长选修课」对齐
          '问：除了常规课程，有兴趣班吗？答：有，学校有130多门扬长课程供学生选读。',
          '问：扬长课是什么时间上课？答：小学扬长课每周二下午；初中扬长课每周三下午。',
          '问：周末要补课吗？答：周末不安排补课。',
          '问：专训队要怎么进？答：参与学校专训队选拔。',
          '问：初中开学后有军训吗？答：有，训练时间为一周。',
          '问：家长是否可以每周中途接孩子回家一次？答：不太建议；学校每天都有课程和活动安排，尽量周五统一接送。',
        ],
        facts: [
          'Q：学校性质？A：九年一贯制寄宿制民办实验学校',
          'Q：地址？A：南海区大沥镇太平社区体育南路20号',
          'Q：特色？A：扬长教育 · 信息学 · 防震减灾科普 · 美育体艺',
          'Q：成果？A：累计43位学子录取清北 · 13位保送 · 连续三年区高质量发展一等奖',
          'Q：了解更多？A：招生办电话 / 公众号"石实" / 与小石同学对话',
        ],
        images: [{ src: campusTrack, variant: 'card', caption: '田径运动场（2026 校方实景）' }],
        narration:
          '关于招生咨询的常见问题：石实实验学校是九年一贯制全日制寄宿制民办实验学校，位于大沥镇太平社区体育南路二十号。学校秉承扬长教育、人人出彩的理念，信息学竞赛成绩突出，校方通报累计43位学子录取清北、13位保送。关于收费、宿舍、作息、扬长课程等更多招生常见问题，可以拨打招生办电话或关注学校公众号，也可以在对话页和我聊聊。',
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
