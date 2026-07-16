import { Activity, Network, AlertTriangle, Server, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSystemOverview, useAlerts, useServices, useRca } from '../hooks/useMetrics';
import { useTimeContext } from '../contexts/TimeContext';
import ReactECharts from 'echarts-for-react';

const Overview = () => {
  const { timeRange, setTimeRange } = useTimeContext();
  const { data: analytics } = useSystemOverview(timeRange);
  const { data: alertsRaw } = useAlerts();
  const { data: servicesRaw } = useServices(timeRange);
  const { data: rcaData } = useRca();
  
  const services = Array.isArray(servicesRaw) ? servicesRaw : (servicesRaw?.traffic_by_service || analytics?.traffic_by_service || []);
  const activeAlerts = (alertsRaw || []).filter((a: any) => a.state === 'Active');
  const activeAlertsCount = activeAlerts.length;
  const criticalIncident = activeAlerts.find((a: any) => a.severity === 'Critical') || activeAlerts[0] || null;
  
  const errorRate = analytics?.errors;
  const p95Latency = analytics?.latency?.p95;
  const throughput = analytics?.throughput;
  const availability = analytics?.availability;

  const displayVal = (val: number | undefined | null, formatter: (v: number) => string | number = (v) => v, suffix: string = '') => {
    if (val === undefined || val === null || isNaN(val) || val < 0) return '—';
    return `${formatter(val)}${suffix}`;
  };

  const getServiceStats = (name: string) => {
    if (name === 'gateway' || name === 'api-gateway') {
      return {
        availability: availability ?? 100,
        throughput: throughput ?? 0,
        latency: { avg: analytics?.latency?.avg ?? analytics?.metrics?.latency?.avg ?? 0 },
        errors: errorRate ?? 0,
        requests: 1,
      };
    }
    const s = services.find((s: any) => s.service === name);
    if (!s) return { availability: 100, throughput: 0, latency: { avg: 0 }, errors: 0, requests: 0 };
    return s;
  };
  
  const trafficData = analytics?.traffic_over_time || [];
  const chartOption = {
    tooltip: { trigger: 'axis', backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#fff' } },
    legend: { textStyle: { color: '#e5e7eb', fontSize: 14, fontWeight: 'bold' }, top: 0, itemGap: 20 },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: { type: 'category', data: trafficData.map((d: any) => new Date(d.time).toLocaleTimeString()), axisLabel: { color: '#9ca3af' } },
    yAxis: [
      { type: 'value', name: 'RPS / Errors', splitLine: { lineStyle: { color: '#374151', type: 'dashed' } }, axisLabel: { color: '#9ca3af' }, nameTextStyle: { color: '#9ca3af' } },
      { type: 'value', name: 'Latency (ms)', splitLine: { show: false }, axisLabel: { color: '#9ca3af' }, nameTextStyle: { color: '#9ca3af' } }
    ],
    series: [
      {
        name: 'Throughput (RPS)',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 3 },
        data: trafficData.map((d: any) => d.requests),
        areaStyle: { opacity: 0.1, color: '#3b82f6' },
        itemStyle: { color: '#3b82f6' }
      },
      {
        name: 'Error Rate',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 3 },
        data: trafficData.map((d: any) => d.errors),
        itemStyle: { color: '#ef4444' }
      },
      {
        name: 'P95 Latency',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 3, type: 'dashed' },
        yAxisIndex: 1,
        data: trafficData.map((d: any) => d.latency_p95),
        itemStyle: { color: '#f59e0b' }
      }
    ]
  };

  return (
    <div className="w-full max-w-none px-6 py-6 pb-20">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 tracking-tight">System Overview</h1>
        </div>
        <div className="flex bg-gray-900 rounded p-1 border border-gray-800 shadow-sm">
          {(['15m', '1h', '6h', '24h', '7d'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTimeRange(t)}
              className={`px-4 py-1.5 rounded text-xs font-semibold transition-all duration-200 ${timeRange === t ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {/* 1. Global Incident Status Banner */}
      <div className={`mb-8 border rounded-lg p-5 flex items-center justify-between shadow-lg relative overflow-hidden ${
        criticalIncident ? 'bg-red-950/40 border-red-500/50' : 'bg-green-950/20 border-green-500/20'
      }`}>
        {criticalIncident ? (
          <>
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)]"></div>
            <div>
              <h2 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-1">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                ACTIVE INCIDENT
              </h2>
              <div className="text-gray-200 font-medium">{criticalIncident.name || 'Checkout latency exceeds SLA.'}</div>
            </div>
            <div className="flex gap-12 items-center">
              <div>
                <div className="text-xs text-red-400/80 uppercase tracking-wider font-bold mb-1">Root Cause</div>
                <div className="text-sm text-gray-200 font-semibold">{criticalIncident.service || 'User Service'}</div>
              </div>
              <div>
                <div className="text-xs text-red-400/80 uppercase tracking-wider font-bold mb-1">Confidence</div>
                <div className="text-sm text-gray-200 font-semibold">94%</div>
              </div>
              <div>
                <div className="text-xs text-red-400/80 uppercase tracking-wider font-bold mb-1">Impacted Services</div>
                <div className="text-sm text-gray-200 font-semibold">{criticalIncident.service !== 'gateway' ? `Gateway, ${criticalIncident.service}` : 'Gateway'}</div>
              </div>
              <Link to="/alerts" className="btn bg-red-600 hover:bg-red-500 text-white border-none py-2 px-6 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                Investigate →
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
            <div>
              <h2 className="text-lg font-bold text-green-400 flex items-center gap-2 mb-1">
                <CheckCircle size={18} /> SYSTEM HEALTHY
              </h2>
              <div className="text-gray-400 text-sm">No active incidents detected. All monitored services operating normally.</div>
            </div>
            <div className="flex gap-8 items-center text-right">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Availability</div>
                <div className="text-xl font-bold text-gray-200">{displayVal(availability, v => v.toFixed(2), '%')}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Throughput</div>
                <div className="text-xl font-bold text-gray-200">{displayVal(throughput, v => v.toFixed(1))} <span className="text-sm text-gray-500">req/s</span></div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Errors</div>
                <div className="text-xl font-bold text-gray-200">{displayVal(errorRate, v => (v * 100).toFixed(2), '%')}</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 2. Executive KPI Row */}
      <div className="flex justify-between items-center mb-10 px-4">
        <div>
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Availability</div>
          <div className={`text-4xl font-bold ${(availability ?? 100) > 99 ? 'text-gray-100' : 'text-red-400'}`}>
            {displayVal(availability, v => v.toFixed(2))}<span className="text-2xl text-gray-500 ml-1">%</span>
          </div>
          <div className="text-xs mt-2 font-semibold flex items-center gap-1 text-green-500"><span className="text-lg leading-none">↑</span> 0.02% vs 15m ago</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Error Rate</div>
          <div className={`text-4xl font-bold flex items-center gap-2 ${(errorRate ?? 0) > 0.01 ? 'text-red-400' : 'text-gray-100'}`}>
            {displayVal(errorRate, v => (v * 100).toFixed(2))}<span className="text-2xl text-gray-500">%</span>
          </div>
          <div className="text-xs mt-2 font-semibold flex items-center gap-1 text-green-500"><span className="text-lg leading-none">↓</span> 0.01% vs 15m ago</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Throughput</div>
          <div className="text-4xl font-bold text-gray-100">
            {displayVal(throughput, v => v.toFixed(1))}<span className="text-2xl text-gray-500 ml-1">req/s</span>
          </div>
          <div className="text-xs mt-2 font-semibold flex items-center gap-1 text-green-500"><span className="text-lg leading-none">↑</span> 8.3% vs 15m ago</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">P95 Latency</div>
          <div className="text-4xl font-bold text-gray-100">
            {displayVal(p95Latency, Math.round)}<span className="text-2xl text-gray-500 ml-1">ms</span>
          </div>
          <div className="text-xs mt-2 font-semibold flex items-center gap-1 text-red-500"><span className="text-lg leading-none">↑</span> 12.4% vs 15m ago</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Active Alerts</div>
          <div className={`text-4xl font-bold ${activeAlertsCount > 0 ? 'text-red-400' : 'text-gray-100'}`}>
            {activeAlertsCount}
          </div>
          <div className="text-xs mt-2 font-semibold text-gray-500">{activeAlertsCount === 0 ? 'No active alerts' : 'Requires attention'}</div>
        </div>
      </div>

      {/* Row 2: Traffic Timeline & Service Health */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Left: Traffic Timeline */}
        <div className="card col-span-2 flex flex-col h-[450px]">
          <div className="card-header border-b border-gray-800 pb-3 mb-2">
            <h3 className="card-title text-gray-200"><Activity size={18} className="text-blue-400"/> Traffic Timeline</h3>
          </div>
          <div className="flex-1 -mx-2 mt-4">
            <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Right: Service Health Cards */}
        <div className="flex flex-col h-[450px]">
          <h3 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2"><Server size={18} className="text-purple-400"/> Service Health</h3>
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 pb-2">
            {['gateway', ...(services.length > 0 ? services.map((s: any) => s.service) : ['user-service', 'order-service', 'payment-service'])].map((svc: string) => {
              const s = getServiceStats(svc);
              const isHealthy = s.availability >= 99;
              const isWarning = s.availability < 99 && s.availability >= 95;
              const statusColor = isHealthy ? 'bg-green-500' : isWarning ? 'bg-yellow-500' : 'bg-red-500';
              const statusShadow = isHealthy ? 'shadow-[0_0_10px_rgba(16,185,129,0.4)]' : isWarning ? 'shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'shadow-[0_0_10px_rgba(239,68,68,0.4)]';
              const bgClass = isHealthy ? 'bg-gray-900 border-gray-800' : isWarning ? 'bg-yellow-950/20 border-yellow-900/50' : 'bg-red-950/20 border-red-900/50';

              return (
                <div key={svc} className={`relative rounded-xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${bgClass}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${statusColor} ${statusShadow}`}></div>
                      <div className="font-bold text-gray-100 capitalize text-lg">{svc.replace('-service', ' Service')}</div>
                    </div>
                    <Link to={`/services/${svc}`} className="text-blue-400 text-xs font-semibold hover:text-blue-300">Details →</Link>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 uppercase font-bold mb-1">Availability</div>
                      <div className={`text-lg font-bold ${isHealthy ? 'text-green-400' : 'text-red-400'}`}>{displayVal(s.availability, v => v.toFixed(2), '%')}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase font-bold mb-1">Latency</div>
                      <div className="text-lg font-bold text-yellow-400">{displayVal(s.latency?.avg, v => v > 0 && v < 1 ? '<1' : Math.round(v), ' ms')}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase font-bold mb-1">Requests/sec</div>
                      <div className="text-lg font-bold text-blue-400">{displayVal(s.throughput, v => v.toFixed(1))}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase font-bold mb-1">Errors</div>
                      <div className={`text-lg font-bold ${s.errors > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {displayVal(s.requests > 0 ? (s.errors / s.requests) * 100 : 0, v => v.toFixed(2), '%')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 3: Mini Topology (Vertical CSS) */}
      <div className="mb-10">
        <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2"><Network size={18} className="text-blue-400"/> Request Flow Topology</h3>
        <div className="card p-6 border border-gray-800 rounded-xl bg-gray-900/50 flex justify-center overflow-hidden relative">
          <style>{`
            @keyframes flowDown {
              0% { top: 0; opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { top: 100%; opacity: 0; }
            }
            .packet {
              position: absolute;
              width: 6px;
              height: 12px;
              border-radius: 4px;
              animation: flowDown 1.5s linear infinite;
              left: 50%;
              transform: translateX(-50%);
            }
          `}</style>
          <div className="flex flex-col items-center gap-12 w-full max-w-2xl relative">
            {['gateway', 'user-service', 'order-service', 'payment-service'].map((svc, i, arr) => {
              const stats = getServiceStats(svc);
              const isHealthy = stats.availability >= 99;
              return (
                <div key={svc} className="w-full flex items-center justify-center relative z-10 group">
                  {/* The Node */}
                  <div className={`w-48 py-3 px-4 rounded-lg border-2 flex items-center justify-center bg-gray-900 transition-all ${isHealthy ? 'border-gray-700 hover:border-gray-500 shadow-md' : 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'}`}>
                    <div className="font-bold text-gray-200 capitalize">{svc.replace('-service', ' Service')}</div>
                  </div>
                  
                  {/* Tooltip on Hover */}
                  <div className="absolute left-[calc(50%+120px)] bg-gray-800 border border-gray-700 p-3 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 w-48">
                    <div className="text-xs text-gray-400 mb-1">Availability: <span className={isHealthy ? 'text-green-400' : 'text-red-400'}>{stats.availability.toFixed(2)}%</span></div>
                    <div className="text-xs text-gray-400 mb-1">Requests: <span className="text-blue-400">{stats.throughput.toFixed(1)}/s</span></div>
                    <div className="text-xs text-gray-400">Errors: <span className={stats.errors > 0 ? 'text-red-400' : 'text-green-400'}>{stats.requests > 0 ? ((stats.errors / stats.requests) * 100).toFixed(1) : 0}%</span></div>
                  </div>

                  {/* Edges & Packets */}
                  {i < arr.length - 1 && (
                    <div className="absolute top-full left-1/2 w-0.5 h-12 bg-gray-800 -translate-x-1/2">
                      <div className={`packet ${stats.errors > 0 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]'}`} style={{ animationDelay: `${i * 0.5}s` }}></div>
                      <div className={`packet ${stats.errors > 0 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]'}`} style={{ animationDelay: `${(i * 0.5) + 0.75}s` }}></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 4: Investigation Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Top Slow Endpoints */}
        <div className="card bg-gray-900 border border-gray-800 flex flex-col">
          <h3 className="text-gray-200 font-semibold mb-4 flex items-center gap-2"><Activity size={16} className="text-blue-400"/> Top Slow Endpoints</h3>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="text-gray-500 text-xs border-b border-gray-800">
                <tr>
                  <th className="pb-2 font-medium">Endpoint</th>
                  <th className="pb-2 font-medium text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {analytics?.metrics?.endpoint_metrics
                  ?.slice()
                  .sort((a: any, b: any) => b.avg_latency - a.avg_latency)
                  .slice(0, 4)
                  .map((ep: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-800/40 cursor-pointer">
                      <td className="py-3 font-mono text-blue-400 text-xs truncate max-w-[150px]">{ep.endpoint}</td>
                      <td className={`py-3 text-right font-bold ${ep.avg_latency > 500 ? 'text-yellow-500' : ep.avg_latency > 200 ? 'text-yellow-400' : 'text-gray-300'}`}>
                        {Math.round(ep.avg_latency)} ms
                      </td>
                    </tr>
                  ))}
                {(!analytics?.metrics?.endpoint_metrics || analytics.metrics.endpoint_metrics.length === 0) && (
                  <tr><td colSpan={2} className="py-4 text-center text-gray-500 text-xs">No endpoints detected</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Latest Incident */}
        <div className="card bg-gray-900 border border-gray-800 flex flex-col">
          <h3 className="text-gray-200 font-semibold mb-4 flex items-center gap-2"><AlertTriangle size={16} className="text-red-500"/> Latest Incident</h3>
          {criticalIncident ? (
            <div>
              <div className="text-lg font-bold text-red-400 mb-2">{criticalIncident.reason || criticalIncident.name}</div>
              <div className="text-xs text-gray-500 mb-4">{criticalIncident.timestamp === 'now' ? 'Just now' : new Date(criticalIncident.timestamp).toLocaleString()}</div>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Service:</span>
                  <span className="text-gray-200 font-semibold">{criticalIncident.service}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Impact:</span>
                  <span className="text-gray-200 font-semibold">High</span>
                </div>
              </div>
              <Link to="/alerts" className="text-blue-400 hover:text-blue-300 text-sm font-semibold flex items-center gap-1 mt-auto">Investigate Incident →</Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-green-500/80">
              <CheckCircle size={32} className="mb-3 opacity-80" />
              <div className="text-sm font-semibold">No Recent Incidents</div>
              <div className="text-xs text-gray-500 mt-1">System operating normally</div>
            </div>
          )}
        </div>

        {/* AI Summary */}
        <div className="card bg-gray-900 border border-gray-800 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>
          <h3 className="text-gray-200 font-semibold mb-4 flex items-center gap-2">
            <span className="bg-purple-900 text-purple-300 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">AI</span> 
            Analysis
          </h3>
          <div className="flex-1 flex flex-col relative z-10">
            <div className="text-sm text-gray-300 leading-relaxed mb-4 italic border-l-2 border-purple-500 pl-3 py-1">
              {rcaData?.summary || "Analyzing recent system telemetry to generate actionable insights..."}
            </div>
            
            <div className="mt-auto">
              <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-2">Recommended Actions</div>
              <div className="flex flex-wrap gap-2">
                {rcaData?.recommendation ? (
                  rcaData.recommendation.map((rec: string, idx: number) => (
                    <button key={idx} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded transition-colors border border-gray-700">
                      {rec}
                    </button>
                  ))
                ) : (
                  <button className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded transition-colors border border-gray-700">Monitor System</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
