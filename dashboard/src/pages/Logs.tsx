import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Search, Pause, Play, Filter, ExternalLink, Download, X, Clock, Terminal, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLogsSearch } from '../hooks/useMetrics';

export default function Logs() {
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState(''); // debounced for API
  const [autoScroll, setAutoScroll] = useState(true);
  const [serviceFilter, setServiceFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState<string[]>(['INFO', 'WARN', 'ERROR']);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Search API (only fires if not in Live Tail, or if we have a search term)
  const { data: searchResults, isFetching } = useLogsSearch(searchInput, 500);

  useEffect(() => {
    if (!isLive) return;
    const eventSource = new EventSource('/api/logs/stream');
    
    eventSource.onmessage = (event) => {
      if (isPaused) return;
      try {
        const log = JSON.parse(event.data);
        setLiveLogs(prev => [...prev, log].slice(-1000));
      } catch (e) {}
    };

    return () => eventSource.close();
  }, [isLive, isPaused]);

  useEffect(() => {
    if (autoScroll && scrollRef.current && isLive) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [liveLogs, autoScroll, isLive]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchInput(search);
    if (search.trim().length > 0) {
      setIsLive(false);
    } else {
      setIsLive(true);
    }
  };

  const addFilter = (term: string) => {
    const newSearch = search ? `${search} ${term}` : term;
    setSearch(newSearch);
    setSearchInput(newSearch);
    setIsLive(false);
  };

  const logsToDisplay = isLive ? liveLogs : (searchResults || []);

  const filteredLogs = useMemo(() => {
    return logsToDisplay.filter((l: any) => {
      if (isLive && search) {
        if (!JSON.stringify(l).toLowerCase().includes(search.toLowerCase())) return false;
      }
      if (serviceFilter !== 'All' && l.service !== serviceFilter) return false;
      
      const status = l.status_code || l.status || 200;
      let sev = 'INFO';
      if (typeof status === 'number' && status >= 500) sev = 'ERROR';
      else if (typeof status === 'number' && status >= 400) sev = 'WARN';
      else if (status === 'error') sev = 'ERROR';
      
      return severityFilter.includes(sev);
    });
  }, [logsToDisplay, search, serviceFilter, severityFilter, isLive]);

  const uniqueServices = Array.from(new Set(logsToDisplay.map((l: any) => l.service).filter(Boolean)));

  const exportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "logs_export.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const exportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ["timestamp", "service", "endpoint", "status_code", "message"];
    const csvContent = "data:text/csv;charset=utf-8," + [
      headers.join(","),
      ...filteredLogs.map((l: any) => headers.map(h => `"${(l[h] || '').toString().replace(/"/g, '""')}"`).join(","))
    ].join("\\n");
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", encodeURI(csvContent));
    downloadAnchorNode.setAttribute("download", "logs_export.csv");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const toggleSeverity = (sev: string) => {
    setSeverityFilter(prev => prev.includes(sev) ? prev.filter(s => s !== sev) : [...prev, sev]);
  };

  return (
    <div className="page-container h-[calc(100vh-2rem)] flex flex-col relative overflow-hidden">
      <header className="page-header shrink-0">
        <h1 className="page-title">Log Explorer</h1>
        <p className="page-subtitle">Kibana-style investigation with Live Tail and Historical Search</p>
      </header>

      <div className="card flex-1 flex flex-col overflow-hidden p-0 bg-gray-950 border border-gray-800 relative z-0">
        
        {/* Toolbar */}
        <div className="flex p-3 border-b border-gray-800 gap-4 items-center bg-gray-900 flex-wrap">
          
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[300px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder='Search logs (e.g. "error", trace_id: "123")...' 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded py-1.5 pl-9 pr-3 text-white focus:outline-none focus:border-blue-500 text-sm"
            />
          </form>

          <div className="flex items-center gap-2">
            <button 
              className={`btn text-xs py-1 px-3 flex items-center gap-2 ${isLive ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
              onClick={() => { setIsLive(true); setSearch(''); setSearchInput(''); }}
            >
              <Terminal size={14} /> Live Tail
            </button>
            <button 
              className={`btn text-xs py-1 px-3 flex items-center gap-2 ${!isLive ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
              onClick={() => { setIsLive(false); handleSearchSubmit({ preventDefault: () => {} } as any); }}
            >
              <Clock size={14} /> Historical
            </button>
          </div>
          
          <div className="w-px h-6 bg-gray-700"></div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400"/>
            <select 
              className="bg-gray-800 border border-gray-700 rounded py-1 px-2 text-white text-xs outline-none max-w-[150px] truncate"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
            >
              <option value="All">All Services</option>
              {uniqueServices.map((s: any) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex bg-gray-800 rounded border border-gray-700 overflow-hidden text-xs">
            {['INFO', 'WARN', 'ERROR'].map(sev => (
              <button 
                key={sev}
                onClick={() => toggleSeverity(sev)}
                className={`px-3 py-1 font-semibold ${severityFilter.includes(sev) ? (sev==='ERROR'?'bg-red-500/20 text-red-400':sev==='WARN'?'bg-yellow-500/20 text-yellow-400':'bg-blue-500/20 text-blue-400') : 'text-gray-500 hover:bg-gray-700'}`}
              >
                {sev}
              </button>
            ))}
          </div>

          {isLive && (
            <>
              <div className="w-px h-6 bg-gray-700"></div>
              <button 
                className={`btn text-xs py-1 px-3 flex items-center gap-2 ${isPaused ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 hover:bg-yellow-500/30' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
                onClick={() => setIsPaused(!isPaused)}
              >
                {isPaused ? <Play size={14} /> : <Pause size={14} />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            </>
          )}

          <div className="w-px h-6 bg-gray-700"></div>

          <div className="flex gap-2">
            <button onClick={exportCSV} className="btn outline text-xs py-1 px-2 flex items-center gap-1 text-gray-300 hover:text-white" title="Export CSV">
              <Download size={14} />
            </button>
            <button onClick={exportJSON} className="btn outline text-xs py-1 px-2 flex items-center gap-1 text-gray-300 hover:text-white" title="Export JSON">
              <Download size={14} />
            </button>
          </div>
        </div>

        {/* Log Viewer */}
        <div className="flex-1 flex overflow-hidden">
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto font-mono text-xs bg-[#0d1117] relative"
            onScroll={(e) => {
              if (!isLive) return;
              const target = e.target as HTMLDivElement;
              const isAtBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 50;
              setAutoScroll(isAtBottom);
            }}
          >
            {/* Table Header */}
            <div className="sticky top-0 bg-gray-900/90 backdrop-blur border-b border-gray-800 z-10 flex py-2 px-4 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
              <div className="w-40 shrink-0">Timestamp</div>
              <div className="w-16 shrink-0">Level</div>
              <div className="w-32 shrink-0">Service</div>
              <div className="flex-1 min-w-[200px]">Message</div>
            </div>

            {isFetching && !isLive ? (
              <div className="p-8 text-center text-gray-500 italic">Searching logs...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 italic">No logs match the current filters...</div>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {filteredLogs.map((log: any, idx: number) => {
                  const status = log.status_code || log.status || 200;
                  let sev = 'INFO';
                  if (typeof status === 'number' && status >= 500) sev = 'ERROR';
                  else if (typeof status === 'number' && status >= 400) sev = 'WARN';
                  else if (status === 'error') sev = 'ERROR';

                  let sevColor = 'text-blue-400';
                  if (sev === 'ERROR') sevColor = 'text-red-400';
                  if (sev === 'WARN') sevColor = 'text-yellow-400';

                  const isSelected = selectedLog?.trace_id === log.trace_id && selectedLog?.timestamp === log.timestamp;

                  return (
                    <div 
                      key={idx} 
                      className={`flex py-1.5 px-4 cursor-pointer hover:bg-gray-800/50 transition-colors group ${isSelected ? 'bg-gray-800/50 border-l-2 border-blue-500 pl-[14px]' : 'border-l-2 border-transparent'}`}
                      onClick={() => setSelectedLog(isSelected ? null : log)}
                    >
                      <div className="w-40 shrink-0 text-gray-500 group-hover:text-gray-400 transition-colors">
                        {new Date(log.timestamp).toISOString().replace('T', ' ').replace('Z', '')}
                      </div>
                      <div className={`w-16 shrink-0 font-bold ${sevColor}`}>
                        {sev}
                      </div>
                      <div className="w-32 shrink-0 text-gray-300 truncate pr-2">
                        {log.service}
                      </div>
                      <div className="flex-1 min-w-[200px] text-gray-300 truncate">
                        {log.message || log.event || JSON.stringify(log.request_payload)}
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity float-right text-gray-500 flex items-center gap-1">
                          <ChevronRight size={12}/> View Details
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {isLive && !autoScroll && (
              <div className="sticky bottom-4 w-full flex justify-center pointer-events-none">
                <button 
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-xs font-semibold shadow-lg pointer-events-auto transition-transform flex items-center gap-2"
                  onClick={() => setAutoScroll(true)}
                >
                  Resume Auto-Scroll
                </button>
              </div>
            )}
          </div>

          {/* Right Sidebar - Log Details Drawer */}
          {selectedLog && (
            <div className="w-[450px] shrink-0 border-l border-gray-800 bg-gray-950 shadow-2xl flex flex-col animate-in slide-in-from-right-8 z-20 h-full">
              <div className="p-3 border-b border-gray-800 bg-gray-900 flex items-center justify-between sticky top-0 z-10">
                <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                  <Terminal size={16}/> Log Details
                </h3>
                <button onClick={() => setSelectedLog(null)} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-6">
                
                {/* Actions */}
                <div className="flex gap-2 text-xs">
                  {selectedLog.trace_id && (
                    <button 
                      onClick={() => navigate(`/tracing?traceId=${selectedLog.trace_id}`)}
                      className="btn primary py-1 px-3 flex items-center gap-2"
                    >
                      <ExternalLink size={12}/> View Trace
                    </button>
                  )}
                  <button className="btn outline py-1 px-3" onClick={() => addFilter(selectedLog.service)}>
                    Filter by Service
                  </button>
                </div>

                {/* Properties */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 border-b border-gray-800 pb-1">Properties</h4>
                  <table className="w-full text-sm text-left font-mono">
                    <tbody className="divide-y divide-gray-800">
                      <tr>
                        <td className="py-2 text-gray-500 w-1/3">@timestamp</td>
                        <td className="py-2 text-gray-300">{new Date(selectedLog.timestamp).toISOString()}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-gray-500">service.name</td>
                        <td className="py-2 text-gray-300 cursor-pointer hover:text-blue-400 hover:underline" onClick={() => addFilter(selectedLog.service)}>{selectedLog.service}</td>
                      </tr>
                      {selectedLog.trace_id && (
                        <tr>
                          <td className="py-2 text-gray-500">trace.id</td>
                          <td className="py-2 text-blue-400 cursor-pointer hover:underline" onClick={() => addFilter(selectedLog.trace_id)}>{selectedLog.trace_id}</td>
                        </tr>
                      )}
                      {selectedLog.span_id && (
                        <tr>
                          <td className="py-2 text-gray-500">span.id</td>
                          <td className="py-2 text-gray-300 cursor-pointer hover:text-blue-400 hover:underline" onClick={() => addFilter(selectedLog.span_id)}>{selectedLog.span_id}</td>
                        </tr>
                      )}
                      {selectedLog.correlation_id && (
                        <tr>
                          <td className="py-2 text-gray-500">correlation.id</td>
                          <td className="py-2 text-gray-300 cursor-pointer hover:text-blue-400 hover:underline" onClick={() => addFilter(selectedLog.correlation_id)}>{selectedLog.correlation_id}</td>
                        </tr>
                      )}
                      {selectedLog.request_id && (
                        <tr>
                          <td className="py-2 text-gray-500">request.id</td>
                          <td className="py-2 text-gray-300 cursor-pointer hover:text-blue-400 hover:underline" onClick={() => addFilter(selectedLog.request_id)}>{selectedLog.request_id}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* HTTP / Routing */}
                {(selectedLog.method || selectedLog.endpoint || selectedLog.status_code) && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 border-b border-gray-800 pb-1">HTTP Details</h4>
                    <table className="w-full text-sm text-left font-mono">
                      <tbody className="divide-y divide-gray-800">
                        {selectedLog.method && (
                          <tr>
                            <td className="py-2 text-gray-500 w-1/3">http.method</td>
                            <td className="py-2 text-blue-400">{selectedLog.method}</td>
                          </tr>
                        )}
                        {selectedLog.endpoint && (
                          <tr>
                            <td className="py-2 text-gray-500">http.url</td>
                            <td className="py-2 text-gray-300 break-all">{selectedLog.endpoint}</td>
                          </tr>
                        )}
                        {selectedLog.status_code && (
                          <tr>
                            <td className="py-2 text-gray-500">http.status_code</td>
                            <td className={`py-2 ${selectedLog.status_code >= 500 ? 'text-red-400' : selectedLog.status_code >= 400 ? 'text-yellow-400' : 'text-green-400'}`}>
                              {selectedLog.status_code}
                            </td>
                          </tr>
                        )}
                        {selectedLog.response_time_ms !== undefined && (
                          <tr>
                            <td className="py-2 text-gray-500">event.duration</td>
                            <td className="py-2 text-gray-300">{selectedLog.response_time_ms}ms</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Payload JSON */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 border-b border-gray-800 pb-1">Raw JSON</h4>
                  <pre className="bg-[#0d1117] p-3 rounded border border-gray-800 overflow-x-auto text-green-300 font-mono text-[11px] whitespace-pre-wrap">
                    {JSON.stringify(selectedLog, null, 2)}
                  </pre>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
