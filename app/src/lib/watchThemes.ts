export type WatchThemeId =
  | 'business'
  | 'cyberpunk'
  | 'hello-kitty'
  | 'doraemon'
  | 'black-gold'
  | 'retro-terminal'
  | 'deep-ocean'
  | 'paper-morning';

export interface WatchThemeDefinition {
  id: WatchThemeId;
  name: string;
  tagline: string;
  description: string;
  mood: 'professional' | 'fun' | 'immersive';
  preview: [string, string, string];
}

export const WATCH_THEME_STORAGE_KEY = 'alphapulse-watch-theme';

export const WATCH_THEMES: WatchThemeDefinition[] = [
  {
    id: 'business',
    name: '商务简约',
    tagline: '稳健盯盘',
    description: '适合长时间盯盘，强调信息层级与克制质感。',
    mood: 'professional',
    preview: ['#dce6f5', '#5f7fa7', '#101d30'],
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    tagline: '高能氛围',
    description: '高对比霓虹光感，适合夜盘观察与强刺激视觉反馈。',
    mood: 'immersive',
    preview: ['#60f7ff', '#ff46c7', '#09111f'],
  },
  {
    id: 'hello-kitty',
    name: 'Hello Kitty 灵感',
    tagline: '甜感观察',
    description: '以奶油粉和樱桃红营造轻松氛围，不使用角色素材。',
    mood: 'fun',
    preview: ['#ffe4ef', '#ff6a93', '#fff9fb'],
  },
  {
    id: 'doraemon',
    name: '哆啦A梦灵感',
    tagline: '澄蓝视野',
    description: '蓝白高亮层次更清爽，适合白天快速扫盘。',
    mood: 'fun',
    preview: ['#e9f7ff', '#1f97ff', '#0a2b45'],
  },
  {
    id: 'black-gold',
    name: '黑金交易室',
    tagline: '专业压场',
    description: '暗金线条与深色面板强化交易桌面感。',
    mood: 'professional',
    preview: ['#16110a', '#d9a54a', '#392918'],
  },
  {
    id: 'retro-terminal',
    name: '复古终端',
    tagline: '极客盯盘',
    description: '模拟旧终端扫描感，适合偏技术风格的盘中观察。',
    mood: 'immersive',
    preview: ['#0d120d', '#67f28b', '#1d3a20'],
  },
  {
    id: 'deep-ocean',
    name: '深海雷达',
    tagline: '冷静扫描',
    description: '深海青蓝层次突出雷达感，压低视觉噪声。',
    mood: 'immersive',
    preview: ['#061824', '#00c2c7', '#0d3348'],
  },
  {
    id: 'paper-morning',
    name: '清晨纸感',
    tagline: '轻盈晨会',
    description: '纸张肌理与暖灰蓝色调，适合早盘和研判场景。',
    mood: 'professional',
    preview: ['#f6f0e3', '#6380a3', '#c3b9a1'],
  },
];

export const DEFAULT_WATCH_THEME: WatchThemeId = 'business';

const WATCH_THEME_ID_SET = new Set<WatchThemeId>(WATCH_THEMES.map((theme) => theme.id));

export function isWatchThemeId(value: string | null | undefined): value is WatchThemeId {
  return Boolean(value && WATCH_THEME_ID_SET.has(value as WatchThemeId));
}

export function getWatchThemeDefinition(themeId: WatchThemeId): WatchThemeDefinition {
  return WATCH_THEMES.find((theme) => theme.id === themeId) || WATCH_THEMES[0];
}

export function getWatchThemeClassName(themeId: WatchThemeId) {
  return `watch-theme-${themeId}`;
}