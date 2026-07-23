import ReactECharts from 'echarts-for-react';
import { Activity, Clock, AlertTriangle, Filter, Server, ArrowUpRight, Zap } from 'lucide-react';
import { SkeletonPage } from '../components/Skeleton';
import { useAnalytics } from '../hooks/useMetrics';
import { useTimeContext } from '../contexts/TimeContext';

interface AnalyticsData {
  top_endpoints: Array<{endpoint: string, requests: number, avg_latency: number}>;
  slowest_endpoints?: Array<{endpoint: string, avg_latency: number, requests?: number, count?: number}>;
  slow_endpoints?: Array<{endpoint: string, avg_latency: number, requests?: number, count?: number}>;
  traffic_by_service: Array<{service: string, requests?: number, throughput?: number}>;
  http_status_distribution: Array<{status: string, count: number}>;
  traffic_over_time: Array<{time: string, requests: number, errors: number, latency_p50?: number, latency_p90?: number, latency_p95?: number, latency_p99?: number}>;
  latency_histogram?: Array<{bucket: string, count: number}>;
  heatmap?: Array<[number, number, number]>;
  throughput?: number;
  errors?: number;
  availability?: number;
  latency?: {
    avg?: number;
    p50?: number;
    p90?: number;
    p95?: number;
    p99?: number;
  };
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];
const STATUS_COLORS: Record<string, string> = {
  '200': '#10b981',
  '201': '#34d399',
  '400': '#f59e0b',
  '401': '#fb923c',
  '403': '#f97316',
  '404': '#fbbf24',
  '500': '#ef4444',
  '502': '#dc2626',
  '503': '#b91c1c',
};

export default function Analytics() {
  const { timeRange, setTimeRange } = useTimeContext();
  const { data: rawData, isLoading: loading, error: queryError } = useAnalytics(timeRange);

  const error = queryError ? 'Failed to load analytics data.' : null;
  const rawResolved = (rawData?.metrics || rawData) as AnalyticsData | undefined;

  // Normalise: guarantee every array field exists so charts never crash
  // when ES has no data yet (e.g. fresh boot before any traffic).
  const data: AnalyticsData | undefined = rawResolved
    ? {
        ...rawResolved,
        top_endpoints:            rawResolved.top_endpoints            ?? [],
        traffic_by_service:       rawResolved.traffic_by_service       ?? [],
        http_status_distribution: rawResolved.http_status_distribution ?? [],
        traffic_over_time:        rawResolved.traffic_over_time        ?? [],
        latency_histogram:        rawResolved.latency_histogram        ?? [],
        heatmap:                  rawResolved.heatmap                  ?? [],
      }
    : undefined;

  if (loading && !data) return <SkeletonPage />;
  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;
  if (!data) return <SkeletonPage />;

  const timeFormatOptions: Intl.DateTimeFormatOptions = 
    timeRange === '7d' || timeRange === '24h' 
      ? { month: 'short', day: 'numeric', hour: '2-digit' }
      : { hour: '2-digit', minute: '2-digit' };

  const displayVal = (val: number | undefined | null, formatter: (v: number) => string | number = (v) => v, suffix: string = '') => {
    if (val === undefined || val === null || isNaN(val) || val < 0) return '—';
    return `${formatter(val)}${suffix}`;
  };

  // ECharts Configurations
  const trafficChartOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#fff' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.traffic_over_time.map(t => new Date(t.time).toLocaleTimeString([], timeFormatOptions)),
      axisLine: { lineStyle: { color: '#4b5563' } }
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#374151', type: 'dashed' } }, axisLine: { lineStyle: { color: '#4b5563' } } },
    series: [
      {
        name: 'Requests',
        type: 'line',
        smooth: true,
        symbol: 'none',
        sampling: 'average',
        itemStyle: { color: '#8b5cf6' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(139, 92, 246, 0.8)' }, { offset: 1, color: 'rgba(139, 92, 246, 0)' }]
          }
        },
        data: data.traffic_over_time.map(t => t.requests)
      }
    ]
  };

  const latencyChartOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#fff' } },
    legend: { textStyle: { color: '#9ca3af' }, top: 0 },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.traffic_over_time.map(t => new Date(t.time).toLocaleTimeString([], timeFormatOptions)),
      axisLine: { lineStyle: { color: '#4b5563' } }
    },
    yAxis: { type: 'value', name: 'Latency (ms)', splitLine: { lineStyle: { color: '#374151', type: 'dashed' } }, axisLine: { lineStyle: { color: '#4b5563' } }, nameTextStyle: { color: '#9ca3af' } },
    series: [
      {
        name: 'P50',
        type: 'line',
        smooth: true,
        symbol: 'none',
        itemStyle: { color: '#10b981' },
        data: data.traffic_over_time.map(t => t.latency_p50 || 0)
      },
      {
        name: 'P90',
        type: 'line',
        smooth: true,
        symbol: 'none',
        itemStyle: { color: '#f59e0b' },
        data: data.traffic_over_time.map(t => t.latency_p90 || 0)
      },
      {
        name: 'P95',
        type: 'line',
        smooth: true,
        symbol: 'none',
        itemStyle: { color: '#ef4444' },
        data: data.traffic_over_time.map(t => t.latency_p95 || 0)
      },
      {
        name: 'P99',
        type: 'line',
        smooth: true,
        symbol: 'none',
        itemStyle: { color: '#b91c1c' },
        data: data.traffic_over_time.map(t => t.latency_p99 || 0)
      }
    ]
  };

  const statusPieOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#fff' } },
    legend: { top: 'bottom', textStyle: { color: '#9ca3af' } },
    series: [
      {
        name: 'HTTP Status',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 4, borderColor: '#111827', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: '20', fontWeight: 'bold', color: '#fff' } },
        labelLine: { show: false },
        data: data.http_status_distribution.map(d => ({
          value: d.count,
          name: d.status,
          itemStyle: { color: STATUS_COLORS[d.status] || '#8b5cf6' }
        }))
      }
    ]
  };

  const trafficByServiceOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#fff' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '5%', containLabel: true },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#374151', type: 'dashed' } }, axisLine: { lineStyle: { color: '#4b5563' } } },
    yAxis: { type: 'category', data: (data.traffic_by_service || []).map(s => s.service), axisLine: { lineStyle: { color: '#4b5563' } } },
    series: [
      {
        name: 'Requests',
        type: 'bar',
        data: (data.traffic_by_service || []).map((s, i) => ({
          value: s.requests || s.throughput, // throughput works as a proxy if requests isn't directly available
          itemStyle: { color: COLORS[i % COLORS.length] }
        }))
      }
    ]
  };

  // Use real Histogram Data (Latency Distribution) from API
  const histogramData: Array<{bucket: string, count: number}> = data.latency_histogram || [];

  const histogramOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#fff' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: histogramData.map(d => d.bucket), axisLine: { lineStyle: { color: '#4b5563' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#374151', type: 'dashed' } }, axisLine: { lineStyle: { color: '#4b5563' } } },
    series: [
      {
        name: 'Requests',
        type: 'bar',
        barWidth: '60%',
        data: histogramData.map((d, i) => ({
          value: d.count,
          itemStyle: { color: i > 3 ? '#ef4444' : i > 1 ? '#f59e0b' : '#10b981' }
        }))
      }
    ]
  };

  // Use real Heatmap Data from API or fallback if not available
  const hours = data.traffic_over_time?.map(t => new Date(t.time).toLocaleTimeString([], timeFormatOptions)) || [];
  const buckets = ['>1s', '500ms-1s', '200-500ms', '100-200ms', '50-100ms', '0-50ms'];
  
  // Create heatmap data from API if it provides the matrix, else we create an empty one
  const heatmapData: Array<[number, number, number]> = data.heatmap?.length ? data.heatmap : [];

  const heatmapOption = {
    backgroundColor: 'transparent',
    tooltip: { position: 'top', backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#fff' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '5%', containLabel: true },
    xAxis: { type: 'category', data: hours, splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)'] } }, axisLine: { lineStyle: { color: '#4b5563' } } },
    yAxis: { type: 'category', data: buckets, splitArea: { show: true }, axisLine: { lineStyle: { color: '#4b5563' } } },
    visualMap: {
      min: 0,
      max: Math.max(10, ...heatmapData.map(d => d[2])),
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      show: false,
      inRange: { color: ['#1e1b4b', '#4c1d95', '#7c3aed', '#c026d3', '#e11d48'] }
    },
    series: [{
      name: 'Requests',
      type: 'heatmap',
      data: heatmapData,
      label: { show: false },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
    }]
  };

  return (
    <div className="page-container flex flex-col h-[calc(100vh-2rem)]">
      <header className="page-header shrink-0 flex justify-between items-center">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Activity size={24} className="text-blue-500" />
            Operational Analytics
          </h1>
          <p className="page-subtitle">Platform-wide traffic, latency, and error trends</p>
        </div>
        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800 shadow-sm">
          {(['15m', '1h', '6h', '24h', '7d'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTimeRange(t)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${timeRange === t ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card bg-gray-900/50 border-gray-800 text-center flex flex-col justify-center py-6">
            <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Global Throughput</div>
            <div className="text-3xl font-bold text-blue-400 flex items-center justify-center gap-2">
              <Zap size={24}/> {displayVal(data.throughput, v => v.toFixed(1))} <span className="text-sm font-normal text-gray-500">req/s</span>
            </div>
          </div>
          <div className="card bg-gray-900/50 border-gray-800 text-center flex flex-col justify-center py-6">
            <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Global Error Rate</div>
            <div className={`text-3xl font-bold flex items-center justify-center gap-2 ${(data.errors || 0) > 0.05 ? 'text-red-500' : 'text-green-500'}`}>
              <AlertTriangle size={24}/> {displayVal(data.errors, v => (v * 100).toFixed(2), '%')}
            </div>
          </div>
          <div className="card bg-gray-900/50 border-gray-800 text-center flex flex-col justify-center py-6">
            <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">P95 Latency</div>
            <div className="text-3xl font-bold text-yellow-400 flex items-center justify-center gap-2">
              <Clock size={24}/> {displayVal(data.latency?.p95, Math.round)} <span className="text-sm font-normal text-gray-500">ms</span>
            </div>
          </div>
          <div className="card bg-gray-900/50 border-gray-800 text-center flex flex-col justify-center py-6">
            <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">P99 Latency</div>
            <div className="text-3xl font-bold text-red-400 flex items-center justify-center gap-2">
              <ArrowUpRight size={24}/> {displayVal(data.latency?.p99, Math.round)} <span className="text-sm font-normal text-gray-500">ms</span>
            </div>
          </div>
        </div>

        {/* Main Charts */}
        <div className="grid grid-cols-1 gap-6">
          <div className="card flex flex-col h-[350px]">
            <h3 className="font-semibold text-gray-200 mb-4 flex items-center gap-2 shrink-0">
              <Activity size={16} className="text-blue-400" />
              Traffic Volume Over Time
            </h3>
            <div className="flex-1 min-h-0">
              <ReactECharts option={trafficChartOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>

          <div className="card flex flex-col h-[350px]">
            <h3 className="font-semibold text-gray-200 mb-4 flex items-center gap-2 shrink-0">
              <Activity size={16} className="text-purple-400" />
              Latency Heatmap (Requests by Latency & Time)
            </h3>
            <div className="flex-1 min-h-0">
              <ReactECharts option={heatmapOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card flex flex-col h-[350px]">
            <h3 className="font-semibold text-gray-200 mb-4 flex items-center gap-2 shrink-0">
              <Clock size={16} className="text-orange-400" />
              Latency Distribution (P50/P90/P95/P99)
            </h3>
            <div className="flex-1 min-h-0">
              <ReactECharts option={latencyChartOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>
          
          <div className="card flex flex-col h-[350px]">
            <h3 className="font-semibold text-gray-200 mb-4 flex items-center gap-2 shrink-0">
              <Clock size={16} className="text-blue-400" />
              Latency Histogram (Buckets)
            </h3>
            <div className="flex-1 min-h-0">
              <ReactECharts option={histogramOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card flex flex-col h-[350px]">
            <h3 className="font-semibold text-gray-200 mb-4 flex items-center gap-2 shrink-0">
              <AlertTriangle size={16} className="text-yellow-400" />
              Status Code Distribution
            </h3>
            <div className="flex-1 min-h-0">
              <ReactECharts option={statusPieOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>
          <div className="card flex flex-col h-[350px]">
            <h3 className="font-semibold text-gray-200 mb-4 flex items-center gap-2 shrink-0">
              <Filter size={16} className="text-green-400" />
              Traffic by Service
            </h3>
            <div className="flex-1 min-h-0">
              <ReactECharts option={trafficByServiceOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>

          <div className="card flex flex-col h-[350px]">
            <h3 className="font-semibold text-gray-200 mb-4 flex items-center gap-2 shrink-0">
              <Clock size={16} className="text-red-400" />
              Slowest Endpoints
            </h3>
            <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800 sticky top-0 bg-gray-950/90 backdrop-blur z-10">
                  <tr>
                    <th className="py-3 px-2">Endpoint</th>
                    <th className="py-3 px-2 text-right">Avg Latency</th>
                    <th className="py-3 px-2 text-right">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {(data.slow_endpoints || data.slowest_endpoints || []).map((ep: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-2.5 px-2 font-mono text-xs text-blue-400 truncate max-w-[200px]" title={ep.endpoint}>{ep.endpoint}</td>
                      <td className="py-2.5 px-2 text-right text-red-400 font-bold">{Math.round(ep.avg_latency)} ms</td>
                      <td className="py-2.5 px-2 text-right text-gray-400">{ep.requests?.toLocaleString() || ep.count?.toLocaleString() || '-'}</td>
                    </tr>
                  ))}
                  {(!data.slow_endpoints && !data.slowest_endpoints) || (data.slow_endpoints || data.slowest_endpoints || []).length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-500 italic">No data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Server size={16} className="text-purple-400" />
            Top Endpoints Performance
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-900/50 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800">
                <tr>
                  <th className="px-4 py-3">Endpoint</th>
                  <th className="px-4 py-3 text-right">Requests</th>
                  <th className="px-4 py-3 text-right">Avg Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {data.top_endpoints?.map((ep: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-blue-400 truncate max-w-[300px]" title={ep.endpoint}>{ep.endpoint}</td>
                    <td className="text-right text-gray-300 font-medium px-4">{ep.requests?.toLocaleString() || ep.count?.toLocaleString() || 0}</td>
                    <td className="text-right text-gray-400 px-4">{Math.round(ep.avg_latency || 0)} ms</td>
                  </tr>
                ))}
                {(!data.top_endpoints || data.top_endpoints.length === 0) && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-500 italic">No data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
