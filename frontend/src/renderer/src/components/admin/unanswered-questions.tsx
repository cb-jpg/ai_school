/**
 * Unanswered Questions Component
 * Shows questions that couldn't be answered by the knowledge base
 * Allows adding knowledge based on these gaps
 */

import {
  Box,
  Button,
  Flex,
  Text,
  Textarea,
  HStack,
  VStack,
  Badge,
  Icon,
  Input,
  SimpleGrid,
  createToaster
} from '@chakra-ui/react';
import {
  FiHelpCircle,
  FiPlus,
  FiAlertTriangle,
  FiCheck,
  FiSearch
} from 'react-icons/fi';
import { BiBulb } from 'react-icons/bi';
import { useState } from 'react';
import { useKnowledgeAdminAPI } from '@/services/knowledge-admin-api';

const toaster = createToaster({
  placement: 'top-end',
  overlap: true,
  max: 3
});

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
const amber = '#B45309';
const amberWash = '#FEF3C7';

interface UnansweredQuestion {
  id: string;
  question: string;
  timestamp: string;
  count: number;
}

interface AnswerFormData {
  questionId: string;
  question: string;
  answer: string;
  title: string;
  category: string;
  tags: string;
}

function QuestionItem({
  question,
  onAddAnswer,
  onDismiss
}: {
  question: UnansweredQuestion;
  onAddAnswer: (q: UnansweredQuestion) => void;
  onDismiss: (id: string) => void;
}) {
  const timeAgo = getTimeAgo(question.timestamp);

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
        <Icon as={FiHelpCircle} color={blue} size="16px" mt="2px" flexShrink={0} />

        <Box flex="1" minWidth="0">
          <Flex align="center" gap="8px" mb="4px" flexWrap="wrap">
            <Text
              color={ink}
              fontSize="13px"
              fontWeight="600"
              lineHeight="1.3"
            >
              {question.question}
            </Text>

            {question.count > 1 && (
              <Badge
                px="6px"
                py="2px"
                fontSize="10px"
                fontWeight="600"
                borderRadius="2px"
                background={amberWash}
                color={amber}
              >
                {question.count} 次
              </Badge>
            )}
          </Flex>

          <Flex align="center" justify="space-between" mt="8px">
            <Text color={muted} fontSize="11px">
              {timeAgo}
            </Text>

            <HStack gap="6px">
              <Button
                size="xs"
                onClick={() => onDismiss(question.id)}
                height="24px"
                px="8px"
                borderRadius="2px"
                variant="ghost"
                color={muted}
                fontSize="11px"
                _hover={{ color: ink }}
              >
                忽略
              </Button>
              <Button
                size="xs"
                onClick={() => onAddAnswer(question)}
                height="24px"
                px="8px"
                borderRadius="2px"
                background={blue}
                color={paper}
                fontSize="11px"
                _hover={{ background: ink }}
              >
                <FiPlus size="12px" />
                补充答案
              </Button>
            </HStack>
          </Flex>
        </Box>
      </Flex>
    </Box>
  );
}

function AnswerForm({
  formData,
  onChange,
  onSubmit,
  onCancel
}: {
  formData: AnswerFormData;
  onChange: (data: AnswerFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
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

  return (
    <Box
      p="16px"
      background={paper}
      border="1px solid"
      borderColor={blue}
      borderRadius="4px"
    >
      <Flex align="center" gap="8px" mb="12px">
        <Icon as={BiBulb} color={blue} size="16px" />
        <Text color={ink} fontSize="13px" fontWeight="700">
          补充知识库
        </Text>
      </Flex>

      <VStack gap="12px" align="stretch">
        <Box>
          <Text color={muted} fontSize="11px" fontWeight="600" mb="4px">
            原问题
          </Text>
          <Box
            p="8px"
            background={surface}
            borderRadius="2px"
          >
            <Text color={ink} fontSize="12px">
              {formData.question}
            </Text>
          </Box>
        </Box>

        <SimpleGrid columns={{ base: 1, sm: 2 }} gap="12px">
          <Box>
            <Text color={ink} fontSize="12px" fontWeight="600" mb="4px">
              知识标题 *
            </Text>
            <Input
              placeholder="输入知识条目标题"
              value={formData.title}
              onChange={(e) => onChange({ ...formData, title: e.target.value })}
              height="32px"
              borderRadius="2px"
              border="1px solid"
              borderColor={hairline}
              fontSize="12px"
              fontFamily={swissFont}
              _focus={{ borderColor: blue }}
            />
          </Box>

          <Box>
            <Text color={ink} fontSize="12px" fontWeight="600" mb="4px">
              分类
            </Text>
            <Input
              placeholder="选择或输入分类"
              list="categories"
              value={formData.category}
              onChange={(e) => onChange({ ...formData, category: e.target.value })}
              height="32px"
              borderRadius="2px"
              border="1px solid"
              borderColor={hairline}
              fontSize="12px"
              fontFamily={swissFont}
              _focus={{ borderColor: blue }}
            />
            <datalist id="categories">
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </Box>
        </SimpleGrid>

        <Box>
          <Text color={ink} fontSize="12px" fontWeight="600" mb="4px">
            答案内容 *
          </Text>
          <Textarea
            placeholder="输入针对该问题的详细答案..."
            value={formData.answer}
            onChange={(e) => onChange({ ...formData, answer: e.target.value })}
            height="100px"
            resize="none"
            borderRadius="2px"
            border="1px solid"
            borderColor={hairline}
            fontSize="12px"
            fontFamily={swissFont}
            _focus={{ borderColor: blue }}
          />
        </Box>

        <Box>
          <Text color={ink} fontSize="12px" fontWeight="600" mb="4px">
            标签(可选,逗号分隔)
          </Text>
          <Input
            placeholder="例如：招生,入学,报名"
            value={formData.tags}
            onChange={(e) => onChange({ ...formData, tags: e.target.value })}
            height="32px"
            borderRadius="2px"
            border="1px solid"
            borderColor={hairline}
            fontSize="12px"
            fontFamily={swissFont}
            _focus={{ borderColor: blue }}
          />
        </Box>

        <HStack gap="8px" justify="flex-end">
          <Button
            size="sm"
            onClick={onCancel}
            height="32px"
            px="12px"
            borderRadius="2px"
            variant="ghost"
            color={muted}
            fontSize="12px"
            _hover={{ color: ink }}
          >
            取消
          </Button>
          <Button
            size="sm"
            onClick={onSubmit}
            isDisabled={!formData.answer.trim() || !formData.title.trim()}
            height="32px"
            px="12px"
            borderRadius="2px"
            background={blue}
            color={paper}
            fontSize="12px"
            fontWeight="600"
            _hover={{ background: ink }}
            _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
          >
            <FiCheck size="12px" />
            保存到知识库
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
}

// Demo unanswered questions (in production, this would come from the API)
const DEMO_QUESTIONS: UnansweredQuestion[] = [
  {
    id: '1',
    question: '学校的具体地址在哪里？',
    timestamp: '2026-08-23T10:30:00',
    count: 5
  },
  {
    id: '2',
    question: '学费是多少？有没有奖学金？',
    timestamp: '2026-08-23T09:15:00',
    count: 3
  },
  {
    id: '3',
    question: '学校有哪些社团活动？',
    timestamp: '2026-08-22T16:45:00',
    count: 2
  },
  {
    id: '4',
    question: '如何联系学校招生办？',
    timestamp: '2026-08-22T14:20:00',
    count: 1
  }
];

function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  return `${diffDays} 天前`;
}

export default function UnansweredQuestions() {
  const [questions, setQuestions] = useState<UnansweredQuestion[]>(DEMO_QUESTIONS);
  const [addingAnswerFor, setAddingAnswerFor] = useState<string | null>(null);
  const [answerForm, setAnswerForm] = useState<AnswerFormData>({
    questionId: '',
    question: '',
    answer: '',
    title: '',
    category: '',
    tags: ''
  });

  const { addDocument, searchDocuments } = useKnowledgeAdminAPI();

  const handleAddAnswer = (question: UnansweredQuestion) => {
    setAddingAnswerFor(question.id);
    setAnswerForm({
      questionId: question.id,
      question: question.question,
      answer: '',
      title: '',
      category: '',
      tags: ''
    });
  };

  const handleCancelAnswer = () => {
    setAddingAnswerFor(null);
    setAnswerForm({
      questionId: '',
      question: '',
      answer: '',
      title: '',
      category: '',
      tags: ''
    });
  };

  const handleSubmitAnswer = async () => {
    if (!answerForm.answer.trim() || !answerForm.title.trim()) {
      toaster.create({
        title: '请填写完整',
        description: '请填写标题和答案内容',
        status: 'warning',
        duration: 2000,
        isClosable: true
      });
      return;
    }

    try {
      // Create knowledge entry from the answer
      const fullContent = `问题：${answerForm.question}\n\n答案：${answerForm.answer}`;

      const result = await addDocument({
        text: fullContent,
        title: answerForm.title,
        category: answerForm.category || undefined,
        metadata: {
          source: 'unanswered_question',
          original_question: answerForm.question,
          tags: answerForm.tags.split(',').map(t => t.trim()).filter(Boolean)
        }
      });

      if (result.success) {
        toaster.create({
          title: '添加成功',
          description: `已添加 ${result.document_ids.length} 个知识块到知识库`,
          status: 'success',
          duration: 2000,
          isClosable: true
        });

        // Remove the question from the list
        setQuestions(prev => prev.filter(q => q.id !== answerForm.questionId));

        // Reset form
        handleCancelAnswer();
      }
    } catch (error) {
      toaster.create({
        title: '添加失败',
        description: error instanceof Error ? error.message : '未知错误',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
    }
  };

  const handleDismiss = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleSearch = async () => {
    // Search for similar questions in the knowledge base
    if (answerForm.question) {
      try {
        const result = await searchDocuments({
          query: answerForm.question,
          top_k: 3
        });

        if (result.success && result.results.length > 0) {
          toaster.create({
            title: '找到相关知识',
            description: `知识库中有 ${result.results.length} 条相关内容`,
            status: 'info',
            duration: 3000,
            isClosable: true
          });
        }
      } catch (error) {
        // Ignore search errors
      }
    }
  };

  const totalQuestions = questions.length;
  const highFrequencyQuestions = questions.filter(q => q.count >= 3).length;

  return (
    <VStack gap="16px" py="20px" align="stretch" height="100%">
      {/* Stats Header */}
      <SimpleGrid columns={{ base: 2, sm: 4 }} gap="12px">
        <Box
          p="12px"
          background={paper}
          border="1px solid"
          borderColor={hairline}
          borderRadius="4px"
        >
          <Text color={muted} fontSize="10px" fontWeight="600">
            未回答问题
          </Text>
          <Text
            mt="4px"
            color={ink}
            fontSize="20px"
            lineHeight="1"
            fontWeight="700"
            fontVariantNumeric="tabular-nums"
          >
            {totalQuestions}
          </Text>
        </Box>

        <Box
          p="12px"
          background={paper}
          border="1px solid"
          borderColor={hairline}
          borderRadius="4px"
        >
          <Text color={muted} fontSize="10px" fontWeight="600">
            高频问题
          </Text>
          <Text
            mt="4px"
            color={amber}
            fontSize="20px"
            lineHeight="1"
            fontWeight="700"
            fontVariantNumeric="tabular-nums"
          >
            {highFrequencyQuestions}
          </Text>
        </Box>

        <Box
          p="12px"
          background={paper}
          border="1px solid"
          borderColor={hairline}
          borderRadius="4px"
          colSpan={{ base: 2, sm: 2 }}
        >
          <Flex align="center" gap="8px">
            <Icon as={FiAlertTriangle} color={amber} size="14px" />
            <Text color={muted} fontSize="10px" fontWeight="600">
              优先处理高频问题,提升用户体验
            </Text>
          </Flex>
        </Box>
      </SimpleGrid>

      {/* Questions List */}
      <Box flex="1" overflowY="auto">
        {addingAnswerFor ? (
          <Box py="12px">
            <AnswerForm
              formData={answerForm}
              onChange={setAnswerForm}
              onSubmit={handleSubmitAnswer}
              onCancel={handleCancelAnswer}
            />
          </Box>
        ) : (
          <>
            {questions.length > 0 ? (
              <VStack align="stretch" gap="0">
                {questions
                  .sort((a, b) => b.count - a.count)
                  .map(question => (
                    <QuestionItem
                      key={question.id}
                      question={question}
                      onAddAnswer={handleAddAnswer}
                      onDismiss={handleDismiss}
                    />
                  ))}
              </VStack>
            ) : (
              <Box py="48px" textAlign="center">
                <Icon as={FiCheck} color={green} size="32px" mb="12px" />
                <Text color={ink} fontSize="13px" fontWeight="600" mb="4px">
                  太棒了！
                </Text>
                <Text color={muted} fontSize="12px">
                  目前没有未回答的问题
                </Text>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Tips */}
      <Box
        p="12px"
        background={greenWash}
        border="1px solid"
        borderColor={green}
        borderRadius="4px"
      >
        <Flex align="flex-start" gap="10px">
          <Icon as={BiBulb} color={green} size="16px" flexShrink={0} />
          <Box flex="1">
            <Text color={ink} fontSize="11px" fontWeight="600" mb="4px">
              优化建议
            </Text>
            <VStack align="stretch" gap="2px">
              <Text color={muted} fontSize="10px" lineHeight="1.5">
                • 高频问题（出现3次以上)应优先处理
              </Text>
              <Text color={muted} fontSize="10px" lineHeight="1.5">
                • 补充答案时,使用清晰的语言和具体的信息
              </Text>
              <Text color={muted} fontSize="10px" lineHeight="1.5">
                • 为相关内容添加标签,便于检索和维护
              </Text>
            </VStack>
          </Box>
        </Flex>
      </Box>
    </VStack>
  );
}
