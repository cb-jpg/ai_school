/**
 * AI知识库助手 - 知识库管理页面示例
 * 展示完整的知识库管理功能界面
 */

import { FC, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiSearch,
  FiFilter,
  FiPlus,
  FiUpload,
  FiDownload,
  FiEdit,
  FiTrash2,
  FiEye,
  FiMoreVertical,
  FiCheck,
  FiX,
  FiClock,
} from 'react-icons/fi';
import {
  DashboardLayout,
  PageHeader,
} from './admin-dashboard-layout';
import { createToaster, Button } from '@chakra-ui/react';

const toaster = createToaster({
  placement: 'top-end',
  overlap: true,
  max: 3
});

// 状态类型
type KnowledgeStatus = 'published' | 'draft' | 'archived' | 'processing' | 'error';

// 知识条目类型
interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  status: KnowledgeStatus;
  chunks: number;
  createdAt: string;
  updatedAt: string;
}

// 模拟知识库数据
const mockKnowledgeData: KnowledgeEntry[] = [
  {
    id: '1',
    title: '学校创办历史',
    category: '校史',
    status: 'published',
    chunks: 12,
    createdAt: '2024-01-15',
    updatedAt: '2024-03-10',
  },
  {
    id: '2',
    title: '2024年招生简章',
    category: '招生',
    status: 'published',
    chunks: 8,
    createdAt: '2024-02-01',
    updatedAt: '2024-02-01',
  },
  {
    id: '3',
    title: '课程体系介绍',
    category: '课程',
    status: 'published',
    chunks: 15,
    createdAt: '2024-01-20',
    updatedAt: '2024-03-05',
  },
  {
    id: '4',
    title: '优秀教师团队',
    category: '教师',
    status: 'processing',
    chunks: 0,
    createdAt: '2024-03-12',
    updatedAt: '2024-03-12',
  },
  {
    id: '5',
    title: '学生奖学金制度',
    category: '制度',
    status: 'draft',
    chunks: 6,
    createdAt: '2024-03-08',
    updatedAt: '2024-03-11',
  },
  {
    id: '6',
    title: '2023年度工作总结',
    category: '校史',
    status: 'archived',
    chunks: 20,
    createdAt: '2023-12-28',
    updatedAt: '2024-01-15',
  },
  {
    id: '7',
    title: '校园安全规范',
    category: '制度',
    status: 'published',
    chunks: 10,
    createdAt: '2024-01-10',
    updatedAt: '2024-02-20',
  },
  {
    id: '8',
    title: '实验室使用指南',
    category: '制度',
    status: 'error',
    chunks: 0,
    createdAt: '2024-03-11',
    updatedAt: '2024-03-11',
  },
];

// 分类选项
const categories = ['全部', '校史', '荣誉', '招生', '课程', '教师', '学生', '制度', '校园', '活动'];

// 状态配置
const statusConfig: Record<KnowledgeStatus, { label: string; color: string; bgColor: string }> = {
  published: { label: '已发布', color: 'text-green-700', bgColor: 'bg-green-100' },
  draft: { label: '草稿', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  archived: { label: '已归档', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  processing: { label: '处理中', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  error: { label: '错误', color: 'text-red-700', bgColor: 'bg-red-100' },
};

// 状态徽章组件
const StatusBadge: FC<{ status: KnowledgeStatus }> = ({ status }) => {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
      {status === 'processing' && <FiClock className="w-3 h-3" />}
      {status === 'published' && <FiCheck className="w-3 h-3" />}
      {status === 'error' && <FiX className="w-3 h-3" />}
      {config.label}
    </span>
  );
};

// 表格行组件
const KnowledgeRow: FC<{
  entry: KnowledgeEntry;
  index: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ entry, index, onSelect, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="hover:bg-secondary/50 transition-colors border-b border-border last:border-0"
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-border"
            onChange={() => onSelect(entry.id)}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{entry.title}</p>
            <p className="text-xs text-muted-foreground">ID: {entry.id}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className="text-sm text-foreground">{entry.category}</span>
      </td>
      <td className="px-6 py-4">
        <StatusBadge status={entry.status} />
      </td>
      <td className="px-6 py-4">
        <span className="text-sm text-foreground">{entry.chunks} 个片段</span>
      </td>
      <td className="px-6 py-4">
        <span className="text-sm text-muted-foreground">{entry.updatedAt}</span>
      </td>
      <td className="px-6 py-4">
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <FiMoreVertical className="w-4 h-4 text-muted-foreground" />
          </button>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute right-0 top-full mt-1 w-40 bg-background border border-border rounded-lg shadow-lg py-1 z-10"
            >
              <button
                onClick={() => {
                  onSelect(entry.id);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-secondary transition-colors flex items-center gap-2"
              >
                <FiEye className="w-4 h-4" />
                查看详情
              </button>
              <button
                onClick={() => {
                  toaster.create({ title: '编辑功能开发中', status: 'info' });
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-secondary transition-colors flex items-center gap-2"
              >
                <FiEdit className="w-4 h-4" />
                编辑
              </button>
              <button
                onClick={() => {
                  onDelete(entry.id);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 transition-colors flex items-center gap-2"
              >
                <FiTrash2 className="w-4 h-4" />
                删除
              </button>
            </motion.div>
          )}
        </div>
      </td>
    </motion.tr>
  );
};

// 主页面组件
export const KnowledgeManagementPage: FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [selectedStatus, setSelectedStatus] = useState<KnowledgeStatus | 'all'>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [knowledgeData] = useState<KnowledgeEntry[]>(mockKnowledgeData);

  // 过滤数据
  const filteredData = knowledgeData.filter((entry) => {
    const matchesSearch = entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         entry.id.includes(searchQuery);
    const matchesCategory = selectedCategory === '全部' || entry.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || entry.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // 选择处理
  const handleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 删除处理
  const handleDelete = (id: string) => {
    toaster.create({
      title: '确认删除',
      description: '确定要删除这条知识条目吗？',
      status: 'warning',
      action: {
        label: '确认',
        onClick: () => toaster.create({ title: '删除成功', status: 'success' })
      }
    });
  };

  // 批量操作
  const handleBatchAction = (action: 'publish' | 'archive' | 'delete') => {
    if (selectedItems.size === 0) {
      toaster.create({ title: '请先选择要操作的条目', status: 'warning' });
      return;
    }

    const actionLabels = {
      publish: '发布',
      archive: '归档',
      delete: '删除'
    };

    toaster.create({
      title: `批量${actionLabels[action]}`,
      description: `将对 ${selectedItems.size} 条记录执行${actionLabels[action]}操作`,
      status: 'info'
    });

    setSelectedItems(new Set());
  };

  return (
    <DashboardLayout defaultActiveItem="knowledge-list">
      {/* 页面头部 */}
      <PageHeader
        title="知识库管理"
        subtitle="管理和维护学校知识库，确保AI助手的回答准确可靠"
        actions={
          <div className="flex items-center gap-3">
            <Button
              leftIcon={<FiUpload className="w-4 h-4" />}
              onClick={() => toaster.create({ title: '上传功能开发中', status: 'info' })}
              className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-secondary transition-colors flex items-center gap-2"
            >
              批量导入
            </Button>
            <Button
              leftIcon={<FiPlus className="w-4 h-4" />}
              onClick={() => toaster.create({ title: '新建功能开发中', status: 'info' })}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              新建知识
            </Button>
          </div>
        }
      />

      {/* 筛选和搜索栏 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-background border border-border rounded-xl p-4 mb-6"
      >
        <div className="flex flex-col lg:flex-row gap-4">
          {/* 搜索框 */}
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索知识条目..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-secondary rounded-lg text-sm border-0 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {/* 分类筛选 */}
          <div className="flex items-center gap-2 flex-wrap">
            <FiFilter className="w-4 h-4 text-muted-foreground" />
            {categories.slice(0, 5).map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-accent text-white'
                    : 'bg-secondary text-muted-foreground hover:bg-border'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* 状态筛选 */}
          <div className="flex items-center gap-2">
            {(Object.keys(statusConfig) as KnowledgeStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(selectedStatus === status ? 'all' : status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedStatus === status
                    ? 'bg-accent text-white'
                    : 'bg-secondary text-muted-foreground hover:bg-border'
                }`}
              >
                {statusConfig[status].label}
              </button>
            ))}
          </div>
        </div>

        {/* 批量操作栏 */}
        {selectedItems.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-3 pt-4 border-t border-border mt-4"
          >
            <span className="text-sm text-muted-foreground">
              已选择 {selectedItems.size} 项
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => handleBatchAction('publish')}
                className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition-colors"
              >
                批量发布
              </button>
              <button
                onClick={() => handleBatchAction('archive')}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
              >
                批量归档
              </button>
              <button
                onClick={() => handleBatchAction('delete')}
                className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
              >
                批量删除
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* 数据表格 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-background border border-border rounded-xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  标题 / ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  分类
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  内容片段
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  更新时间
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? (
                filteredData.map((entry, index) => (
                  <KnowledgeRow
                    key={entry.id}
                    entry={entry}
                    index={index}
                    onSelect={handleSelectItem}
                    onDelete={handleDelete}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FiSearch className="w-12 h-12 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">没有找到匹配的知识条目</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-secondary/30">
          <p className="text-sm text-muted-foreground">
            显示 {filteredData.length} 条，共 {knowledgeData.length} 条记录
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground bg-background border border-border cursor-not-allowed"
            >
              上一页
            </button>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-foreground bg-accent">
              1
            </button>
            <button
              disabled
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground bg-background border border-border cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default KnowledgeManagementPage;
