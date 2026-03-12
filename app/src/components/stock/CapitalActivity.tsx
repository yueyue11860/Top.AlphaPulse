import { memo, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    ChevronDown,
    ChevronUp,
    CircleGauge,
    Info,
    TrendingDown,
    TrendingUp,
    Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CapitalActivityProps {
    totalAmount: number;      // 成交额（亿）
    amountChange: number;     // 较昨日变化%
    avgTurnover: number;      // 平均换手率
    turnoverMedian: number;   // 中位换手率
    highTurnoverRatio: number;// 高换手占比
    turnoverZScore: number;   // 换手活跃标准分
    amountVs5d: number;       // 较5日均量偏离
    activityLevel: '低活跃' | '中活跃' | '高活跃';
    baselineDays: number;
    highTurnoverThreshold: number;
    highTurnoverRule: string;
    northFlow: number;        // 北向净流入（亿）
    className?: string;
}

export const CapitalActivity = memo(function CapitalActivity({
    totalAmount,
    amountChange,
    avgTurnover,
    turnoverMedian,
    highTurnoverRatio,
    turnoverZScore,
    amountVs5d,
    activityLevel,
    baselineDays,
    highTurnoverThreshold,
    highTurnoverRule,
    northFlow,
    className
}: CapitalActivityProps) {
    const [open, setOpen] = useState(false);

    const formatAmount = (value: number) => {
        if (Math.abs(value) >= 10000) {
            return (value / 10000).toFixed(2) + '万亿';
        }
        return value.toFixed(0) + '亿';
    };

    const formatSignedPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
    const formatSignedAmount = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}亿`;

    const activityTone = useMemo(() => {
        if (activityLevel === '高活跃') {
            return {
                badgeClass: 'bg-red-50 text-red-600 border-red-100',
                panelClass: 'from-red-50/70 to-orange-50/50 border-red-100',
                valueClass: 'text-red-600',
            };
        }
        if (activityLevel === '低活跃') {
            return {
                badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-100',
                panelClass: 'from-cyan-50/70 to-blue-50/50 border-cyan-100',
                valueClass: 'text-cyan-700',
            };
        }
        return {
            badgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
            panelClass: 'from-amber-50/70 to-yellow-50/50 border-amber-100',
            valueClass: 'text-amber-700',
        };
    }, [activityLevel]);

    return (
        <div className={cn('p-3 sm:p-4 h-full flex flex-col gap-3', className)}>
            <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">资金活跃度</div>
                <div className={cn('text-xs px-2 py-1 rounded-md border font-medium', activityTone.badgeClass)}>
                    {activityLevel}
                </div>
            </div>

            <div className={cn('rounded-xl border bg-gradient-to-r p-3', activityTone.panelClass)}>
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="text-xs text-muted-foreground">两市成交</div>
                        <div className="text-xl font-bold font-mono text-foreground mt-1">{formatAmount(totalAmount)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className={cn(
                            'text-xs font-mono inline-flex items-center gap-0.5',
                            amountChange >= 0 ? 'text-red-500' : 'text-green-600'
                        )}>
                            {amountChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            日环比 {formatSignedPercent(amountChange)}
                        </span>
                        <span className={cn(
                            'text-xs font-mono inline-flex items-center gap-0.5',
                            amountVs5d >= 0 ? 'text-red-500' : 'text-green-600'
                        )}>
                            {amountVs5d >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            较5日均量 {formatSignedPercent(amountVs5d)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="rounded-lg bg-muted/70 p-2.5 border border-border/70">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <CircleGauge className="w-3.5 h-3.5" />
                        换手健康度
                    </div>
                    <div className={cn('text-sm font-semibold font-mono', activityTone.valueClass)}>
                        Z={turnoverZScore.toFixed(2)}
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-background/80 py-1.5">
                        <div className="text-[11px] text-muted-foreground">平均</div>
                        <div className="text-sm font-semibold font-mono text-foreground">{avgTurnover.toFixed(2)}%</div>
                    </div>
                    <div className="rounded-md bg-background/80 py-1.5">
                        <div className="text-[11px] text-muted-foreground">中位</div>
                        <div className="text-sm font-semibold font-mono text-foreground">{turnoverMedian.toFixed(2)}%</div>
                    </div>
                    <div className="rounded-md bg-background/80 py-1.5">
                        <div className="text-[11px] text-muted-foreground">高换手</div>
                        <div className="text-sm font-semibold font-mono text-foreground">{highTurnoverRatio.toFixed(1)}%</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/60 border border-border/70 p-2">
                    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5" /> 平均换手
                    </div>
                    <div className="text-sm font-semibold font-mono text-foreground mt-1">{avgTurnover.toFixed(2)}%</div>
                </div>
                <div className="rounded-lg bg-muted/60 border border-border/70 p-2">
                    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                        <BarChart3 className="w-3.5 h-3.5" /> 中位换手
                    </div>
                    <div className="text-sm font-semibold font-mono text-foreground mt-1">{turnoverMedian.toFixed(2)}%</div>
                </div>
                <div className="rounded-lg bg-muted/60 border border-border/70 p-2">
                    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5" /> 高换手占比
                    </div>
                    <div className="text-sm font-semibold font-mono text-foreground mt-1">{highTurnoverRatio.toFixed(1)}%</div>
                </div>
                <div className="rounded-lg bg-muted/60 border border-border/70 p-2">
                    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                        {northFlow >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />} 北向摘要
                    </div>
                    <div className={cn(
                        'text-sm font-semibold font-mono mt-1',
                        northFlow >= 0 ? 'text-red-500' : 'text-green-600'
                    )}>
                        {formatSignedAmount(northFlow)}
                    </div>
                </div>
            </div>

            <Collapsible open={open} onOpenChange={setOpen}>
                <CollapsibleTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 justify-between px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <span className="inline-flex items-center gap-1">
                            <Info className="w-3.5 h-3.5" />
                            口径说明
                        </span>
                        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="rounded-lg border border-border/70 bg-muted/40 p-2 text-[11px] text-muted-foreground space-y-1">
                    <div>1. 高换手占比: 按分档阈值统计，当前市场加权阈值约 {highTurnoverThreshold.toFixed(1)}%。</div>
                    <div>2. 分档规则: {highTurnoverRule}</div>
                    <div>3. Z 分数: 当日平均换手率相对近 {baselineDays > 0 ? baselineDays : 20} 日基线的偏离强度。</div>
                    <div>4. 较5日均量: 今日两市成交额相对最近5个交易日均值的变化幅度。</div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
});