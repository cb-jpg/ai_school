/**
 * Knowledge Upload Component
 * Handles file and text uploads to the knowledge base
 */

import {
  Box,
  Button,
  Flex,
  Text,
  Textarea,
  Input,
  HStack,
  VStack,
  Spinner,
  Icon,
  SimpleGrid,
} from '@chakra-ui/react';
import {
  FiUpload,
  FiFileText,
  FiLink,
  FiPlus,
  FiCheck,
  FiX
} from 'react-icons/fi';
import { useState, useCallback } from 'react';
import { useKnowledgeAdminAPI } from '@/services/knowledge-admin-api';
import { toaster } from '@/components/ui/toaster';


const swissFont = '"Helvetica Neue", Arial, sans-serif';
const ink = '#121826';
const muted = '#586174';
const hairline = '#D9DEE8';
const paper = '#FFFFFF';
const surface = '#F7F7F8';
const blue = '#002FA7';
const blueWash = '#E8EEFF';
const green = '#047857';
const greenWash = '#D1FAE5';
const red = '#B3261E';
const redWash = '#FCE8E6';

const CATEGORIES = [
  '学校简介',
  '校史',
  '校训',
  '办学理念',
  '校园文化',
  '规章制度',
  '招生简章',
  '课程介绍',
  '校园活动',
  '常见问题',
  '学校荣誉',
  '教师资料',
  '学习标兵',
  '其他'
];

interface UploadStatus {
  id: string;
  name: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  message?: string;
  chunksCount?: number;
}

function UploadStatusItem({ status }: { status: UploadStatus }) {
  const statusColors = {
    pending: { bg: surface, color: muted },
    uploading: { bg: blueWash, color: blue },
    success: { bg: greenWash, color: green },
    error: { bg: redWash, color: red }
  };

  const { color } = statusColors[status.status];

  return (
    <Box
      p="10px"
      background={paper}
      border="1px solid"
      borderColor={hairline}
      borderRadius="4px"
    >
      <Flex align="center" justify="space-between" mb="6px">
        <HStack gap="8px">
          <Icon as={FiFileText} color={color} width="14px" height="14px" />
          <Text color={ink} fontSize="12px" fontWeight="600" maxWidth="200px">
            {status.name}
          </Text>
        </HStack>
        {status.status === 'pending' && <Spinner size="xs" />}
        {status.status === 'uploading' && <Spinner size="xs" color={blue} />}
        {status.status === 'success' && <Icon as={FiCheck} color={green} width="14px" height="14px" />}
        {status.status === 'error' && <Icon as={FiX} color={red} width="14px" height="14px" />}
      </Flex>

      {status.status === 'uploading' && (
        <Box width="100%" height="4px" background={surface} borderRadius="2px" overflow="hidden">
          <Box
            width={`${status.progress}%`}
            height="100%"
            background={blue}
            transition="width 0.3s ease"
          />
        </Box>
      )}

      {status.message && (
        <Text
          mt="4px"
          color={status.status === 'error' ? red : muted}
          fontSize="10px"
          lineHeight="1.4"
        >
          {status.message}
        </Text>
      )}

      {status.status === 'success' && status.chunksCount !== undefined && (
        <Text
          mt="4px"
          color={green}
          fontSize="10px"
          fontWeight="600"
        >
          已处理 {status.chunksCount} 个知识块
        </Text>
      )}
    </Box>
  );
}

export default function KnowledgeUpload() {
  const [activeTab, setActiveTab] = useState<'file' | 'text' | 'url'>('file');
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null);
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);

  // Text form state
  const [textContent, setTextContent] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [textCategory, setTextCategory] = useState('');

  // File form state
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [fileCategory, setFileCategory] = useState('');

  // URL form state
  const [urlUrl, setUrlUrl] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [urlCategory, setUrlCategory] = useState('');
  const [urlTags, setUrlTags] = useState('');
  const [urlSubmitting, setUrlSubmitting] = useState(false);

  const { uploadDocument, addDocument, addUrlDocument } = useKnowledgeAdminAPI();

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(e.target.files);
  }, []);

  const handleFileUpload = useCallback(async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toaster.create({
        title: '请选择文件',
        description: '请先选择要上传的文件',
        type: 'warning',
        duration: 2000,
        closable: true
      });
      return;
    }

    const files = Array.from(selectedFiles);

    // Initialize upload statuses
    const initialStatuses: UploadStatus[] = files.map(file => ({
      id: crypto.randomUUID(),
      name: file.name,
      status: 'pending',
      progress: 0
    }));

    setUploadStatuses(prev => [...initialStatuses, ...prev]);

    // Upload files sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const statusIndex = i;

      setUploadStatuses(prev => {
        const next = [...prev];
        next[statusIndex].status = 'uploading';
        next[statusIndex].progress = 50;
        return next;
      });

      try {
        const result = await uploadDocument(file, fileCategory || undefined);

        setUploadStatuses(prev => {
          const next = [...prev];
          next[statusIndex].status = 'success';
          next[statusIndex].progress = 100;
          next[statusIndex].message = result.message;
          next[statusIndex].chunksCount = result.chunks_count;
          return next;
        });

        toaster.create({
          title: '上传成功',
          description: `${file.name} 上传成功`,
          type: 'success',
          duration: 2000,
          closable: true
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '上传失败';

        setUploadStatuses(prev => {
          const next = [...prev];
          next[statusIndex].status = 'error';
          next[statusIndex].message = errorMessage;
          return next;
        });

        toaster.create({
          title: '上传失败',
          description: `${file.name} 上传失败: ${errorMessage}`,
          type: 'error',
          duration: 3000,
          closable: true
        });
      }
    }

    setSelectedFiles(null);
    if (fileInputRef) {
      fileInputRef.value = '';
    }
  }, [selectedFiles, fileCategory, uploadDocument, fileInputRef]);

  const handleTextSubmit = useCallback(async () => {
    if (!textContent.trim()) {
      toaster.create({
        title: '请输入内容',
        description: '请输入要添加的文本内容',
        type: 'warning',
        duration: 2000,
        closable: true
      });
      return;
    }

    if (!textTitle.trim()) {
      toaster.create({
        title: '请输入标题',
        description: '请为该内容输入一个标题',
        type: 'warning',
        duration: 2000,
        closable: true
      });
      return;
    }

    const statusId = crypto.randomUUID();
    const newStatus: UploadStatus = {
      id: statusId,
      name: textTitle,
      status: 'uploading',
      progress: 50
    };

    setUploadStatuses(prev => [newStatus, ...prev]);

    try {
      const result = await addDocument({
        text: textContent,
        title: textTitle,
        category: textCategory || undefined
      });

      setUploadStatuses(prev => {
        const next = [...prev];
        const index = next.findIndex(s => s.id === statusId);
        if (index !== -1) {
          next[index] = {
            ...next[index],
            status: 'success',
            progress: 100,
            message: result.message,
            chunksCount: result.document_ids.length
          };
        }
        return next;
      });

      toaster.create({
        title: '添加成功',
        description: result.message,
        type: 'success',
        duration: 2000,
        closable: true
      });

      // Reset form
      setTextContent('');
      setTextTitle('');
      setTextCategory('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '添加失败';

      setUploadStatuses(prev => {
        const next = [...prev];
        const index = next.findIndex(s => s.id === statusId);
        if (index !== -1) {
          next[index] = {
            ...next[index],
            status: 'error',
            message: errorMessage
          };
        }
        return next;
      });

      toaster.create({
        title: '添加失败',
        description: errorMessage,
        type: 'error',
        duration: 3000,
        closable: true
      });
    }
  }, [textContent, textTitle, textCategory, addDocument]);

  const clearStatus = useCallback((id: string) => {
    setUploadStatuses(prev => prev.filter(s => s.id !== id));
  }, []);

  const clearAllStatuses = useCallback(() => {
    setUploadStatuses([]);
  }, []);

  // 网页抓取提交：失败（非 HTML / 超时 / 不可达）在状态区与提示中展示
  const handleUrlSubmit = useCallback(async () => {
    const url = urlUrl.trim();
    if (!url || !urlCategory.trim()) return;

    const statusId = crypto.randomUUID();
    setUploadStatuses(prev => [
      { id: statusId, name: url, status: 'uploading', progress: 30 },
      ...prev,
    ]);
    setUrlSubmitting(true);

    try {
      const result = await addUrlDocument({
        url,
        title: urlTitle || undefined,
        category: urlCategory,
        tags: urlTags.split(',').map(t => t.trim()).filter(Boolean),
      });

      setUploadStatuses(prev => prev.map(s =>
        s.id === statusId ? { ...s, status: 'success', progress: 100, message: result.message } : s
      ));
      toaster.create({
        title: '抓取成功',
        description: `${url} 已加入知识库`,
        type: 'success',
        duration: 2000,
        closable: true
      });
      setUrlUrl('');
      setUrlTitle('');
      setUrlTags('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '抓取失败';

      setUploadStatuses(prev => prev.map(s =>
        s.id === statusId ? { ...s, status: 'error', message: errorMessage } : s
      ));
      toaster.create({
        title: '抓取失败',
        description: errorMessage,
        type: 'error',
        duration: 4000,
        closable: true
      });
    } finally {
      setUrlSubmitting(false);
    }
  }, [urlUrl, urlTitle, urlCategory, urlTags, addUrlDocument]);

  return (
    <VStack gap="20px" py="20px" align="stretch" height="100%">
      {/* Tab Navigation */}
      <HStack gap="0" borderBottom="1px solid" borderColor={hairline}>
        <Button
          size="sm"
          onClick={() => setActiveTab('file')}
          height="36px"
          px="16px"
          borderRadius="0"
          background={activeTab === 'file' ? blue : 'transparent'}
          color={activeTab === 'file' ? paper : ink}
          fontWeight={activeTab === 'file' ? '600' : '400'}
          borderBottom={activeTab === 'file' ? '3px solid' : 'none'}
          borderBottomColor={blue}
          fontFamily={swissFont}
          _hover={{ background: activeTab === 'file' ? blue : blueWash }}
        >
          <Icon as={FiUpload} mr="6px" />
          文件上传
        </Button>
        <Button
          size="sm"
          onClick={() => setActiveTab('text')}
          height="36px"
          px="16px"
          borderRadius="0"
          background={activeTab === 'text' ? blue : 'transparent'}
          color={activeTab === 'text' ? paper : ink}
          fontWeight={activeTab === 'text' ? '600' : '400'}
          borderBottom={activeTab === 'text' ? '3px solid' : 'none'}
          borderBottomColor={blue}
          fontFamily={swissFont}
          _hover={{ background: activeTab === 'text' ? blue : blueWash }}
        >
          <Icon as={FiFileText} mr="6px" />
          文本录入
        </Button>
        <Button
          size="sm"
          onClick={() => setActiveTab('url')}
          height="36px"
          px="16px"
          borderRadius="0"
          background={activeTab === 'url' ? blue : 'transparent'}
          color={activeTab === 'url' ? paper : ink}
          fontWeight={activeTab === 'url' ? '600' : '400'}
          borderBottom={activeTab === 'url' ? '3px solid' : 'none'}
          borderBottomColor={blue}
          fontFamily={swissFont}
          _hover={{ background: activeTab === 'url' ? blue : blueWash }}
        >
          <Icon as={FiLink} mr="6px" />
          网页抓取
        </Button>
      </HStack>

      <SimpleGrid columns={{ base: 1, lg: 2 }} gap="20px" flex="1">
        {/* Upload Form */}
        <Box
          p="16px"
          background={paper}
          border="1px solid"
          borderColor={hairline}
          borderRadius="4px"
        >
          {activeTab === 'file' && (
            <VStack gap="16px" align="stretch">
              <Box>
                <Text color={ink} fontSize="13px" fontWeight="700" mb="8px">
                  选择文件
                </Text>
                <Input
                  ref={(ref: HTMLInputElement | null) => setFileInputRef(ref)}
                  type="file"
                  onChange={handleFileSelect}
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md,.xlsx"
                  height="36px"
                  borderRadius="2px"
                  border="1px solid"
                  borderColor={hairline}
                  fontFamily={swissFont}
                  _focus={{ borderColor: blue }}
                />
                <Text mt="4px" color={muted} fontSize="10px">
                  支持格式：PDF、DOC、DOCX、TXT、MD、XLSX
                </Text>
              </Box>

              <Box>
                <Text color={ink} fontSize="13px" fontWeight="700" mb="8px">
                  分类（可选）
                </Text>
                <Input
                  placeholder="选择或输入分类"
                  list="categories"
                  value={fileCategory}
                  onChange={(e) => setFileCategory(e.target.value)}
                  height="36px"
                  borderRadius="2px"
                  border="1px solid"
                  borderColor={hairline}
                  fontFamily={swissFont}
                  _focus={{ borderColor: blue }}
                />
                <datalist id="categories">
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </Box>

              {selectedFiles && selectedFiles.length > 0 && (
                <Box
                  p="12px"
                  background={blueWash}
                  border="1px solid"
                  borderColor={blue}
                  borderRadius="2px"
                >
                  <Text color={ink} fontSize="12px" fontWeight="600" mb="6px">
                    已选择 {selectedFiles.length} 个文件：
                  </Text>
                  <VStack align="stretch" gap="4px">
                    {Array.from(selectedFiles).map(file => (
                      <Text key={file.name} color={muted} fontSize="11px">
                        • {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </Text>
                    ))}
                  </VStack>
                </Box>
              )}

              <Button
                width="100%"
                onClick={handleFileUpload}
                disabled={!selectedFiles || selectedFiles.length === 0}
                height="38px"
                borderRadius="2px"
                background={blue}
                color={paper}
                fontWeight="600"
                fontFamily={swissFont}
                _hover={{ background: ink }}
                _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
              >
                <FiUpload />
                上传文件
              </Button>
            </VStack>
          )}

          {activeTab === 'text' && (
            <VStack gap="16px" align="stretch">
              <Box>
                <Text color={ink} fontSize="13px" fontWeight="700" mb="8px">
                  标题 *
                </Text>
                <Input
                  placeholder="输入知识条目标题"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  height="36px"
                  borderRadius="2px"
                  border="1px solid"
                  borderColor={hairline}
                  fontFamily={swissFont}
                  _focus={{ borderColor: blue }}
                />
              </Box>

              <Box>
                <Text color={ink} fontSize="13px" fontWeight="700" mb="8px">
                  分类（可选）
                </Text>
                <Input
                  placeholder="选择或输入分类"
                  list="categories"
                  value={textCategory}
                  onChange={(e) => setTextCategory(e.target.value)}
                  height="36px"
                  borderRadius="2px"
                  border="1px solid"
                  borderColor={hairline}
                  fontFamily={swissFont}
                  _focus={{ borderColor: blue }}
                />
                <datalist id="categories">
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </Box>

              <Box flex="1" display="flex" flexDirection="column">
                <Text color={ink} fontSize="13px" fontWeight="700" mb="8px">
                  内容 *
                </Text>
                <Textarea
                  placeholder="输入知识内容..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  height="150px"
                  resize="none"
                  borderRadius="2px"
                  border="1px solid"
                  borderColor={hairline}
                  fontFamily={swissFont}
                  _focus={{ borderColor: blue }}
                />
                <Text mt="4px" color={muted} fontSize="10px">
                  {textContent.length} 字符
                </Text>
              </Box>

              <Button
                width="100%"
                onClick={handleTextSubmit}
                disabled={!textContent.trim() || !textTitle.trim()}
                height="38px"
                borderRadius="2px"
                background={blue}
                color={paper}
                fontWeight="600"
                fontFamily={swissFont}
                _hover={{ background: ink }}
                _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
              >
                <FiPlus />
                添加到知识库
              </Button>
            </VStack>
          )}

          {activeTab === 'url' && (
            <VStack gap="16px" align="stretch">
              <Box>
                <Text color={ink} fontSize="13px" fontWeight="700" mb="8px">
                  网页链接 *
                </Text>
                <Input
                  placeholder="https:// 学校官网或公开网页地址"
                  value={urlUrl}
                  onChange={(e) => setUrlUrl(e.target.value)}
                  height="36px"
                  borderRadius="2px"
                  border="1px solid"
                  borderColor={hairline}
                  fontFamily={swissFont}
                  _focus={{ borderColor: blue }}
                />
                <Text mt="4px" color={muted} fontSize="10px">
                  仅支持 http/https 网页链接；PDF 等文件请用「文件上传」
                </Text>
              </Box>

              <Box>
                <Text color={ink} fontSize="13px" fontWeight="700" mb="8px">
                  标题（可选，默认取网页标题）
                </Text>
                <Input
                  placeholder="留空则自动使用网页标题"
                  value={urlTitle}
                  onChange={(e) => setUrlTitle(e.target.value)}
                  height="36px"
                  borderRadius="2px"
                  border="1px solid"
                  borderColor={hairline}
                  fontFamily={swissFont}
                  _focus={{ borderColor: blue }}
                />
              </Box>

              <Box display="flex" gap="12px">
                <Box flex="1">
                  <Text color={ink} fontSize="13px" fontWeight="700" mb="8px">
                    分类 *
                  </Text>
                  <Input
                    placeholder="选择或输入分类"
                    list="categories"
                    value={urlCategory}
                    onChange={(e) => setUrlCategory(e.target.value)}
                    height="36px"
                    borderRadius="2px"
                    border="1px solid"
                    borderColor={hairline}
                    fontFamily={swissFont}
                    _focus={{ borderColor: blue }}
                  />
                  <datalist id="categories">
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </Box>
                <Box flex="1">
                  <Text color={ink} fontSize="13px" fontWeight="700" mb="8px">
                    标签（可选）
                  </Text>
                  <Input
                    placeholder="逗号分隔，如：官网,简介"
                    value={urlTags}
                    onChange={(e) => setUrlTags(e.target.value)}
                    height="36px"
                    borderRadius="2px"
                    border="1px solid"
                    borderColor={hairline}
                    fontFamily={swissFont}
                    _focus={{ borderColor: blue }}
                  />
                </Box>
              </Box>

              <Button
                width="100%"
                onClick={handleUrlSubmit}
                disabled={!urlUrl.trim() || !urlCategory.trim()}
                loading={urlSubmitting}
                loadingText="抓取中（最长 30 秒）..."
                height="38px"
                borderRadius="2px"
                background={blue}
                color={paper}
                fontWeight="600"
                fontFamily={swissFont}
                _hover={{ background: ink }}
                _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
              >
                <FiPlus />
                抓取并添加到知识库
              </Button>
            </VStack>
          )}
        </Box>

        {/* Upload Status */}
        <Box
          p="16px"
          background={paper}
          border="1px solid"
          borderColor={hairline}
          borderRadius="4px"
          display="flex"
          flexDirection="column"
          maxHeight="500px"
        >
          <Flex align="center" justify="space-between" mb="12px">
            <Text color={ink} fontSize="13px" fontWeight="700">
              上传状态
            </Text>
            {uploadStatuses.length > 0 && (
              <Button
                size="xs"
                onClick={clearAllStatuses}
                height="24px"
                px="8px"
                borderRadius="2px"
                variant="ghost"
                color={muted}
                fontSize="11px"
                _hover={{ color: ink }}
              >
                清空全部
              </Button>
            )}
          </Flex>

          <Box flex="1" overflowY="auto">
            {uploadStatuses.length === 0 ? (
              <Box py="40px" textAlign="center">
                <Text color={muted} fontSize="12px">
                  暂无上传记录
                </Text>
              </Box>
            ) : (
              <VStack align="stretch" gap="8px">
                {uploadStatuses.map(status => (
                  <Box key={status.id} position="relative">
                    <UploadStatusItem status={status} />
                    {(status.status === 'success' || status.status === 'error') && (
                      <Button
                        size="xs"
                        onClick={() => clearStatus(status.id)}
                        position="absolute"
                        top="8px"
                        right="8px"
                        height="20px"
                        width="20px"
                        minWidth="20px"
                        p="0"
                        borderRadius="50%"
                        background="transparent"
                        color={muted}
                        _hover={{ background: surface, color: ink }}
                      >
                        <FiX size="12px" />
                      </Button>
                    )}
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
        </Box>
      </SimpleGrid>

      {/* Tips */}
      <Box
        p="12px"
        background={blueWash}
        border="1px solid"
        borderColor={blue}
        borderRadius="4px"
      >
        <Text color={ink} fontSize="11px" fontWeight="600" mb="4px">
          上传提示
        </Text>
        <VStack align="stretch" gap="2px">
          <Text color={muted} fontSize="10px" lineHeight="1.5">
            • 支持批量上传多个文件
          </Text>
          <Text color={muted} fontSize="10px" lineHeight="1.5">
            • 文档会自动切分并向量化处理
          </Text>
          <Text color={muted} fontSize="10px" lineHeight="1.5">
            • 建议为重要内容指定分类，便于后续管理
          </Text>
        </VStack>
      </Box>
    </VStack>
  );
}
