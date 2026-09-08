/**
 * Topic Tab Row Component
 * 专题选项行（学校简介/校史/学校成就/学习标兵 + 附加动作按钮）
 * 与专题页（campus-knowledge）顶部导航同款式：手机端一行横向滑动、桌面端居右换行，
 * 滑动与点击效果保持一致；首页与新页面均可复用。
 */
import { Box, Button, Flex, HStack, Text } from '@chakra-ui/react';
import { FiBookOpen, FiClock, FiAward, FiUsers } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { CampusTopic, CampusTopicId, campusTopics } from '@/data/campus-knowledge';

const swissFont = '"Helvetica Neue", Arial, sans-serif';
const ink = '#121826';
const blue = '#002FA7';
const blueWash = '#E8EEFF';
const hairline = '#E5E7EB';
const paper = '#FFFFFF';

const topicIcons: Record<CampusTopicId, IconType> = {
  intro: FiBookOpen,
  history: FiClock,
  achievements: FiAward,
  'role-models': FiUsers,
};

export function TopicTabButton({
  topic,
  active,
  onClick,
}: {
  topic: CampusTopic;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = topicIcons[topic.id];
  return (
    <Button
      data-testid={`campus-nav-${topic.id}`}
      aria-current={active ? 'page' : undefined}
      aria-label={`进入${topic.navLabel}页面`}
      onClick={onClick}
      height="40px"
      px={{ base: '12px', lg: '16px' }}
      borderRadius="md"
      background={active ? blue : 'transparent'}
      color={active ? 'white' : ink}
      fontFamily={swissFont}
      fontWeight="500"
      fontSize="sm"
      flexShrink={0}
      _hover={{
        background: active ? blue : blueWash,
        color: active ? 'white' : blue,
      }}
      transition="all 200ms ease"
    >
      <HStack gap="8px">
        <Icon size={16} />
        <Text>{topic.navLabel}</Text>
      </HStack>
    </Button>
  );
}

interface TopicTabRowProps {
  /** 当前激活的专题（首页无专题传 null） */
  activeTopicId?: CampusTopicId | null;
  onNavigateTopic: (topicId: CampusTopicId) => void;
  /** 行尾附加按钮（如首页的"对话界面"） */
  trailing?: React.ReactNode;
}

export default function TopicTabRow({
  activeTopicId = null,
  onNavigateTopic,
  trailing,
}: TopicTabRowProps) {
  return (
    <Box
      flexShrink={0}
      px={{ base: '12px', md: '20px', lg: '24px' }}
      py={{ base: '10px', md: '20px' }}
      background={paper}
      borderRadius="lg"
      boxShadow="sm"
      border="1px solid"
      borderColor={hairline}
    >
      {/* 手机端一行横向滑动；桌面端保持换行布局（与专题页一致） */}
      <Flex
        align="center"
        justify={{ base: 'flex-start', lg: 'flex-end' }}
        gap="8px"
        flexWrap={{ base: 'nowrap', lg: 'wrap' }}
        overflowX={{ base: 'auto', lg: 'visible' }}
        css={{ '&::-webkit-scrollbar': { display: 'none' } }}
      >
        {campusTopics.map((topic) => (
          <TopicTabButton
            key={topic.id}
            topic={topic}
            active={activeTopicId === topic.id}
            onClick={() => onNavigateTopic(topic.id)}
          />
        ))}
        {trailing}
      </Flex>
    </Box>
  );
}
