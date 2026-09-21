/**
 * 全站官网化主题（2026-09-21 全站改版）
 * 石实官方色调，取样自校方《石门实验学校IP设计（终稿）》：
 * - 绛红 #901B35：IP 标准姿势页主背景 → 全站主色（横带/激活态/主按钮/板块标题）
 * - 青绿 #2DAFAD：小石刻舟布衣 → 次点缀（眉行/标签/公告日期 chip）
 * - 藏青 #0D2241：IP 封面底 → 标题墨色
 * 米白纸感底 + 白纸面沿用首页官网化的基调。全站页面（首页/专题页/对话页）
 * 的颜色与字体一律从这里取，禁止各文件再散落定义。
 */

export const siteTheme = {
  red: '#901B35', // 绛红（IP 官方主色）
  redDark: '#6E1226', // 绛红按压/悬停深一档
  redWash: '#F5E7EA', // 绛红淡洗（hover 底、日期 chip）
  teal: '#2DAFAD', // 青绿（次点缀）
  tealWash: '#E4F4F3', // 青绿淡洗
  navy: '#0D2241', // 藏青（标题墨色）
  textBody: '#4B5563', // 正文（中灰）
  textSecondary: '#6B7280', // 次要文字（浅灰）
  wash: '#FAF7F2', // 米白纸感底
  hairline: '#E8E2D9', // 纸感分隔线（米调，替代冷灰）
  paper: '#FFFFFF',
} as const;

export const kaiFont = "'STKaiti','KaiTi','楷体','Noto Serif SC',serif";
export const swissFont = '"Helvetica Neue", Arial, sans-serif';
