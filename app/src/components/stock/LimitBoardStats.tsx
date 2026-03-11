import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Flame, Shield, Zap } from 'lucide-react';

interface LianbanStats {
    oneBoard: number;
    twoBoard: number;
    threeBoard: number;
    fourBoard: number;
    fivePlus: number;
}

interface LimitBoardStatsProps {
    lianbanStats: LianbanStats;
    zhabanCount: number;
    fengbanRate: number;
    maxLianban: number;
    topIndustries?: { name: string; count: number }[];
    onBoardClick?: (level: 1 | 2 | 3 | 4 | 5, count: number) => void;
    className?: string;
}

export const LimitBoardStats = memo(function LimitBoardStats({
    lianbanStats,
    zhabanCount,
    fengbanRate,
    maxLianban,
    topIndustries = [],
    onBoardClick,
    className
}: LimitBoardStatsProps) {
    // 连板天梯数据
    const lianbanData = [
        { label: '首板', count: lianbanStats.oneBoard, color: 'bg-red-400', level: 1 as const },
        { label: '2板', count: lianbanStats.twoBoard, color: 'bg-red-500', level: 2 as const },
        { label: '3板', count: lianbanStats.threeBoard, color: 'bg-red-600', level: 3 as const },
        { label: '4板', count: lianbanStats.fourBoard, color: 'bg-red-700', level: 4 as const },
        { label: '5板+', count: lianbanStats.fivePlus, color: 'bg-red-800', level: 5 as const },
    ];

    const maxCount = Math.max(...lianbanData.map(d => d.count), 1);

    return (
        <div className={cn('p-4', className)}>
            {/* 标题 */}
            <div className="text-sm font-medium text-muted-foreground mb-3">连板统计</div>

            {/* 核心指标 */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                {/* 封板率 */}
                <div className="flex flex-col items-center p-2 rounded-lg bg-amber-50">
                    <Shield className="w-4 h-4 text-amber-500 mb-1" />
                    <span className="text-lg font-bold text-amber-600 font-mono">{fengbanRate.toFixed(0)}%</span>
                    <span className="text-[10px] text-muted-foreground">封板率</span>
                </div>

                {/* 炸板数 */}
                <div className="flex flex-col items-center p-2 rounded-lg bg-muted">
                    <Zap className="w-4 h-4 text-muted-foreground mb-1" />
                    <span className="text-lg font-bold text-muted-foreground font-mono">{zhabanCount}</span>
                    <span className="text-[10px] text-muted-foreground">炸板</span>
                </div>

                {/* 最高板 */}
                <div className="flex flex-col items-center p-2 rounded-lg bg-red-50">
                    <Flame className="w-4 h-4 text-red-500 mb-1" />
                    <span className="text-lg font-bold text-red-500 font-mono">{maxLianban}板</span>
                    <span className="text-[10px] text-muted-foreground">最高</span>
                </div>
            </div>

            {/* 连板天梯 */}
            <div className="space-y-1.5">
                {lianbanData.map((item) => {
                    const disabled = item.count <= 0;
                    return (
                        <button
                            key={item.label}
                            type="button"
                            disabled={disabled}
                            onClick={() => onBoardClick?.(item.level, item.count)}
                            className={cn(
                                'w-full flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors',
                                disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted/70 active:bg-muted'
                            )}
                            aria-label={`查看${item.label}股票列表，当前${item.count}只`}
                        >
                            <span className="text-xs text-muted-foreground w-8">{item.label}</span>
                            <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={cn('h-full rounded-full transition-all duration-500', item.color)}
                                    style={{ width: `${(item.count / maxCount) * 100}%` }}
                                />
                            </div>
                            <span className="text-xs font-mono text-muted-foreground w-6 text-right">{item.count}</span>
                        </button>
                    );
                })}
            </div>

            {/* 热门行业 */}
            {topIndustries.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs text-muted-foreground mb-2">涨停热门行业</div>
                    <div className="flex flex-wrap gap-1">
                        {topIndustries.slice(0, 3).map((industry, index) => (
                            <span
                                key={industry.name}
                                className={cn(
                                    'px-2 py-0.5 rounded-full text-xs font-medium',
                                    index === 0 ? 'bg-red-100 text-red-600' :
                                        index === 1 ? 'bg-orange-100 text-orange-600' :
                                            'bg-amber-100 text-amber-600'
                                )}
                            >
                                {industry.name} ({industry.count})
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});