import { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Activity, Server, FileText, ChevronRight, Play } from 'lucide-react';
import { useAlerts, useRca, useRecentTraces } from '../hooks/useMetrics';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const Alerts = () => {
  const [filter, setFilter] = useState<'All' | 'Active' | 'Acknowledged' | 'Resolved'>('All');
  
  const { data: alertsRaw, isLoading: loadingAlerts, refetch } = useAlerts();
  const { data: rca } = useRca();
  const { data: recentTracesRaw } = useRecentTraces();

  const alerts = alertsRaw || [];
  const loading = loadingAlerts;

  const updateState = async (alertId: string, newState: string) => {
    try {
      const res = await fetch('/api/alerts/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId, state: newState })
      });
      if (res.ok) {
        refetch();
        if (newState === 'Acknowledged') {
          toast.success('Incident Acknowledged', { icon: '👀' });
        } else if (newState === 'Resolved') {
          toast.success('Incident Resolved', { icon: '✅' });
        }
      } else {
        toast.error('Failed to update incident state');
      }
    } catch (e) {
      console.error(e);
      toast.error('Network error updating state');
    }
  };

  const filteredAlerts = alerts.filter((a: any) => filter === 'All' || a.state === filter);
  
  // Find top critical incident to highlight in the Jira-style view
  const topIncident = alerts.find((a: any) => a.state === 'Active' && a.severity === 'Critical') || alerts[0];

  if (loading) {
    return <div className="p-8 text-gray-400">Loading incident data...</div>;
  }

  return (
    <div className="p-8 max-w-none mx-auto space-y-8 animate-fade-in pb-20">
      <header className="flex justify-between items-center border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-gray-100">
            <AlertTriangle size={24} className="text-red-500" />
            Incident Management
          </h1>
          <p className="text-gray-400 mt-1">Investigation and resolution workflow</p>
        </div>
      </header>

      {/* Jira-Style Incident View */}
      {topIncident ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column: Investigation Details */}
          <div className="xl:col-span-2 space-y-6">
            <div className="card p-0 border border-gray-800 bg-gray-900 overflow-hidden">
              <div className="bg-gray-950 p-4 border-b border-gray-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-bold font-mono">
                    INC-{topIncident.id ? String(topIncident.id).split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) : '0000'}
                  </span>
                  <h2 className="text-lg font-bold text-gray-100">{topIncident.name || 'Critical System Anomaly'}</h2>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${topIncident.state === 'Active' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                  {topIncident.state}
                </span>
              </div>
              
              <div className="p-6 space-y-8">
                {/* Root Cause & RCA */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                    <Activity size={16} className="text-purple-400" />
                    AI Root Cause Analysis
                  </h3>
                  <div className="bg-gray-950 border border-purple-500/30 rounded p-5 text-gray-300 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-blue-500"></div>
                    
                    <div className="mb-4">
                      <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Summary</div>
                      <p className="text-gray-200">{rca?.summary || "Analyzing incident telemetry..."}</p>
                    </div>

                    <div className="mb-4">
                      <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Evidence</div>
                      <ul className="list-disc pl-4 space-y-1 text-sm text-gray-300">
                        {rca?.evidence?.map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        )) || <li>Analyzing traces...</li>}
                      </ul>
                    </div>

                    <div className="flex gap-4">
                      <div className="bg-red-900/30 border border-red-500/30 text-red-300 px-3 py-2 rounded text-sm font-medium flex-1">
                        <span className="block text-xs text-red-500/80 uppercase tracking-wider mb-1">Likely Cause</span>
                        {rca?.likely_cause || topIncident.recommendation}
                      </div>
                      <div className="bg-purple-900/30 border border-purple-500/30 text-purple-300 px-3 py-2 rounded text-sm font-medium shrink-0 flex flex-col items-center justify-center min-w-[100px]">
                        <span className="block text-xs text-purple-500/80 uppercase tracking-wider mb-1">Confidence</span>
                        <span className="text-xl">{rca?.confidence || '--'}%</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-800">
                      <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Recommendation</div>
                      <div className="flex gap-2 flex-wrap">
                        {rca?.recommendation?.map((item: string, i: number) => (
                          <span key={i} className="bg-gray-900 border border-gray-700 px-2 py-1 rounded text-xs text-gray-300">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Evidence */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                    <FileText size={16} className="text-blue-400" />
                    Evidence & Telemetry
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-950 border border-gray-800 rounded p-4">
                      <div className="text-xs text-gray-500 mb-2">Latest Error Log</div>
                      <code className="text-xs text-red-400 break-all font-mono">
                        [ERROR] ConnectionResetError: Peer closed connection at 172.20.0.15:39712
                      </code>
                      <Link to={`/logs?service=${topIncident.service}`} className="mt-3 text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1">
                        View surrounding logs <ChevronRight size={12}/>
                      </Link>
                    </div>
                    <div className="bg-gray-950 border border-gray-800 rounded p-4">
                      <div className="text-xs text-gray-500 mb-2">Distributed Trace</div>
                      <div className="text-xs text-purple-400 font-mono mb-1">{rca?.trace_id || (recentTracesRaw?.[0]?.trace_id || 'No trace available')}</div>
                      <Link to={`/tracing?traceId=${rca?.trace_id || recentTracesRaw?.[0]?.trace_id}`} className="mt-3 text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1">
                        Open in Trace Explorer <ChevronRight size={12}/>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                    <Clock size={16} className="text-gray-400" />
                    Incident Timeline
                  </h3>
                  <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-700 before:to-transparent">
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-red-500 bg-gray-900 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2"></div>
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded border border-gray-800 bg-gray-950 shadow">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-bold text-red-400 text-sm">Critical Threshold Exceeded</div>
                          <time className="font-mono text-xs text-gray-500">{topIncident.timestamp}</time>
                        </div>
                        <div className="text-gray-400 text-xs">Error rate exceeded 5% on {topIncident.service}</div>
                      </div>
                    </div>
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-yellow-500 bg-gray-900 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2"></div>
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded border border-gray-800 bg-gray-950 shadow">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-bold text-yellow-400 text-sm">Initial Warning</div>
                          <time className="font-mono text-xs text-gray-500">T - 2 mins</time>
                        </div>
                        <div className="text-gray-400 text-xs">Latency p95 spiked above 500ms</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Metadata & Actions */}
          <div className="space-y-6">
            <div className="card bg-gray-900 border border-gray-800 p-0 overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h3 className="font-bold text-gray-200">Incident Details</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Severity</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-xs ${topIncident.severity === 'Critical' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {topIncident.severity}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Status</span>
                  <span className="text-gray-200 font-bold">{topIncident.state}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-gray-800 pt-4 mt-4">
                  <span className="text-gray-500">Affected Services</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-gray-800 border border-gray-700 px-2 py-1 rounded text-xs text-blue-300 flex items-center gap-1">
                    <Server size={12}/> {topIncident.service}
                  </span>
                  {topIncident.service !== 'gateway' && (
                    <span className="bg-gray-800 border border-gray-700 px-2 py-1 rounded text-xs text-blue-300 flex items-center gap-1">
                      <Server size={12}/> gateway
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="card bg-gray-900 border border-gray-800 p-0 overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h3 className="font-bold text-gray-200">Actions</h3>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {topIncident.state === 'Active' && (
                  <button onClick={() => updateState(topIncident.id, 'Acknowledged')} className="w-full btn bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2">
                    Acknowledge Incident
                  </button>
                )}
                {topIncident.state !== 'Resolved' && (
                  <button onClick={() => updateState(topIncident.id, 'Resolved')} className="w-full btn bg-green-600 hover:bg-green-500 text-white font-semibold py-2">
                    Mark as Resolved
                  </button>
                )}
                <button className="w-full btn bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 font-semibold py-2 flex items-center justify-center gap-2">
                  <Play size={14}/> Execute Mitigation Runbook
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card bg-green-900/10 border border-green-500/20 py-12 text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-green-400 mb-2">All Systems Operational</h2>
          <p className="text-gray-400">No active critical incidents detected.</p>
        </div>
      )}

      {/* Historical Alerts Stream */}
      <div>
        <div className="flex justify-between items-center mb-4 mt-8">
          <h3 className="font-semibold text-gray-200 text-lg">Alerts Stream</h3>
          <div className="flex gap-2">
            {['All', 'Active', 'Acknowledged', 'Resolved'].map(f => (
              <button 
                key={f}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${filter === f ? 'bg-gray-700 text-white shadow' : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'}`}
                onClick={() => setFilter(f as any)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden !p-0 border border-gray-800 bg-gray-900">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-950 text-gray-400 uppercase text-xs border-b border-gray-800 tracking-wider">
              <tr>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Service</th>
                <th className="px-6 py-4">Message</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <CheckCircle className="mx-auto mb-2 opacity-50" size={32} />
                    No alerts found for the current filter.
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert: any, i: number) => (
                  <tr key={alert.id || i} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-gray-400 whitespace-nowrap font-mono text-xs">
                      {alert.timestamp === 'now' ? 'Just now' : alert.timestamp}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold ${
                        alert.severity === 'Critical' ? 'bg-red-500/20 text-red-400' : 
                        alert.severity === 'Warning' ? 'bg-yellow-500/20 text-yellow-400' : 
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        <AlertTriangle size={12} /> {alert.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-blue-400 font-medium">
                      <Link to={`/services/${alert.service}`} className="hover:underline flex items-center gap-1">
                        <Server size={14}/> {alert.service}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-200">{alert.reason}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                        alert.state === 'Active' ? 'border-red-500/30 text-red-400 bg-red-500/10' :
                        alert.state === 'Acknowledged' ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10' :
                        'border-green-500/30 text-green-400 bg-green-500/10'
                      }`}>
                        {alert.state}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {alert.state === 'Active' && (
                          <button 
                            onClick={() => updateState(alert.id, 'Acknowledged')}
                            className="text-xs px-3 py-1.5 rounded font-semibold bg-gray-800 hover:bg-gray-700 text-yellow-400 transition-colors border border-gray-700"
                          >
                            Ack
                          </button>
                        )}
                        {alert.state !== 'Resolved' && (
                          <button 
                            onClick={() => updateState(alert.id, 'Resolved')}
                            className="text-xs px-3 py-1.5 rounded font-semibold bg-gray-800 hover:bg-gray-700 text-green-400 transition-colors border border-gray-700"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Alerts;
