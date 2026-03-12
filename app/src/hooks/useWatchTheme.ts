import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_WATCH_THEME,
  getWatchThemeDefinition,
  isWatchThemeId,
  WATCH_THEMES,
  WATCH_THEME_STORAGE_KEY,
  type WatchThemeId,
} from '@/lib/watchThemes';

function readStoredTheme(): WatchThemeId {
  const stored = localStorage.getItem(WATCH_THEME_STORAGE_KEY);
  return isWatchThemeId(stored) ? stored : DEFAULT_WATCH_THEME;
}

export function useWatchTheme() {
  const [theme, setThemeState] = useState<WatchThemeId>(() => readStoredTheme());

  const setTheme = useCallback((nextTheme: WatchThemeId) => {
    setThemeState(nextTheme);
    localStorage.setItem(WATCH_THEME_STORAGE_KEY, nextTheme);
  }, []);

  const cycleTheme = useCallback((direction: 'next' | 'prev' = 'next') => {
    const currentIndex = WATCH_THEMES.findIndex((item) => item.id === theme);
    const delta = direction === 'next' ? 1 : -1;
    const nextIndex = (currentIndex + delta + WATCH_THEMES.length) % WATCH_THEMES.length;
    setTheme(WATCH_THEMES[nextIndex].id);
  }, [setTheme, theme]);

  const randomizeTheme = useCallback(() => {
    if (WATCH_THEMES.length <= 1) return;
    const candidates = WATCH_THEMES.filter((item) => item.id !== theme);
    const nextTheme = candidates[Math.floor(Math.random() * candidates.length)];
    setTheme(nextTheme.id);
  }, [setTheme, theme]);

  const currentTheme = useMemo(() => getWatchThemeDefinition(theme), [theme]);

  return {
    theme,
    setTheme,
    cycleTheme,
    randomizeTheme,
    currentTheme,
    themes: WATCH_THEMES,
  };
}