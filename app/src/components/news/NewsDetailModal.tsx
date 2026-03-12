import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { X, ZoomIn, ImageIcon } from 'lucide-react';
import { IMPORTANCE_CONFIG, CATEGORY_CONFIG, type NewsCategory } from '@/lib/newsClassifier';
import { sourceColorMap, type NewsCardItem } from './NewsItemCard';

interface NewsDetailModalProps {
  news: NewsCardItem;
  onClose: () => void;
  onZoomImage: (url: string) => void;
}

export function NewsDetailModal({ news, onClose, onZoomImage }: NewsDetailModalProps) {
  const impCfg = IMPORTANCE_CONFIG[news.importance] || IMPORTANCE_CONFIG.normal;

  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-background flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border shadow-2xl sm:max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn('text-xs', sourceColorMap[news.sourceKey] || 'bg-muted text-muted-foreground')}>
              {news.source}
              {news.author && <span className="ml-1 opacity-90">· {news.author}</span>}
            </Badge>
            <span className="text-sm text-muted-foreground">{news.date} {news.time}</span>
            <Badge className={cn('text-xs', impCfg.color)}>
              {impCfg.label}
            </Badge>
            {news.categories.map((cat) => {
              const cfg = CATEGORY_CONFIG[cat as NewsCategory];
              if (!cfg) return null;
              return (
                <Badge key={cat} className={cn('text-xs', cfg.color)}>
                  {cfg.label}
                </Badge>
              );
            })}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* 内容 */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="p-6">
            {news.title && (
              <h2 className="mb-4 text-xl font-bold text-foreground">{news.title}</h2>
            )}
            <p className="whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">
              {news.content}
            </p>

            {/* 图片展示 */}
            {news.images && news.images.length > 0 && (
              <div className="mt-6">
                <div className="mb-3 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">相关图片 ({news.images.length})</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {news.images.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative group cursor-pointer overflow-hidden rounded-lg border border-border"
                      onClick={(e) => { e.stopPropagation(); onZoomImage(img); }}
                    >
                      <img
                        src={img}
                        alt={`图片 ${idx + 1}`}
                        className="h-40 w-full object-cover transition-transform group-hover:scale-105"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                        <ZoomIn className="h-8 w-8 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 图片放大 Lightbox */
export function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        onClick={onClose}
      >
        <X className="w-6 h-6 text-white" />
      </button>
      <img
        src={src}
        alt="放大图片"
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
