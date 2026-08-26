/**
 * Hook for knowledge upload functionality
 */
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useKnowledgeContext } from '@/context/knowledge-context';
import { useKnowledgeAPI } from '@/services/knowledge-api';
import { toaster } from '@/components/ui/toaster';
import { KnowledgeCategory } from '@/types/knowledge';

interface UploadFileParams {
  file: File;
  title: string;
  category: KnowledgeCategory;
  tags?: string;
  summary?: string;
}

interface UploadUrlParams {
  url: string;
  title?: string;
  category: KnowledgeCategory;
  tags?: string[];
}

export function useKnowledgeUpload() {
  const { t } = useTranslation();
  const { uploadProgress, setUploadProgress, setKnowledgeList } = useKnowledgeContext();
  const { uploadFile, addUrl, create: createManual, fetchList } = useKnowledgeAPI();

  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'file' | 'url' | 'manual'>('file');

  // Upload file
  const uploadKnowledgeFile = useCallback(async (params: UploadFileParams) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const result = await uploadFile(
        params.file,
        params.title,
        params.category,
        params.tags || '',
        params.summary
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.status === 'error') {
        throw new Error(result.message || 'Upload failed');
      }

      // Refresh list
      const entries = await fetchList();
      setKnowledgeList(entries);

      toaster.create({
        title: t('knowledge.success.upload'),
        type: 'success',
        duration: 2000
      });

      return result;
    } catch (error) {
      console.error('Error uploading file:', error);
      toaster.create({
        title: t('knowledge.error.uploadFailed'),
        description: error instanceof Error ? error.message : undefined,
        type: 'error',
        duration: 3000
      });
      throw error;
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, [uploadFile, fetchList, setKnowledgeList, setUploadProgress, t]);

  // Add from URL
  const addKnowledgeUrl = useCallback(async (params: UploadUrlParams) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const result = await addUrl({
        url: params.url,
        title: params.title,
        category: params.category,
        tags: params.tags || []
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.status === 'error') {
        throw new Error(result.message || 'Failed to add URL');
      }

      // Refresh list
      const entries = await fetchList();
      setKnowledgeList(entries);

      toaster.create({
        title: t('knowledge.success.urlAdded'),
        type: 'success',
        duration: 2000
      });

      return result;
    } catch (error) {
      console.error('Error adding URL:', error);
      toaster.create({
        title: t('knowledge.error.urlAddFailed'),
        description: error instanceof Error ? error.message : undefined,
        type: 'error',
        duration: 3000
      });
      throw error;
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, [addUrl, fetchList, setKnowledgeList, setUploadProgress, t]);

  // Create manual entry
  const createManualEntry = useCallback(async (params: {
    title: string;
    content: string;
    category: KnowledgeCategory;
    tags?: string[];
    summary?: string;
  }) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      setUploadProgress(50);

      const result = await createManual({ ...params, tags: params.tags ?? [] });

      setUploadProgress(100);

      // Refresh list
      const entries = await fetchList();
      setKnowledgeList(entries);

      toaster.create({
        title: t('knowledge.success.created'),
        type: 'success',
        duration: 2000
      });

      return result;
    } catch (error) {
      console.error('Error creating manual entry:', error);
      toaster.create({
        title: t('knowledge.error.createFailed'),
        description: error instanceof Error ? error.message : undefined,
        type: 'error',
        duration: 3000
      });
      throw error;
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, [createManual, fetchList, setKnowledgeList, setUploadProgress, t]);

  return {
    // State
    uploading,
    uploadProgress,
    uploadType,

    // Actions
    setUploadType,
    uploadFile: uploadKnowledgeFile,
    addUrl: addKnowledgeUrl,
    createManual: createManualEntry
  };
}
