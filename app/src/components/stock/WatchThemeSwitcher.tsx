import { useMemo, useState } from 'react';
import { Check, Palette, Shuffle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WatchThemeDefinition, WatchThemeId } from '@/lib/watchThemes';

interface WatchThemeSwitcherProps {
  theme: WatchThemeId;
  themes: WatchThemeDefinition[];
  onThemeChange: (themeId: WatchThemeId) => void;
  onRandomize: () => void;
  isMobile?: boolean;
}

function ThemeSwatch({ colors }: { colors: WatchThemeDefinition['preview'] }) {
  const background = useMemo(
    () => `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 52%, ${colors[2]} 100%)`,
    [colors],
  );

  return <div className="h-14 rounded-xl border border-white/20 shadow-sm" style={{ background }} />;
}

function ThemePickerContent({
  activeTheme,
  themes,
  onThemeChange,
}: {
  activeTheme: WatchThemeId;
  themes: WatchThemeDefinition[];
  onThemeChange: (themeId: WatchThemeId) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">盯盘主题中心</div>
          <div className="text-xs text-muted-foreground">首期主题只作用于盯盘页，不影响其他页面。</div>
        </div>
        <Badge variant="outline">8 套</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {themes.map((item) => {
          const selected = item.id === activeTheme;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onThemeChange(item.id)}
              className={cn(
                'rounded-2xl border p-3 text-left transition-all',
                selected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-background hover:border-primary/40 hover:bg-accent/40',
              )}
            >
              <ThemeSwatch colors={item.preview} />
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{item.name}</span>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-[0.18em]">
                      {item.tagline}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground leading-5">{item.description}</div>
                </div>
                <div
                  className={cn(
                    'mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-muted text-muted-foreground',
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WatchThemeSwitcher({
  theme,
  themes,
  onThemeChange,
  onRandomize,
  isMobile = false,
}: WatchThemeSwitcherProps) {
  const [open, setOpen] = useState(false);
  const activeTheme = themes.find((item) => item.id === theme) || themes[0];

  const trigger = (
    <Button variant="outline" size="sm" className="watch-theme-control h-9 gap-2 px-3">
      <Palette className="h-4 w-4" />
      <span>{activeTheme.name}</span>
      <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--watch-accent))]" />
    </Button>
  );

  return (
    <div className="flex items-center gap-2">
      {isMobile ? (
        <>
          <Button variant="outline" size="icon-sm" className="watch-theme-control" onClick={onRandomize} title="随机主题">
            <Shuffle className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="watch-theme-control h-9 gap-2 px-3" onClick={() => setOpen(true)}>
            <Palette className="h-4 w-4" />
            主题
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
              <SheetHeader>
                <SheetTitle>盯盘主题中心</SheetTitle>
                <SheetDescription>{activeTheme.name} 已启用，可随时切换其他主题。</SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                <ThemePickerContent
                  activeTheme={theme}
                  themes={themes}
                  onThemeChange={(nextTheme) => {
                    onThemeChange(nextTheme);
                    setOpen(false);
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <>
          <Button variant="outline" size="icon-sm" className="watch-theme-control" onClick={onRandomize} title="随机主题">
            <Shuffle className="h-4 w-4" />
          </Button>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent align="end" className="w-[32rem] rounded-2xl p-4">
              <ThemePickerContent
                activeTheme={theme}
                themes={themes}
                onThemeChange={(nextTheme) => {
                  onThemeChange(nextTheme);
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  );
}