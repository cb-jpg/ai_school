/**
 * AI知识库助手 - Main管理工作台
 * 基于SaaS landing page设计风格的后台Layout组件
 */

import { FC, ReactNode, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiHome,
  FiDatabase,
  FiSettings,
  FiFileText,
  FiUpload,
  FiBarChart2,
  FiBookOpen,
  FiUsers,
  FiChevronLeft,
  FiChevronRight,
  FiBell,
  FiSearch,
  FiLogOut,
} from 'react-icons/fi';
import { createToaster } from '@chakra-ui/react';

// Toast通知
const toaster = createToaster({
  placement: 'top-end',
  overlap: true,
  max: 3
});

// 动画变体配置
const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const fadeInUpDelayed = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

// 类型定义
interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  children?: NavItem[];
  path?: string;
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  activeItem: string;
  onItemClick: (itemId: string) => void;
}

interface HeaderProps {
  sidebarCollapsed: boolean;
  userName?: string;
}

interface DashboardLayoutProps {
  children: ReactNode;
  defaultActiveItem?: string;
}

// 侧边栏组件
const Sidebar: FC<SidebarProps> = ({ isCollapsed, onToggle, activeItem, onItemClick }) => {
  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: '工作台',
      icon: FiHome,
      path: '/dashboard'
    },
    {
      id: 'knowledge',
      label: '知识库管理',
      icon: FiDatabase,
      children: [
        { id: 'knowledge-list', label: '知识列表', icon: FiFileText },
        { id: 'knowledge-upload', label: '上传管理', icon: FiUpload },
        { id: 'knowledge-stats', label: '统计分析', icon: FiBarChart2 }
      ]
    },
    {
      id: 'campus',
      label: '校园内容',
      icon: FiBookOpen,
      children: [
        { id: 'campus-history', label: '校史管理', icon: FiFileText },
        { id: 'campus-achievements', label: '成就管理', icon: FiFileText },
        { id: 'campus-role-models', label: '标兵管理', icon: FiUsers }
      ]
    },
    {
      id: 'settings',
      label: '系统设置',
      icon: FiSettings,
      path: '/settings'
    }
  ];

  const [expandedSections, setExpandedSections] = useState<string[]>(['knowledge', 'campus']);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  return (
    <motion.aside
      initial={{ width: isCollapsed ? 80 : 280 }}
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="bg-background border-r border-border h-screen flex flex-col"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {/* Logo区域 */}
      <div className="h-16 flex items-center px-6 border-b border-border">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">AI</span>
          </div>
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-lg font-semibold text-foreground tracking-tight"
            >
              知识库助手
            </motion.span>
          )}
        </motion.div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 overflow-y-auto py-6 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.id}>
              {item.children ? (
                // 有子菜单的项目
                <div>
                  <button
                    onClick={() => {
                      onItemClick(item.id);
                      if (!isCollapsed) toggleSection(item.id);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                      activeItem === item.id || activeItem?.startsWith(item.id)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-sm font-medium"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </div>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, rotate: expandedSections.includes(item.id) ? 90 : 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <FiChevronRight className="w-4 h-4" />
                      </motion.div>
                    )}
                  </button>

                  {/* 子菜单 */}
                  {!isCollapsed && expandedSections.includes(item.id) && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-1 ml-8 space-y-1"
                    >
                      {item.children.map((child) => (
                        <li key={child.id}>
                          <button
                            onClick={() => onItemClick(child.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                              activeItem === child.id
                                ? 'text-accent font-medium'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {child.icon && <child.icon className="w-4 h-4" />}
                            {child.label}
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </div>
              ) : (
                // 无子菜单的项目
                <button
                  onClick={() => onItemClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    activeItem === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-sm font-medium"
                    >
                      {item.label}
                    </motion.span>
                  )}
                  {item.badge && !isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      className="ml-auto bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded-full"
                    >
                      {item.badge}
                    </motion.span>
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* 底部折叠按钮 */}
      <div className="p-3 border-t border-border">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
        >
          {isCollapsed ? (
            <FiChevronRight className="w-5 h-5" />
          ) : (
            <>
              <FiChevronLeft className="w-5 h-5" />
              <span className="text-sm">收起侧边栏</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
};

// 顶部导航栏组件
const Header: FC<HeaderProps> = ({ sidebarCollapsed, userName = '管理员' }) => {
  const [notifications] = useState([
    { id: 1, message: '知识库更新完成', time: '5分钟前' },
    { id: 2, message: '新的文档上传', time: '1小时前' },
  ]);

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 z-20">
      {/* 搜索栏 */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索知识库、文档..."
            className="w-80 pl-10 pr-4 py-2 bg-secondary rounded-lg text-sm border-0 focus:outline-none focus:ring-2 focus:ring-accent/20"
            style={{ fontFamily: 'var(--font-body)' }}
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs text-muted-foreground bg-background rounded border border-border">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* 右侧操作区 */}
      <div className="flex items-center gap-4">
        {/* 通知按钮 */}
        <button className="relative p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <FiBell className="w-5 h-5" />
          {notifications.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
          )}
        </button>

        {/* 用户菜单 */}
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">{userName}</p>
            <p className="text-xs text-muted-foreground">系统管理员</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center text-white font-medium">
            {userName.charAt(0)}
          </div>
          <button
            onClick={() => toaster.create({ title: '已退出登录', status: 'info' })}
            className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            title="退出登录"
          >
            <FiLogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

// 主布局组件
export const DashboardLayout: FC<DashboardLayoutProps> = ({
  children,
  defaultActiveItem = 'dashboard'
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState(defaultActiveItem);

  return (
    <div
      className="flex h-screen bg-background overflow-hidden"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {/* 侧边栏 */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeItem={activeItem}
        onItemClick={setActiveItem}
      />

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部导航 */}
        <Header sidebarCollapsed={sidebarCollapsed} />

        {/* 内容区域 */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="p-6 md:p-8"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Toast通知容器 */}
      <div id="toast-container" />
    </div>
  );
};

// 页面标题组件
export const PageHeader: FC<{
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}> = ({ title, subtitle, actions }) => (
  <motion.div
    {...fadeInUpDelayed}
    className="mb-8"
  >
    <div className="flex items-start justify-between">
      <div>
        <h1
          className="text-3xl md:text-4xl font-semibold text-foreground mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-base text-muted-foreground max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          {actions}
        </motion.div>
      )}
    </div>
  </motion.div>
);

// 统计卡片组件
export const StatCard: FC<{
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ElementType;
}> = ({ title, value, change, trend, icon: Icon }) => (
  <motion.div
    {...fadeInUp}
    className="bg-background rounded-xl border border-border p-6 hover:shadow-lg transition-shadow"
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        {change && (
          <p
            className={`text-sm mt-2 ${
              trend === 'up' ? 'text-green-600' :
              trend === 'down' ? 'text-red-600' :
              'text-muted-foreground'
            }`}
          >
            {change}
          </p>
        )}
      </div>
      {Icon && (
        <div className="p-3 rounded-lg bg-secondary/50">
          <Icon className="w-5 h-5 text-accent" />
        </div>
      )}
    </div>
  </motion.div>
);

// 内容卡片组件
export const ContentCard: FC<{
  title: string;
  children: ReactNode;
  className?: string;
}> = ({ title, children, className = '' }) => (
  <motion.div
    {...fadeInUpDelayed}
    className={`bg-background rounded-xl border border-border overflow-hidden ${className}`}
  >
    <div className="px-6 py-4 border-b border-border">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
    </div>
    <div className="p-6">
      {children}
    </div>
  </motion.div>
);

export default DashboardLayout;
