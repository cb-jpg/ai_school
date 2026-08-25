/**
 * AI知识库助手 - 工作台首页
 * 展示系统概览、快速操作和最近活动
 */

import { FC, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiDatabase,
  FiUpload,
  FiSearch,
  FiTrendingUp,
  FiUsers,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiPlus,
  FiArrowRight,
  FiFileText,
  FiBook,
  FiBarChart3,
} from 'react-icons/fi';
import {
  DashboardLayout,
  PageHeader,
  StatCard,
  ContentCard,
} from './admin-dashboard-layout';
import { createToaster } from '@chakra-ui/react';

const toaster = createToaster({
  placement: 'top-end',
  overlap: true,
  max: 3
});

// 模拟统计数据
const statsData = [
  {
    title: '知识条目',
    value: '1,248',
    change: '+12.5%',
    trend: 'up' as const,
    icon: FiDatabase,
  },
  {
    title: '本月上传',
    value: '89',
    change: '+8.2%',
    trend: 'up' as const,
    icon: FiUpload,
  },
  {
    title: '搜索次数',
    value: '3,456',
    change: '+23.1%',
    trend: 'up' as const,
    icon: FiSearch,
  },
  {
    title: '活跃用户',
    value: '456',
    change: '+5.8%',
    trend: 'up' as const,
    icon: FiUsers,
  },
];

// 模拟最近活动
const recentActivities = [
  {
    id: 1,
    type: 'upload',
    message: '上传了新文档《校史资料2024》',
    user: '张老师',
    time: '5分钟前',
    status: 'completed',
  },
  {
    id: 2,
    type: 'edit',
    message: '更新了知识条目《学校成就》',
    user: '李老师',
    time: '15分钟前',
    status: 'completed',
  },
  {
    id: 3,
    type: 'create',
    message: '创建了新知识分类《学生活动》',
    user: '王老师',
    time: '1小时前',
    status: 'completed',
  },
  {
    id: 4,
    type: 'delete',
    message: '删除了过期文档《招生简章2023》',
    user: '系统',
    time: '2小时前',
    status: 'completed',
  },
  {
    id: 5,
    type: 'error',
    message: '文档《课程介绍.pdf》处理失败',
    user: '系统',
    time: '3小时前',
    status: 'error',
  },
];

// 快速操作
const quickActions = [
  { id: 1, label: '上传文档', icon: FiUpload, color: 'bg-blue-500' },
  { id: 2, label: '添加知识', icon: FiFileText, color: 'bg-green-500' },
  { id: 3, label: '管理分类', icon: FiBook, color: 'bg-purple-500' },
  { id: 4, label: '查看统计', icon: FiBarChart3, color: 'bg-orange-500' },
];

// 知识库搜索趋势数据（模拟图表）
const searchTrends = [
  { day: '周一', searches: 320 },
  { day: '周二', searches: 450 },
  { day: '周三', searches: 380 },
  { day: '周四', searches: 520 },
  { day: '周五', searches: 610 },
  { day: '周六', searches: 280 },
  { day: '周日', searches: 190 },
];

// SVG曲线图组件
const TrendChart: FC = () => {
  const maxSearches = Math.max(...searchTrends.map(d => d.searches));
  const chartHeight = 80;
  const chartWidth = 100;
  const points = searchTrends.map((d, i) => {
    const x = (i / (searchTrends.length - 1)) * chartWidth;
    const y = chartHeight - (d.searches / maxSearches) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  // 创建填充区域的点
  const fillPoints = `0,${chartHeight} ${points} ${chartWidth},${chartHeight}`;

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      className="w-full h-20"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="15%" stopColor="hsl(var(--accent))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* 填充区域 */}
      <polygon
        points={fillPoints}
        fill="url(#chartGradient)"
      />
      {/* 曲线 */}
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--accent))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// 活动项组件
const ActivityItem: FC<{
  activity: typeof recentActivities[0];
  index: number;
}> = ({ activity, index }) => {
  const getIcon = () => {
    switch (activity.status) {
      case 'completed':
        return <FiCheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <FiAlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <FiClock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="flex items-start gap-4 py-4 border-b border-border last:border-0"
    >
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">{activity.message}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {activity.user} · {activity.time}
        </p>
      </div>
    </motion.div>
  );
};

// 主工作台组件
export const AdminHomepage: FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleQuickAction = (actionId: number) => {
    const action = quickActions.find(a => a.id === actionId);
    if (action) {
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        toaster.create({
          title: `执行${action.label}`,
          description: '功能开发中，敬请期待',
          status: 'info'
        });
      }, 500);
    }
  };

  return (
    <DashboardLayout defaultActiveItem="dashboard">
      {/* 页面头部 */}
      <PageHeader
        title="工作台"
        subtitle="欢迎回来！这是您的AI知识库助手管理工作台概览。"
        actions={
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-5 py-2.5 bg-accent text-white rounded-full text-sm font-medium flex items-center gap-2"
            onClick={() => handleQuickAction(1)}
          >
            <FiPlus className="w-4 h-4" />
            新建项目
          </motion.button>
        }
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsData.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* 主要内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 快速操作面板 */}
        <ContentCard title="快速操作" className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, index) => (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleQuickAction(action.id)}
                disabled={isProcessing}
                className={`flex flex-col items-center justify-center p-6 rounded-xl border border-border hover:shadow-md transition-all ${
                  isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div className={`w-12 h-12 rounded-full ${action.color} flex items-center justify-center mb-3`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-medium text-foreground">{action.label}</span>
              </motion.button>
            ))}
          </div>
        </ContentCard>

        {/* 搜索趋势图表 */}
        <ContentCard title="本周搜索趋势" className="lg:col-span-2">
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-2xl font-semibold text-foreground">
                {searchTrends.reduce((sum, d) => sum + d.searches, 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">总搜索次数</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-600 font-medium">+18.2%</span>
              <span className="text-muted-foreground">较上周</span>
            </div>
          </div>
          <TrendChart />
          <div className="flex justify-between mt-3 text-xs text-muted-foreground">
            {searchTrends.map((d) => (
              <span key={d.day}>{d.day}</span>
            ))}
          </div>
        </ContentCard>

        {/* 最近活动 */}
        <ContentCard title="最近活动" className="lg:col-span-2">
          <div className="space-y-0">
            {recentActivities.map((activity, index) => (
              <ActivityItem key={activity.id} activity={activity} index={index} />
            ))}
          </div>
          <motion.button
            whileHover={{ x: 5 }}
            className="mt-4 text-sm text-accent font-medium flex items-center gap-2 mx-auto"
          >
            查看全部活动
            <FiArrowRight className="w-4 h-4" />
          </motion.button>
        </ContentCard>

        {/* 系统状态 */}
        <ContentCard title="系统状态" className="lg:col-span-1">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">知识库服务</span>
              <span className="flex items-center gap-2 text-sm text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                正常
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">搜索引擎</span>
              <span className="flex items-center gap-2 text-sm text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                正常
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">AI服务</span>
              <span className="flex items-center gap-2 text-sm text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                正常
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">存储空间</span>
              <span className="text-sm text-foreground">45.2 GB / 100 GB</span>
            </div>
          </div>
          {/* 存储空间进度条 */}
          <div className="mt-4">
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '45.2%' }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full bg-accent rounded-full"
              />
            </div>
          </div>
        </ContentCard>
      </div>

      {/* 待办事项提醒 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-8 p-4 rounded-xl border border-amber-200 bg-amber-50"
      >
        <div className="flex items-start gap-3">
          <FiAlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">
              有 3 个文档处理失败
            </p>
            <p className="text-xs text-amber-700 mt-1">
              部分文档格式不支持或文件损坏，请检查并重新上传
            </p>
          </div>
          <button
            onClick={() => toaster.create({ title: '查看失败文档', status: 'info' })}
            className="text-sm text-amber-900 font-medium hover:underline"
          >
            立即处理
          </button>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default AdminHomepage;
