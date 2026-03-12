import { memo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { SentimentGauge } from './SentimentGauge';
import { MarketThermometer } from './MarketThermometer';
import { CapitalActivity } from './CapitalActivity';
import { LimitBoardStats } from './LimitBoardStats';
import { LimitBoardStockPanel } from './LimitBoardStockPanel';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import type { EnhancedSentimentData, LimitBoardLevel } from '@/services/marketService';

interface EnhancedMarketSentimentProps {
    data: EnhancedSentimentData | null;
    loading?: boolean;
    onSelectStock?: (tsCode: string) => void;
    className?: string;
}

const BOARD_LEVEL_LABEL: Record<LimitBoardLevel, string> = {
    1: '首板',
    2: '2板',
    3: '3板',
    4: '4板',
    5: '5板+',
};

/**
 * 增强版市场情绪面板
 * 整合四个子模块：情绪仪表盘、市场温度计、资金活跃度、连板统计
 */
export const EnhancedMarketSentiment = memo(function EnhancedMarketSentiment({ data, loading, onSelectStock, className }: EnhancedMarketSentimentProps) {
    const [selectedLevel, setSelectedLevel] = useState<{ level: LimitBoardLevel; count: number } | null>(null);

    const handleBoardClick = (level: LimitBoardLevel, count: number) => {
        if (count <= 0) return;
        setSelectedLevel({ level, count });
    };

    const handleSelectStock = (tsCode: string) => {
        onSelectStock?.(tsCode);
        setSelectedLevel(null);
    };

    if (loading) {
        return (
            <Card className={cn('p-4', className)}>
                <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                </div>
            </Card>
        );
    }

    if (!data) {
        return (
            <Card className={cn('p-6', className)}>
                <div className="text-center text-muted-foreground py-8">
                    暂无市场情绪数据
                </div>
            </Card>
        );
    }

    return (
        <>
            <Card className={cn('p-2 overflow-hidden', className)}>
                {/* 2x2 网格布局 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {/* 情绪仪表盘 */}
                    <div className="bg-gradient-to-br from-muted to-white rounded-xl border border-border">
                        <SentimentGauge
                            score={data.sentiment.score}
                            label={data.sentiment.label}
                            trend={data.sentiment.trend}
                        />
                    </div>

                    {/* 市场温度计 */}
                    <div className="bg-gradient-to-br from-muted to-white rounded-xl border border-border">
                        <MarketThermometer
                            upCount={data.thermometer.upCount}
                            downCount={data.thermometer.downCount}
                            flatCount={data.thermometer.flatCount}
                            limitUp={data.thermometer.limitUp}
                            limitDown={data.thermometer.limitDown}
                            upRatio={data.thermometer.upRatio}
                        />
                    </div>

                    {/* 资金活跃度 */}
                    <div className="bg-gradient-to-br from-muted to-white rounded-xl border border-border">
                        <CapitalActivity
                            totalAmount={data.capital.totalAmount}
                            amountChange={data.capital.amountChange}
                            avgTurnover={data.capital.avgTurnover}
                            turnoverMedian={data.capital.turnoverMedian ?? data.capital.avgTurnover ?? 0}
                            highTurnoverRatio={data.capital.highTurnoverRatio ?? 0}
                            turnoverZScore={data.capital.turnoverZScore ?? 0}
                            amountVs5d={data.capital.amountVs5d ?? 0}
                            activityLevel={data.capital.activityLevel ?? '中活跃'}
                            baselineDays={data.capital.baselineDays ?? 0}
                            highTurnoverThreshold={data.capital.highTurnoverThreshold ?? 5}
                            highTurnoverRule={data.capital.highTurnoverRule ?? '主板>=5%，创业/科创>=8%，北交>=10%'}
                            northFlow={data.capital.northFlow}
                        />
                    </div>

                    {/* 连板统计 */}
                    <div className="bg-gradient-to-br from-muted to-white rounded-xl border border-border">
                        <LimitBoardStats
                            lianbanStats={data.limitStats.lianbanStats}
                            zhabanCount={data.limitStats.zhabanCount}
                            fengbanRate={data.limitStats.fengbanRate}
                            maxLianban={data.limitStats.maxLianban}
                            topIndustries={data.limitStats.topIndustries}
                            onBoardClick={handleBoardClick}
                        />
                    </div>
                </div>
            </Card>

            <Sheet open={!!selectedLevel} onOpenChange={(open) => !open && setSelectedLevel(null)}>
                <SheetContent
                    side="right"
                    className="w-[95vw] sm:w-[960px] sm:max-w-[960px] p-0 gap-0 overflow-hidden"
                >
                    <SheetTitle className="sr-only">
                        {selectedLevel ? `${BOARD_LEVEL_LABEL[selectedLevel.level]}股票列表` : '连板股票列表'}
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                        查看连板统计中当前档位的股票明细
                    </SheetDescription>
                    {selectedLevel && (
                        <LimitBoardStockPanel
                            level={selectedLevel.level}
                            expectedCount={selectedLevel.count}
                            onSelectStock={handleSelectStock}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
});