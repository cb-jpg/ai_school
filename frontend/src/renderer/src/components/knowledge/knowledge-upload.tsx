/**
 * Knowledge upload component
 */
import {
  Box,
  Text,
  Button,
  Field,
  Input,
  Textarea,
  Select,
  HStack,
  IconButton
} from '@chakra-ui/react';
import { FiUpload, FiLink, FiFileText, FiX } from 'react-icons/fi';
import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { knowledgeStyles } from './knowledge-styles';
import { KnowledgeCategory } from '@/types/knowledge';
import { createListCollection } from '@chakra-ui/react';

interface KnowledgeUploadProps {
  uploading: boolean;
  uploadProgress: number;
  onFileUpload: (params: {
    file: File;
    title: string;
    category: KnowledgeCategory;
    tags?: string;
    summary?: string;
  }) => Promise<unknown>;
  onUrlUpload: (params: {
    url: string;
    title?: string;
    category: KnowledgeCategory;
    tags?: string[];
  }) => Promise<unknown>;
  onManualCreate: (params: {
    title: string;
    content: string;
    category: KnowledgeCategory;
    tags?: string[];
    summary?: string;
  }) => Promise<unknown>;
}

export default function KnowledgeUpload({
  uploading,
  uploadProgress,
  onFileUpload,
  onUrlUpload,
  onManualCreate
}: KnowledgeUploadProps) {
  const { t } = useTranslation();
  const [uploadType, setUploadType] = useState<'file' | 'url' | 'manual'>('file');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<KnowledgeCategory>(KnowledgeCategory.OTHER);
  const [tags, setTags] = useState('');
  const [summary, setSummary] = useState('');

  // Category collection
  const categories = Object.values(KnowledgeCategory);
  const categoryCollection = createListCollection({
    items: categories.map(cat => ({
      label: t(`knowledge.category.${cat}`),
      value: cat
    }))
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  }, []);

  const handleSubmit = async () => {
    if (uploadType === 'file' && file) {
      await onFileUpload({
        file,
        title: title || file.name,
        category,
        tags,
        summary
      });
    } else if (uploadType === 'url' && url) {
      await onUrlUpload({
        url,
        title,
        category,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean)
      });
    } else if (uploadType === 'manual' && title && content) {
      await onManualCreate({
        title,
        content,
        category,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        summary
      });
    }
    // Reset form
    resetForm();
  };

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setUrl('');
    setContent('');
    setCategory(KnowledgeCategory.OTHER);
    setTags('');
    setSummary('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canSubmit =
    !uploading &&
    (uploadType === 'file' ? file : uploadType === 'url' ? url : title && content);

  return (
    <Box {...knowledgeStyles.upload.container}>
      {/* Upload type selector */}
      <HStack gap={2}>
        <Button
          size="sm"
          variant={uploadType === 'file' ? 'solid' : 'outline'}
          onClick={() => setUploadType('file')}
        >
          <FiUpload />
          {t('knowledge.upload.file')}
        </Button>
        <Button
          size="sm"
          variant={uploadType === 'url' ? 'solid' : 'outline'}
          onClick={() => setUploadType('url')}
        >
          <FiLink />
          {t('knowledge.upload.url')}
        </Button>
        <Button
          size="sm"
          variant={uploadType === 'manual' ? 'solid' : 'outline'}
          onClick={() => setUploadType('manual')}
        >
          <FiFileText />
          {t('knowledge.upload.manual')}
        </Button>
      </HStack>

      {/* File upload */}
      {uploadType === 'file' && (
        <>
          <Box
            {...knowledgeStyles.upload.dropZone}
            {...(dragActive ? knowledgeStyles.upload.dropZoneActive : {})}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={handleFileSelect}
              accept=".txt,.md,.pdf,.doc,.docx,.xls,.xlsx"
            />
            <FiUpload size={32} color="white" style={{ marginBottom: '8px' }} />
            <Text color="white" mb={1}>{t('knowledge.upload.dropFile')}</Text>
            <Text fontSize="sm" color="whiteAlpha.500">
              {t('knowledge.upload.supportedFormats')}
            </Text>
          </Box>

          {file && (
            <HStack bg="whiteAlpha.100" p={3} borderRadius="md">
              <Text flex={1} color="white" fontSize="sm">
                {file.name}
              </Text>
              <IconButton
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
              >
                <FiX />
              </IconButton>
            </HStack>
          )}
        </>
      )}

      {/* URL upload */}
      {uploadType === 'url' && (
        <Field.Root>
          <Field.Label>{t('knowledge.upload.url')}</Field.Label>
          <Input
            {...knowledgeStyles.form.field.input}
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field.Root>
      )}

      {/* Manual entry */}
      {uploadType === 'manual' && (
        <Field.Root>
          <Field.Label>{t('knowledge.upload.content')}</Field.Label>
          <Textarea
            {...knowledgeStyles.form.field.textarea}
            placeholder={t('knowledge.upload.contentPlaceholder')}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </Field.Root>
      )}

      {/* Common fields */}
      <Field.Root>
        <Field.Label>{t('knowledge.title')}</Field.Label>
        <Input
          {...knowledgeStyles.form.field.input}
          placeholder={t('knowledge.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field.Root>

      <Field.Root>
        <Field.Label>{t('knowledge.category')}</Field.Label>
        <Select.Root
          collection={categoryCollection}
          value={[category]}
          onValueChange={(details) => setCategory(details.value[0] as KnowledgeCategory)}
        >
          <Select.Trigger {...knowledgeStyles.form.field.input}>
            <Select.ValueText placeholder={t('knowledge.selectCategory')} />
          </Select.Trigger>
          <Select.Content>
            {categoryCollection.items.map(item => (
              <Select.Item item={item} key={item.value}>
                {item.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Field.Root>

      <Field.Root>
        <Field.Label>{t('knowledge.tags')}</Field.Label>
        <Input
          {...knowledgeStyles.form.field.input}
          placeholder={t('knowledge.tagsPlaceholder')}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </Field.Root>

      <Field.Root>
        <Field.Label>{t('knowledge.summary')}</Field.Label>
        <Textarea
          {...knowledgeStyles.form.field.textarea}
          placeholder={t('knowledge.summaryPlaceholder')}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </Field.Root>

      {/* Upload progress */}
      {uploading && (
        <Box {...knowledgeStyles.upload.progress}>
          <Box width="100%" height="8px" borderRadius="4px" overflow="hidden" bg="rgba(255,255,255,0.15)">
            <Box width={`${uploadProgress}%`} height="100%" bg="#3182ce" transition="width 0.3s ease" />
          </Box>
          <Text mt={2} textAlign="center" color="rgba(255,255,255,0.7)">
            {uploadProgress}%
          </Text>
        </Box>
      )}

      {/* Submit buttons */}
      <HStack gap={2} justify="flex-end">
        <Button
          variant="outline"
          onClick={resetForm}
          disabled={uploading}
        >
          {t('common.reset')}
        </Button>
        <Button
          colorPalette="blue"
          onClick={handleSubmit}
          disabled={!canSubmit || uploading}
        >
          {uploading ? t('knowledge.upload.uploading') : t('knowledge.upload.submit')}
        </Button>
      </HStack>
    </Box>
  );
}
