/**
 * Knowledge List Component
 * Displays and manages knowledge base documents
 */

import {
  Box,
  Button,
  Flex,
  Text,
  Input,
  HStack,
  VStack,
  Spinner,
  Checkbox,
  IconButton,
  SimpleGrid,
  Badge
} from '@chakra-ui/react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter
} from '@/components/ui/dialog';
import { toaster } from '@/components/ui/toaster';
import {
  FiSearch,
  FiTrash2,
  FiEye,
  FiRefreshCw,
  FiDownload,
  FiFilter
} from 'react-icons/fi';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useKnowledgeAdminAPI, type SearchResult, type Document } from '@/services/knowledge-admin-api';

const swissFont = '"Helvetica Neue", Arial, sans-serif';
const ink = '#121826';
const muted = '#586174';
const hairline = '#D9DEE8';
const paper = '#FFFFFF';
const surface = '#F7F7F8';
const blue = '#002FA7';
const blueWash = '#E8EEFF';
const red = '#B3261E';
const redWash = '#FCE8E6';

interface DocumentItemProps {
  doc: SearchResult | Document;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onView: (doc: SearchResult | Document) => void;
  onDelete: (id: string) => void;
}

function DocumentItem({ doc, isSelected, onToggleSelect, onView, onDelete }: DocumentItemProps) {
  const title = doc.title || '未命名文档';
  const category = doc.category || '未分类';
  const content = doc.content || '';
  const preview = content.length > 100 ? content.slice(0, 100) + '...' : content;
  const score = 'score' in doc ? doc.score : undefined;
  const docId = doc.id;

  return (
    <Box
      p="12px"
      mb="8px"
      background={paper}
      border="1px solid"
      borderColor={hairline}
      borderRadius="4px"
      _hover={{ borderColor: blue, background: blueWash }}
      transition="border-color 160ms ease, background 160ms ease"
    >
      <Flex align="flex-start" gap="12px">
        <Checkbox
          isChecked={isSelected}
          onChange={() => onToggleSelect(docId)}
          colorPalette="blue"
          mt="2px"
        />

        <Box flex="1" minWidth="0">
          <Flex align="center" gap="8px" mb="4px" flexWrap="wrap">
            <Text
              color={ink}
              fontSize="13px"
              fontWeight="600"
              lineHeight="1.3"
              flex="1"
              minWidth="0"
              noOfLines={1}
            >
              {title}
            </Text>
            <Badge
              px="6px"
              py="2px"
              fontSize="10px"
              fontWeight="600"
              borderRadius="2px"
              background={blueWash}
              color={blue}
            >
              {category}
            </Badge>
            {score !== undefined && (
              <Badge
                px="6px"
                py="2px"
                fontSize="10px"
                fontWeight="600"
                borderRadius="2px"
                background={surface}
                color={muted}
              >
                {(score * 100).toFixed(0)}%
              </Badge>
            )}
          </Flex>

          <Text color={muted} fontSize="11px" lineHeight="1.5" mb="8px" noOfLines={2}>
            {preview}
          </Text>

          <HStack gap="8px">
            <Button
              size="xs"
              onClick={() => onView(doc)}
              height="24px"
              px="8px"
              borderRadius="2px"
              background={surface}
              color={ink}
              fontSize="11px"
              _hover={{ background: blueWash, color: blue }}
            >
              <FiEye size="12px" />
              查看
            </Button>
            <Button
              size="xs"
              onClick={() => onDelete(docId)}
              height="24px"
              px="8px"
              borderRadius="2px"
              background={redWash}
              color={red}
              fontSize="11px"
              _hover={{ background: red, color: paper }}
            >
              <FiTrash2 size="12px" />
              删除
            </Button>
          </HStack>
        </Box>
      </Flex>
    </Box>
  );
}

interface DocumentDetailModalProps {
  doc: SearchResult | Document | null;
  isOpen: boolean;
  onClose: () => void;
}

function DocumentDetailModal({ doc, isOpen, onClose }: DocumentDetailModalProps) {
  if (!doc) return null;

  return (
    <Box
      position="fixed"
      top="0"
      left="0"
      right="0"
      bottom="0"
      zIndex={100}
      background="rgba(0, 0, 0, 0.5)"
      display={isOpen ? 'flex' : 'none'}
      alignItems="center"
      justifyContent="center"
      p="20px"
    >
      <Box
        maxWidth="600px"
        width="100%"
        maxHeight="80vh"
        background={paper}
        borderRadius="4px"
        overflow="hidden"
        display="flex"
        flexDirection="column"
      >
        <Box
          p="16px"
          borderBottom="1px solid"
          borderColor={hairline}
          background={surface}
        >
          <Flex align="center" justify="space-between">
            <Text color={ink} fontSize="14px" fontWeight="700">
              {doc.title || '未命名文档'}
            </Text>
            <Button
              size="sm"
              onClick={onClose}
              height="28px"
              px="10px"
              borderRadius="2px"
              variant="ghost"
            >
              ✕
            </Button>
          </Flex>
        </Box>

        <Box p="16px" overflowY="auto" flex="1">
          <VStack align="stretch" gap="12px">
            <Box>
              <Text color={muted} fontSize="11px" fontWeight="600" mb="4px">
                文档 ID
              </Text>
              <Text color={ink} fontSize="12px" fontFamily="monospace">
                {doc.id}
              </Text>
            </Box>

            {doc.category && (
              <Box>
                <Text color={muted} fontSize="11px" fontWeight="600" mb="4px">
                  分类
                </Text>
                <Text color={ink} fontSize="12px">
                  {doc.category}
                </Text>
              </Box>
            )}

            <Box>
              <Text color={muted} fontSize="11px" fontWeight="600" mb="4px">
                内容
              </Text>
              <Text
                color={ink}
                fontSize="12px"
                lineHeight="1.6"
                whiteSpace="pre-wrap"
                maxHeight="300px"
                overflowY="auto"
                p="12px"
                background={surface}
                borderRadius="2px"
              >
                {doc.content || '无内容'}
              </Text>
            </Box>

            {doc.metadata && Object.keys(doc.metadata).length > 0 && (
              <Box>
                <Text color={muted} fontSize="11px" fontWeight="600" mb="4px">
                  元数据
                </Text>
                <Box
                  p="12px"
                  background={surface}
                  borderRadius="2px"
                  fontFamily="monospace"
                  fontSize="11px"
                  whiteSpace="pre-wrap"
                  maxHeight="150px"
                  overflowY="auto"
                >
                  {JSON.stringify(doc.metadata, null, 2)}
                </Box>
              </Box>
            )}
          </VStack>
        </Box>
      </Box>
    </Box>
  );
}

export default function KnowledgeList() {
  const [documents, setDocuments] = useState<Array<SearchResult | Document>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<SearchResult | Document | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { searchDocuments, deleteDocument } = useKnowledgeAdminAPI();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const loadDocuments = useCallback(async (query = '') => {
    if (!query.trim()) {
      setDocuments([]);
      return;
    }

    try {
      setLoading(true);
      const response = await searchDocuments({
        query,
        top_k: 50,
        category: undefined
      });
      if (response.success) {
        setDocuments(response.results);
      }
    } catch (error) {
      toast({
        title: '搜索失败',
        description: error instanceof Error ? error.message : '未知错误',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
    } finally {
      setLoading(false);
    }
  }, [searchDocuments, toast]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadDocuments(searchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, loadDocuments]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map(d => d.id)));
    }
  }, [selectedIds.size, documents]);

  const handleView = useCallback((doc: SearchResult | Document) => {
    setViewingDoc(doc);
    setIsDetailOpen(true);
  }, []);

  const handleDeleteClick = useCallback((id: string) => {
    setPendingDeleteId(id);
    setIsDeleteOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return;

    try {
      const response = await deleteDocument({ doc_id: pendingDeleteId });
      if (response.success) {
        toaster.create({
          title: '删除成功',
          description: `已删除 ${response.deleted_count} 个文档`,
          status: 'success',
          duration: 2000
        });
        // Reload documents
        loadDocuments(searchQuery);
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(pendingDeleteId);
          return next;
        });
      }
    } catch (error) {
      toaster.create({
        title: '删除失败',
        description: error instanceof Error ? error.message : '未知错误',
        status: 'error',
        duration: 3000
      });
    } finally {
      setPendingDeleteId(null);
      setIsDeleteOpen(false);
    }
  }, [pendingDeleteId, deleteDocument, searchQuery, loadDocuments]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const promises = Array.from(selectedIds).map(id =>
      deleteDocument({ doc_id: id })
    );

    try {
      const results = await Promise.all(promises);
      const totalDeleted = results.reduce((sum, r) => sum + (r.success ? r.deleted_count : 0), 0);

      toaster.create({
        title: '批量删除完成',
        description: `已删除 ${totalDeleted} 个文档`,
        status: 'success',
        duration: 2000
      });

      setSelectedIds(new Set());
      loadDocuments(searchQuery);
    } catch (error) {
      toaster.create({
        title: '批量删除失败',
        description: error instanceof Error ? error.message : '未知错误',
        status: 'error',
        duration: 3000
      });
    }
  }, [selectedIds, deleteDocument, searchQuery, loadDocuments]);

  const hasDocuments = documents.length > 0;
  const allSelected = hasDocuments && selectedIds.size === documents.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < documents.length;

  return (
    <VStack gap="16px" py="20px" align="stretch" height="100%">
      {/* Search and Filter Bar */}
      <Flex gap="12px" align="center">
        <Box flex="1" position="relative">
          <Input
            placeholder="搜索知识库文档..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            height="36px"
            px="36px"
            borderRadius="2px"
            border="1px solid"
            borderColor={hairline}
            fontFamily={swissFont}
            _focus={{ borderColor: blue, boxShadow: `0 0 0 1px ${blue}` }}
          />
          <Box position="absolute" left="10px" top="50%" transform="translateY(-50%)" color={muted}>
            <FiSearch size="14px" />
          </Box>
        </Box>

        <Button
          size="sm"
          onClick={() => loadDocuments(searchQuery)}
          disabled={loading}
          height="36px"
          px="12px"
          borderRadius="2px"
          border="1px solid"
          borderColor={hairline}
          background={paper}
          fontFamily={swissFont}
          _hover={{ borderColor: blue, background: blueWash }}
        >
          {loading ? <Spinner size="xs" /> : <FiRefreshCw />}
        </Button>

        {someSelected && (
          <Button
            size="sm"
            onClick={handleBulkDelete}
            height="36px"
            px="12px"
            borderRadius="2px"
            border="1px solid"
            borderColor={red}
            background={redWash}
            color={red}
            fontFamily={swissFont}
            _hover={{ background: red, color: paper }}
          >
            <FiTrash2 />
            删除选中 ({selectedIds.size})
          </Button>
        )}
      </Flex>

      {/* Results Header */}
      {hasDocuments && (
        <Flex align="center" justify="space-between" py="8px" borderBottom="1px solid" borderColor={hairline}>
          <HStack gap="12px">
            <Checkbox
              isChecked={allSelected}
              isIndeterminate={someSelected}
              onChange={handleToggleSelectAll}
              colorPalette="blue"
            >
              <Text color={muted} fontSize="12px">
                全选
              </Text>
            </Checkbox>
            <Text color={muted} fontSize="12px">
              共 {documents.length} 条结果
            </Text>
          </HStack>

          <HStack gap="8px">
            <Button
              size="xs"
              height="28px"
              px="8px"
              borderRadius="2px"
              variant="ghost"
              color={muted}
              fontSize="11px"
              _hover={{ color: ink }}
            >
              <FiFilter size="12px" />
              筛选
            </Button>
            <Button
              size="xs"
              height="28px"
              px="8px"
              borderRadius="2px"
              variant="ghost"
              color={muted}
              fontSize="11px"
              _hover={{ color: ink }}
            >
              <FiDownload size="12px" />
              导出
            </Button>
          </HStack>
        </Flex>
      )}

      {/* Document List */}
      <Box flex="1" overflowY="auto">
        {loading ? (
          <Box py="48px" display="flex" justifyContent="center">
            <VStack gap="12px">
              <Spinner size="md" color={blue} />
              <Text color={muted} fontSize="12px">搜索中...</Text>
            </VStack>
          </Box>
        ) : hasDocuments ? (
          <VStack align="stretch" gap="0">
            {documents.map(doc => (
              <DocumentItem
                key={doc.id}
                doc={doc}
                isSelected={selectedIds.has(doc.id)}
                onToggleSelect={handleToggleSelect}
                onView={handleView}
                onDelete={handleDeleteClick}
              />
            ))}
          </VStack>
        ) : searchQuery ? (
          <Box py="48px" textAlign="center">
            <Text color={muted} fontSize="13px">
              未找到匹配的文档
            </Text>
          </Box>
        ) : (
          <Box py="48px" textAlign="center">
            <Text color={muted} fontSize="13px">
              输入关键词搜索知识库文档
            </Text>
          </Box>
        )}
      </Box>

      {/* Document Detail Modal */}
      <DocumentDetailModal
        doc={viewingDoc}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />

      {/* Delete Confirmation Dialog */}
      <DialogRoot open={isDeleteOpen} onOpenChange={(details) => setIsDeleteOpen(details.open)}>
        <DialogContent>
          <DialogHeader fontSize="14px" fontWeight="700">
            确认删除
          </DialogHeader>
          <DialogBody>
            确定要删除这个文档吗？此操作无法撤销。
          </DialogBody>
          <DialogFooter>
            <Button
              onClick={() => setIsDeleteOpen(false)}
              height="32px"
              px="12px"
              borderRadius="2px"
              variant="ghost"
            >
              取消
            </Button>
            <Button
              bg="red.600"
              color="white"
              onClick={handleConfirmDelete}
              ml={3}
              height="32px"
              px="12px"
              borderRadius="2px"
              _hover={{ bg: 'red.700' }}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </VStack>
  );
}
