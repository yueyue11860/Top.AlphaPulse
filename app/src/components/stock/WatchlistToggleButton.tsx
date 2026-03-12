import { useMemo, useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWatchlist } from '@/contexts/WatchlistContext';

interface WatchlistToggleButtonProps {
  tsCode: string;
  stockName?: string | null;
  market?: string | null;
  className?: string;
  size?: 'sm' | 'icon' | 'icon-sm';
  variant?: 'outline' | 'ghost' | 'secondary';
  showLabel?: boolean;
}

export function WatchlistToggleButton({
  tsCode,
  stockName,
  market,
  className,
  size = 'icon-sm',
  variant = 'outline',
  showLabel = false,
}: WatchlistToggleButtonProps) {
  const { contains, toggleItem } = useWatchlist();
  const [isPending, setIsPending] = useState(false);
  const isActive = contains(tsCode);

  const label = useMemo(() => (isActive ? '已在自选' : '加入自选'), [isActive]);

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    setIsPending(true);
    try {
      await toggleItem({
        tsCode,
        stockName,
        market,
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={showLabel ? 'sm' : size}
      className={cn(
        showLabel && 'gap-1.5',
        isActive && 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-700/50 dark:bg-yellow-950/30 dark:text-yellow-300',
        className,
      )}
      onClick={handleClick}
      disabled={isPending}
      aria-label={`${label} ${stockName ?? tsCode}`}
      title={label}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Star className={cn('h-4 w-4', isActive && 'fill-current')} />
      )}
      {showLabel ? <span>{label}</span> : null}
    </Button>
  );
}