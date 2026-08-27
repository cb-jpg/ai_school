/**
 * useLive2dModels - 拉取后端 /api/live2d-models/info 的角色列表
 * 多个组件共用（hero-sidebar、character-config），数据由 service 层缓存。
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getLive2dModels,
  invalidateLive2dModelsCache,
  type Live2dCharacter,
} from '@/services/live2d-models-api';

interface UseLive2dModelsResult {
  characters: Live2dCharacter[];
  loading: boolean;
  error: string | null;
  /** 清缓存后重新拉取 */
  refresh: () => void;
}

export function useLive2dModels(): UseLive2dModelsResult {
  const [characters, setCharacters] = useState<Live2dCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getLive2dModels()
      .then((list) => {
        setCharacters(list);
      })
      .catch((e: unknown) => {
        setCharacters([]);
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    invalidateLive2dModelsCache();
    load();
  }, [load]);

  return { characters, loading, error, refresh };
}
