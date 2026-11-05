/**
 * 应用版本徽标（2026-11-05）：登录页底部展示当前版本与热更状态。
 * - 版本号 = 构建期注入的 __APP_VERSION__（android versionName，如 2.56）
 * - 原生包（App）上顺带比对服务器 OTA manifest：有新热更包时提示「可更新」。
 *   手机端启动本就有弹窗更新流程、kiosk 静默换包，此处只是被动可见的状态提示
 * - 浏览器端不检查更新（服务器所挂 web 即最新），只显示版本号；检查失败静默
 */
import { useEffect, useState } from 'react';
import { Text, type TextProps } from '@chakra-ui/react';
import { Capacitor } from '@capacitor/core';
import { checkForOtaUpdate } from '@/services/ota-update';
import { APP_VERSION } from '@/utils/app-version';

export default function VersionBadge(props: TextProps) {
  const [updateVersion, setUpdateVersion] = useState('');

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let cancelled = false;
    checkForOtaUpdate()
      .then((r) => {
        if (!cancelled && r.available && r.manifest?.version) {
          setUpdateVersion(r.manifest.version);
        }
      })
      .catch(() => {
        // 服务器不可达等：版本号照常显示，更新状态留空
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const label = `小石同学 v${APP_VERSION}${
    updateVersion ? ` · 新版本 v${updateVersion} 可更新` : ''
  }`;
  return (
    <Text fontSize="2xs" position="relative" textAlign="center" {...props}>
      {label}
    </Text>
  );
}
