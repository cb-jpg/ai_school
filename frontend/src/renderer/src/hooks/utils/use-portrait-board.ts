import { useEffect, useState } from 'react';

/**
 * 竖屏大屏检测（壁挂数字屏 / 竖放平板）：orientation=portrait 且宽度 ≥768。
 *
 * 此前整套 UI 只有两档设计：手机竖屏（<768，真机校准）与桌面横屏（≥768 md/lg）。
 * 竖屏宽 ≥768 的设备（55 寸竖屏 1272×2800）掉进夹缝：Chakra 命中 md/lg 走横屏
 * hero 布局（左窄栏+右留白、固定 px 大字号），Live2D 站位适配又被宽度门槛跳过，
 * 表现为内容堆顶部、下半屏空白、字号物理尺寸失控。命中本检测的设备改走
 * 「大屏竖屏专属排版」：内容列限宽居中 + 字号按视口放大 + 纵向分布。
 */
export function usePortraitBoard(): boolean {
  const query = '(orientation: portrait) and (min-width: 768px)';
  const [isBoard, setIsBoard] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIsBoard(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isBoard;
}
