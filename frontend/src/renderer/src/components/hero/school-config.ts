/**
 * 学校信息与导航配置
 * 新首页（home-page）与对话界面（hero-landing）共用，避免两处配置漂移
 */
import {
  FiAward,
  FiBook,
  FiClock,
  FiHome,
  FiMessageCircle,
  FiUsers,
} from 'react-icons/fi';

export interface SchoolNavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

export const SCHOOL_CONFIG = {
  name: '石实实验学校',
  description: '与AI数字人"小石"对话，探索知识的无限可能',
  navigation: [
    { id: 'home', label: '首页', icon: FiHome },
    { id: 'chat', label: '对话界面', icon: FiMessageCircle },
    { id: 'intro', label: '学校简介', icon: FiBook },
    { id: 'history', label: '校史', icon: FiClock },
    { id: 'achievements', label: '学校成就', icon: FiAward },
    { id: 'role-models', label: '学习标兵', icon: FiUsers },
  ] as SchoolNavItem[],
};
