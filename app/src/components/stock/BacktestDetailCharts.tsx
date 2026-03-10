import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface EquitySeriesItem {
  date: string;
  totalValue: number;
  cumulativeReturn: number;
  drawdown: number;
}

interface CycleReturnSeriesItem {
  code: string;
  name: string;
  returnPct: number;
}

export default function BacktestDetailCharts({
  equitySeries,
  cycleReturnSeries,
}: {
  equitySeries: EquitySeriesItem[];
  cycleReturnSeries: CycleReturnSeriesItem[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <div className="mb-3 font-medium text-foreground">累计收益曲线</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={equitySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={52} />
              <Tooltip formatter={(value) => [`${value}`, '累计收益%']} />
              <Line type="monotone" dataKey="cumulativeReturn" stroke="#0f766e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <div className="mb-3 font-medium text-foreground">卖出收益分布</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cycleReturnSeries.slice(0, 12)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} width={52} />
              <Tooltip formatter={(value) => [`${value}%`, '收益率']} />
              <Bar dataKey="returnPct" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}