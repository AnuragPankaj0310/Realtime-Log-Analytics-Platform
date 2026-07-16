import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Server, ArrowLeft, Network, Activity } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { SkeletonPage } from '../components/Skeleton';
import { useServiceDetails, useRecentTraces, useAlerts } from '../hooks/useMetrics';
import { Cpu, Database, HardDrive, Globe } from 'lucide-react';

export default function ServiceDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'dependencies' | 'endpoints' | 'traces' | 'logs' | 'alerts'>('overview');
  const [logs, setLogs] = useState<any[]>([]);

  const { data: serviceData, isLoading } = useServiceDetails(id || '');
  const { data: allTraces } = useRecentTraces();
  const { data: allAlerts } = useAlerts();

  const traces = useMemo(() => {
    return (allTraces || []).filter((t: any) => t.service === id);
  }, [allTraces, id]);

  const alerts = useMemo(() => {
    return (allAlerts || []).filter((a: any) => a.service === id || (a.message && a.message.includes(id)));
  }, [allAlerts, id]);

  // Live Logs effect
  useEffect(() => {
    if (activeTab !== 'logs') return;
    
    const eventSource = new EventSource('/api/logs/stream');
    eventSource.onmessage = (event) => {
      try {
        const log = JSON.parse(event.data);
        if (log.service === id) {
          setLogs(prev => [...prev, log].slice(-100));
        }
      } catch (e) {}
    };
    return () => eventSource.close();
  }, [activeTab, id]);

  if (isLoading || !serviceData) {
    return <SkeletonPage />;
  }

  const { metrics, traffic_over_time, top_endpoints, dependencies } = serviceData;
  const status = metrics.availability > 99 ? 'healthy' : metrics.availability > 95 ? 'degraded' : 'critical';



  return (
    <div className="page-container h-[calc(100vh-2rem)] flex flex-col">
      <header className="page-header shrink-0 flex flex-col gap-4 pb-0">
        <Link to="/services" className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm w-max transition-colors">
          <ArrowLeft size={16} /> Back to Services
        </Link>
        
        <div className="flex justify-between items-end mb-4">
          <div>
            <h1 className="page-title flex items-center gap-2 mb-1 capitalize">
              <Server className="text-blue-500" />
              {id?.replace('-service', '')}
              <span className={`text-xs px-2 py-0.5 rounded-full border ${status === 'healthy' ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
                {status.toUpperCase()}
              </span>
            </h1>
            <div className="text-sm text-gray-400 flex gap-4 mt-2">
              <span>Environment: Production</span>
              <span>Region: us-east-1</span>
              <span>Uptime: 99.9%</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn outline">Restart Pods</button>
            <button className="btn primary">View Dashboards</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-gray-800 text-sm font-medium">
          {['overview', 'metrics', 'dependencies', 'endpoints', 'traces', 'logs', 'alerts'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab as any)} 
              className={`pb-3 transition-colors capitalize ${activeTab === tab ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {tab} {tab === 'traces' && `(${traces.length})`} {tab === 'alerts' && `(${alerts.length})`}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pt-6 min-h-0">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="card text-center">
                <div className="text-gray-400 text-sm mb-2">Requests / Sec</div>
                <div className="text-3xl font-bold">{metrics.throughput}</div>
              </div>
              <div className="card text-center">
                <div className="text-gray-400 text-sm mb-2">Error Rate</div>
                <div className={`text-3xl font-bold ${metrics.error_rate > 0.05 ? 'text-red-500' : 'text-green-500'}`}>
                  {(metrics.error_rate * 100).toFixed(2)}%
                </div>
              </div>
              <div className="card text-center">
                <div className="text-gray-400 text-sm mb-2">Availability</div>
                <div className="text-3xl font-bold text-green-500">
                  {metrics.availability.toFixed(2)}%
                </div>
              </div>
              <div className="card text-center">
                <div className="text-gray-400 text-sm mb-2">Avg Latency</div>
                <div className="text-3xl font-bold">{Math.round(metrics.latency_p50)} ms</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="card">
                <h3 className="font-semibold mb-4 text-gray-200 flex items-center gap-2"><Activity size={16} /> Traffic Timeline</h3>
                <div className="h-64">
                  <ReactECharts 
                    option={{
                      tooltip: { trigger: 'axis', backgroundColor: '#1f2937', borderColor: '#374151', textStyle: { color: '#fff' } },
                      grid: { left: '3%', right: '4%', bottom: '3%', top: '5%', containLabel: true },
                      xAxis: { type: 'category', data: traffic_over_time.map((d: any) => d.time), axisLabel: { color: '#9ca3af' } },
                      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#374151', type: 'dashed' } }, axisLabel: { color: '#9ca3af' } },
                      series: [
                        { name: 'RPS', type: 'line', data: traffic_over_time.map((d: any) => d.rps), itemStyle: { color: '#3b82f6' }, areaStyle: { opacity: 0.2, color: '#3b82f6' }, smooth: true }
                      ]
                    }} 
                    style={{ height: '100%', width: '100%' }} 
                  />
                </div>
              </div>
              
              <div className="card">
                <h3 className="font-semibold mb-4 text-gray-200 flex items-center gap-2"><Network size={16} /> Top Endpoints</h3>
                <div className="space-y-4">
                  {top_endpoints.slice(0, 5).map((ep: any, i: number) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-mono text-gray-300 truncate">{ep.endpoint}</span>
                        <span className="text-gray-400">{ep.requests} reqs</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.max(5, (ep.requests / (top_endpoints[0]?.requests || 1)) * 100)}%` }}></div>
                      </div>
                    </div>
                  ))}
                  {top_endpoints.length === 0 && <div className="text-gray-500 text-sm">No endpoints found.</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* METRICS TAB (Kubernetes-style Dashboard) */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-5 bg-gray-900 border border-gray-800">
                  <div className="flex items-center gap-2 text-gray-400 mb-4 font-semibold uppercase text-xs tracking-wider"><Cpu size={16} /> Compute</div>
                  <div className="flex justify-between items-end mb-2">
                    <div className="text-3xl font-bold text-gray-100">42<span className="text-lg text-gray-500 ml-1">%</span></div>
                    <div className="text-green-500 text-sm font-semibold">Healthy</div>
                  </div>
                  <div className="w-full bg-gray-800 h-1.5 rounded-full"><div className="bg-blue-500 h-1.5 rounded-full w-[42%]"></div></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-400">
                    <div>Threads: <span className="text-gray-200">124</span></div>
                    <div>Load Avg: <span className="text-gray-200">1.2</span></div>
                  </div>
                </div>

                <div className="card p-5 bg-gray-900 border border-gray-800">
                  <div className="flex items-center gap-2 text-gray-400 mb-4 font-semibold uppercase text-xs tracking-wider"><Database size={16} /> Memory</div>
                  <div className="flex justify-between items-end mb-2">
                    <div className="text-3xl font-bold text-gray-100">2.1<span className="text-lg text-gray-500 ml-1">GB</span></div>
                    <div className="text-yellow-500 text-sm font-semibold">Elevated</div>
                  </div>
                  <div className="w-full bg-gray-800 h-1.5 rounded-full"><div className="bg-yellow-500 h-1.5 rounded-full w-[78%]"></div></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-400">
                    <div>Heap: <span className="text-gray-200">1.8 GB</span></div>
                    <div>GC: <span className="text-gray-200">12ms/s</span></div>
                  </div>
                </div>

                <div className="card p-5 bg-gray-900 border border-gray-800">
                  <div className="flex items-center gap-2 text-gray-400 mb-4 font-semibold uppercase text-xs tracking-wider"><Globe size={16} /> Network</div>
                  <div className="flex justify-between items-end mb-2">
                    <div className="text-3xl font-bold text-gray-100">48<span className="text-lg text-gray-500 ml-1">MB/s</span></div>
                    <div className="text-green-500 text-sm font-semibold">Normal</div>
                  </div>
                  <div className="w-full bg-gray-800 h-1.5 rounded-full"><div className="bg-purple-500 h-1.5 rounded-full w-[30%]"></div></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-400">
                    <div>Conn: <span className="text-gray-200">1,402</span></div>
                    <div>Retries: <span className="text-gray-200">0.1%</span></div>
                  </div>
                </div>

                <div className="card p-5 bg-gray-900 border border-gray-800">
                  <div className="flex items-center gap-2 text-gray-400 mb-4 font-semibold uppercase text-xs tracking-wider"><HardDrive size={16} /> Storage</div>
                  <div className="flex justify-between items-end mb-2">
                    <div className="text-3xl font-bold text-gray-100">8.4<span className="text-lg text-gray-500 ml-1">GB</span></div>
                    <div className="text-green-500 text-sm font-semibold">Healthy</div>
                  </div>
                  <div className="w-full bg-gray-800 h-1.5 rounded-full"><div className="bg-green-500 h-1.5 rounded-full w-[12%]"></div></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-400">
                    <div>IOPS: <span className="text-gray-200">450</span></div>
                    <div>Latency: <span className="text-gray-200">1.2ms</span></div>
                  </div>
                </div>
             </div>
          </div>
        )}

        {/* DEPENDENCIES TAB (Investigation Layout) */}
        {activeTab === 'dependencies' && (
          <div className="grid grid-cols-2 gap-8">
            {/* Incoming Traffic */}
            <div>
              <h3 className="font-bold text-gray-200 mb-4 flex items-center gap-2"><ArrowLeft size={18} className="text-blue-400" /> Incoming Traffic</h3>
              <div className="space-y-4">
                {dependencies.incoming.length === 0 ? (
                  <div className="text-gray-500 text-sm">No incoming dependencies detected.</div>
                ) : dependencies.incoming.map((inc: string, i: number) => {
                  return (
                    <div key={i} className="card p-4 border border-gray-800 bg-gray-900 flex justify-between items-center group hover:border-gray-700 transition-colors cursor-pointer" onClick={() => navigate(`/services/${inc}`)}>
                      <div className="font-semibold text-gray-100 capitalize">{inc.replace('-service', ' Service')}</div>
                      <ArrowLeft size={16} className="text-gray-600" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Outgoing Traffic */}
            <div>
              <h3 className="font-bold text-gray-200 mb-4 flex items-center gap-2"><ArrowLeft size={18} className="text-purple-400 rotate-180" /> Outgoing Dependencies</h3>
              <div className="space-y-4">
                {dependencies.outgoing.length === 0 ? (
                  <div className="text-gray-500 text-sm">No outgoing dependencies detected.</div>
                ) : dependencies.outgoing.map((out: string, i: number) => {
                  return (
                    <div key={i} className="card p-4 border bg-gray-900 border-gray-800 flex justify-between items-center group hover:border-gray-700 transition-colors cursor-pointer" onClick={() => navigate(`/services/${out}`)}>
                      <div className="font-semibold text-gray-100 capitalize">{out.replace('-service', ' Service')}</div>
                      <ArrowLeft size={16} className="text-gray-600 rotate-180" />
                    </div>
                  );
                })}
                
                {/* External Datastore Dependency */}
                <div className="card p-4 border border-gray-800 bg-gray-900 flex justify-between items-center group hover:border-gray-700 transition-colors">
                  <div className="font-semibold text-gray-100 flex items-center gap-2"><Database size={14} className="text-blue-400" /> Storage Backend</div>
                  <div className="text-xs text-gray-500">PostgreSQL / Redis / ES</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ENDPOINTS TAB (Rich Table) */}
        {activeTab === 'endpoints' && (
          <div className="card h-full flex flex-col p-0 overflow-hidden border border-gray-800">
             <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#1a1f2e] text-gray-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 font-semibold">Endpoint</th>
                    <th className="p-4 font-semibold">Requests</th>
                    <th className="p-4 font-semibold">Throughput</th>
                    <th className="p-4 font-semibold">Avg Latency</th>
                    <th className="p-4 font-semibold">P95 Latency</th>
                    <th className="p-4 font-semibold">Error %</th>
                    <th className="p-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {top_endpoints.map((ep: any, i: number) => {
                    const p95 = ep.p95_latency || ep.avg_latency * 1.4;
                    const errRate = ((ep.error_rate || 0) * 100).toFixed(2);
                    const isErr = (ep.error_rate || 0) > 0.01;
                    return (
                      <tr key={i} className="hover:bg-gray-800/40 transition-colors cursor-pointer group">
                        <td className="p-4 font-mono text-blue-400 font-medium">{ep.endpoint}</td>
                        <td className="p-4 text-gray-300 font-semibold">{ep.requests.toLocaleString()}</td>
                        <td className="p-4 text-gray-400">{(ep.requests / 60).toFixed(1)} req/s</td>
                        <td className="p-4 text-yellow-400 font-semibold">{Math.round(ep.avg_latency)} ms</td>
                        <td className="p-4 text-yellow-500 font-semibold">{Math.round(p95)} ms</td>
                        <td className={`p-4 font-bold ${isErr ? 'text-red-400' : 'text-green-500'}`}>{errRate}%</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${isErr ? 'bg-red-950/50 text-red-400' : 'bg-green-950/50 text-green-500'}`}>
                            {isErr ? 'DEGRADED' : 'HEALTHY'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {top_endpoints.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-500">No endpoints found for the selected time range.</td></tr>}
                </tbody>
             </table>
          </div>
        )}

        {/* TRACES TAB */}
        {activeTab === 'traces' && (
          <div className="card h-full flex flex-col p-0">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="font-semibold text-gray-200">Recent Traces ({traces.length})</h3>
              <button className="btn outline py-1 text-sm" onClick={() => navigate('/tracing')}>View in Trace Explorer</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-900 text-gray-400 sticky top-0">
                  <tr>
                    <th className="p-4 font-medium">Trace ID</th>
                    <th className="p-4 font-medium">Timestamp</th>
                    <th className="p-4 font-medium">Endpoint</th>
                    <th className="p-4 font-medium">Duration</th>
                    <th className="p-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {traces.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-gray-500">No traces found for this service.</td></tr>
                  ) : traces.map((t: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-800/50 transition-colors cursor-pointer" onClick={() => navigate(`/tracing?traceId=${t.trace_id}`)}>
                      <td className="p-4 font-mono text-blue-400">{t.trace_id}</td>
                      <td className="p-4 text-gray-400">{new Date(t.timestamp).toLocaleString()}</td>
                      <td className="p-4 font-mono text-gray-300">{t.endpoint || '-'}</td>
                      <td className="p-4 text-gray-300">{t.duration || '<1'}ms</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-xs ${t.status === 'error' ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                          {t.status === 'error' ? 'ERROR' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="card h-full flex flex-col p-0 bg-[#0d1117]">
            <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-900">
              <h3 className="font-semibold text-gray-200 text-sm">Live Service Logs</h3>
              <div className="flex items-center gap-2 text-xs text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Connected
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-gray-300 space-y-1">
              {logs.map((log, i) => (
                <div key={i} className={`flex gap-3 hover:bg-gray-800/50 p-1 rounded ${log.status_code >= 400 || log.level === 'error' ? 'text-red-400' : ''}`}>
                  <span className="text-gray-500 whitespace-nowrap">{new Date(log.timestamp).toISOString()}</span>
                  <span className={`w-12 font-bold ${log.level === 'error' ? 'text-red-500' : 'text-blue-400'}`}>[{log.level || 'INFO'}]</span>
                  <span className="flex-1 break-all">{log.message || `${log.method} ${log.endpoint} ${log.status_code} ${log.response_time_ms}ms`}</span>
                </div>
              ))}
              {logs.length === 0 && <div className="text-gray-500 text-center mt-10">Waiting for logs...</div>}
            </div>
          </div>
        )}

        {/* ALERTS TAB */}
        {activeTab === 'alerts' && (
          <div className="card h-full flex flex-col p-0">
             <table className="w-full text-left text-sm">
                <thead className="bg-gray-900 text-gray-400">
                  <tr>
                    <th className="p-4 font-medium">Severity</th>
                    <th className="p-4 font-medium">Message</th>
                    <th className="p-4 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {alerts.map((al: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-800/50">
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-xs ${al.severity === 'Critical' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                          {al.severity}
                        </span>
                      </td>
                      <td className="p-4 text-gray-300">{al.reason || al.message}</td>
                      <td className="p-4 text-gray-500">{new Date(al.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                  {alerts.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-gray-500">No alerts found.</td></tr>}
                </tbody>
             </table>
          </div>
        )}
        
      </div>
    </div>
  );
}
