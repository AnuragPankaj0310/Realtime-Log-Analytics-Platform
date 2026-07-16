import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRecentTraces, useTrace } from '../hooks/useMetrics';
import { Search, Clock, Server, Info, X, Activity, CornerDownRight, FileText } from 'lucide-react';
export default function Tracing() {
  const [traceId, setTraceId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedSpan, setSelectedSpan] = useState<any | null>(null);
  const [drawerTab, setDrawerTab] = useState<'details' | 'logs'>('details');
  const [spanLogs, setSpanLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [collapsedSpans, setCollapsedSpans] = useState<Set<string>>(new Set());
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: recentTracesRaw, isLoading: isLoadingRecent } = useRecentTraces();
  const recentTraces = recentTracesRaw || [];

  // Sync URL query param to state
  useEffect(() => {
    const urlTraceId = searchParams.get('traceId');
    if (urlTraceId && urlTraceId !== traceId) {
      setTraceId(urlTraceId);
      setSearchInput(urlTraceId);
    }
  }, [searchParams, traceId]);

  const { data: traceData, isLoading: isLoadingTrace, isError, isFetching } = useTrace(traceId);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchParams({ traceId: searchInput.trim() });
    }
  };

  const selectTrace = (id: string) => {
    setSearchParams({ traceId: id });
    setSelectedSpan(null);
  };

  useEffect(() => {
    if (selectedSpan && drawerTab === 'logs') {
      setIsLoadingLogs(true);
      fetch(`/api/logs/${selectedSpan.trace_id}`)
        .then(res => res.json())
        .then(data => {
          // filter by span_id, fallback to all trace logs if no span_id match (or just show all for context)
          const matched = data.filter((l: any) => l.span_id === selectedSpan.span_id);
          setSpanLogs(matched.length > 0 ? matched : data);
          setIsLoadingLogs(false);
        })
        .catch(() => setIsLoadingLogs(false));
    }
  }, [selectedSpan, drawerTab]);

  const processedTrace = useMemo(() => {
    if (!traceData || !traceData.flat_spans || traceData.flat_spans.length === 0) return null;
    
    // Compute start and end times based on the single timestamp and duration available
    const enrichedSpans = traceData.flat_spans.map((s: any) => {
      const endTime = new Date(s.start_time).getTime(); // backend provides start_time which is actually end time in these logs
      const duration = s.duration || 0;
      return { ...s, endTime, startTime: endTime - duration, duration };
    });
    
    // Sort spans by start time
    enrichedSpans.sort((a: any, b: any) => a.startTime - b.startTime);

    let traceStartTime = Math.min(...enrichedSpans.map((s: any) => s.startTime));
    let traceEndTime = Math.max(...enrichedSpans.map((s: any) => s.endTime));
    let traceDuration = Math.max(traceEndTime - traceStartTime, 1);
    
    let servicesInvolved = new Set<string>();
    let totalErrors = 0;
    
    enrichedSpans.forEach((s: any) => {
      servicesInvolved.add(s.service);
      if (s.status_code >= 400 || s.status === 'error') totalErrors++;
    });

    const spanDepths: Record<string, number> = {};
    const spanChildren: Record<string, string[]> = {};
    
    enrichedSpans.forEach((s: any) => {
      spanChildren[s.span_id] = enrichedSpans.filter((child: any) => child.parent_span_id === s.span_id).map((c: any) => c.span_id);
    });

    const rootSpans = enrichedSpans.filter((s: any) => !s.parent_span_id || !spanChildren[s.parent_span_id]);
    
    const computeDepth = (spanId: string, depth: number) => {
      spanDepths[spanId] = depth;
      (spanChildren[spanId] || []).forEach(childId => computeDepth(childId, depth + 1));
    };
    rootSpans.forEach((root: any) => computeDepth(root.span_id, 0));

    const criticalPathSpans = new Set<string>();
    const computeCriticalPath = (spanId: string) => {
      criticalPathSpans.add(spanId);
      const children = spanChildren[spanId] || [];
      if (children.length > 0) {
        let maxChild = children[0];
        let maxDur = enrichedSpans.find((s: any) => s.span_id === maxChild)?.duration || 0;
        for (const childId of children) {
          const dur = enrichedSpans.find((s: any) => s.span_id === childId)?.duration || 0;
          if (dur > maxDur) {
            maxDur = dur;
            maxChild = childId;
          }
        }
        computeCriticalPath(maxChild);
      }
    };
    rootSpans.forEach((root: any) => computeCriticalPath(root.span_id));

    return {
      spans: enrichedSpans,
      traceStartTime,
      traceEndTime,
      traceDuration,
      servicesInvolved,
      totalErrors,
      spanDepths,
      spanChildren,
      criticalPathSpans
    };
  }, [traceData]);

  const toggleCollapse = (e: React.MouseEvent, spanId: string) => {
    e.stopPropagation();
    setCollapsedSpans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(spanId)) newSet.delete(spanId);
      else newSet.add(spanId);
      return newSet;
    });
  };

  let visibleSpans = processedTrace?.spans || [];
  if (processedTrace) {
    if (showCriticalPath) {
      visibleSpans = processedTrace.spans.filter((s: any) => processedTrace.criticalPathSpans.has(s.span_id));
    } else {
      const hiddenSpans = new Set<string>();
      const hideChildren = (spanId: string) => {
        const children = processedTrace.spanChildren[spanId] || [];
        children.forEach(cId => {
          hiddenSpans.add(cId);
          hideChildren(cId);
        });
      };
      collapsedSpans.forEach(spanId => hideChildren(spanId));
      visibleSpans = processedTrace.spans.filter((s: any) => !hiddenSpans.has(s.span_id));
    }
  }

  return (
    <div className="page-container h-[calc(100vh-2rem)] flex flex-col">
      <header className="page-header shrink-0">
        <h1 className="page-title">Trace Explorer</h1>
        <p className="page-subtitle">Inspect end-to-end request lifecycles with Jaeger-style waterfall</p>
      </header>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left Sidebar - Recent Traces */}
        <div className="w-[300px] card flex flex-col p-0 overflow-hidden shrink-0 border border-gray-800 bg-gray-950">
          <div className="p-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center">
            <h3 className="font-semibold text-gray-200 flex items-center gap-2"><Clock size={16}/> Recent</h3>
            {isLoadingRecent && <span className="text-xs text-gray-500 animate-pulse">Updating...</span>}
          </div>
          <div className="overflow-y-auto flex-1">
            {recentTraces.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">Waiting for traces...</div>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {recentTraces.map((trace: any, i: number) => (
                  <button 
                    key={i} 
                    onClick={() => selectTrace(trace.trace_id)}
                    className={`w-full text-left p-3 hover:bg-gray-800/50 transition-colors ${traceId === trace.trace_id ? 'bg-gray-800/80 border-l-2 border-blue-500' : 'border-l-2 border-transparent'}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-mono text-blue-400 truncate w-2/3">{trace.trace_id?.split('-')[0]}...</span>
                      <span className="text-xs text-gray-500">{new Date(trace.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                    <div className="text-xs flex items-center justify-between">
                      <div className={`flex items-center gap-1 ${trace.status === 'error' ? 'text-red-400' : 'text-gray-400'}`}>
                        <Server size={12}/> {trace.service}
                      </div>
                      <div className="text-gray-500">{trace.duration ? `${trace.duration}ms` : ''}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Middle Content - Trace Waterfall */}
        <div className="flex-1 card flex flex-col p-0 overflow-hidden border border-gray-800 bg-gray-950">
          <div className="shrink-0 p-4 border-b border-gray-800 bg-gray-900">
            <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Enter specific Trace ID..." 
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded py-2 pl-9 pr-3 text-white focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <button type="submit" className="btn primary py-1 px-4 text-sm" disabled={isLoadingTrace || isFetching}>
                {isLoadingTrace || isFetching ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!traceId ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                <Activity size={48} className="text-gray-700 opacity-50" />
                <p>Select a trace from the left or search by ID to view timeline</p>
              </div>
            ) : isLoadingTrace || isFetching ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                Loading trace...
              </div>
            ) : isError ? (
              <div className="h-full flex items-center justify-center text-red-500 px-8 text-center">
                Failed to load trace "{traceId}".
              </div>
            ) : !processedTrace ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-center px-8">
                No spans found for trace "{traceId}". Ensure it is correct and indexed.
              </div>
            ) : (
              <div className="flex flex-col h-full min-w-max">
                {/* Trace Summary Header */}
                <div className="mb-6 p-4 rounded bg-gray-900/50 border border-gray-800 flex flex-wrap gap-x-8 gap-y-4 text-sm sticky left-0">
                  <div>
                    <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Trace ID</div>
                    <div className="font-mono text-gray-300">{traceId}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Duration</div>
                    <div className="font-mono text-gray-300">{processedTrace.traceDuration} ms</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Spans</div>
                    <div className="font-mono text-gray-300">{processedTrace.spans.length}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Services</div>
                    <div className="font-mono text-gray-300">{processedTrace.servicesInvolved.size}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Status</div>
                    <div className={`font-mono ${processedTrace.totalErrors > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {processedTrace.totalErrors > 0 ? `${processedTrace.totalErrors} Errors` : 'OK'}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white transition-colors">
                      <input 
                        type="checkbox" 
                        className="rounded bg-gray-900 border-gray-700"
                        checked={showCriticalPath}
                        onChange={(e) => setShowCriticalPath(e.target.checked)}
                      />
                      Show Critical Path
                    </label>
                  </div>
                </div>

                {/* Timeline Axis (simplified) */}
                <div className="relative h-6 mb-2 text-xs text-gray-500 border-b border-gray-800 flex sticky top-0 bg-gray-950 z-20">
                  <div className="w-[30%] min-w-[250px] shrink-0 pr-4">Service & Operation</div>
                  <div className="flex-1 min-w-[400px] relative">
                    <span className="absolute left-0">0ms</span>
                    <span className="absolute right-0">{processedTrace.traceDuration}ms</span>
                  </div>
                </div>

                {/* Spans */}
                <div className="space-y-1 pb-10">
                  {visibleSpans.map((span: any, idx: number) => {
                    const depth = processedTrace.spanDepths[span.span_id] || 0;
                    const offsetPct = Math.max(0, ((span.startTime - processedTrace.traceStartTime) / processedTrace.traceDuration) * 100);
                    const widthPct = Math.max(0.5, (span.duration / processedTrace.traceDuration) * 100);
                    const isError = span.status_code >= 400 || span.status === 'error';
                    const isSelected = selectedSpan?.span_id === span.span_id;

                    return (
                      <div 
                        key={idx} 
                        onClick={() => setSelectedSpan(span)}
                        className={`flex group cursor-pointer text-sm rounded transition-colors ${isSelected ? 'bg-blue-900/20 ring-1 ring-blue-500/50' : 'hover:bg-gray-800/40'}`}
                      >
                        {/* Service & Operation Column */}
                        <div className="w-[30%] min-w-[250px] shrink-0 py-1.5 pr-4 pl-2 flex items-center border-r border-gray-800/50 overflow-hidden">
                          <div style={{ marginLeft: `${depth * 12}px` }} className="flex items-center gap-2 min-w-0 truncate">
                            {processedTrace.spanChildren[span.span_id]?.length > 0 && !showCriticalPath ? (
                              <button 
                                onClick={(e) => toggleCollapse(e, span.span_id)}
                                className="w-4 h-4 flex items-center justify-center bg-gray-800 rounded hover:bg-gray-700 text-gray-400 shrink-0"
                              >
                                {collapsedSpans.has(span.span_id) ? '+' : '-'}
                              </button>
                            ) : (
                              <div className="w-4 h-4 shrink-0"></div>
                            )}
                            {depth > 0 && <CornerDownRight size={12} className="text-gray-600 shrink-0" />}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${isError ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'}`}>
                              {span.service}
                            </span>
                            <span className={`truncate font-medium ${isError ? 'text-red-300' : 'text-gray-300'}`}>
                              {span.operation || span.event || 'span'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Waterfall Graph Column */}
                        <div className="flex-1 min-w-[400px] relative py-1.5 px-2 flex items-center group-hover:bg-gray-800/20">
                          {/* Guide line on hover */}
                          <div className="absolute inset-y-0 w-px bg-gray-700/0 group-hover:bg-gray-700/50 z-0" style={{ left: `calc(${offsetPct}% + 0.5rem)` }}></div>
                          
                          <div 
                            className={`h-4 rounded relative z-10 flex items-center ${isError ? 'bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'bg-blue-500/80 shadow-[0_0_8px_rgba(59,130,246,0.3)]'}`}
                            style={{ 
                              marginLeft: `${offsetPct}%`, 
                              width: `${widthPct}%`,
                              minWidth: '2px'
                            }}
                          >
                            {/* Duration label floats next to bar if there's room */}
                            {widthPct > 10 && (
                              <span className="px-1 text-[10px] text-white/90 font-medium whitespace-nowrap">{span.duration}ms</span>
                            )}
                          </div>
                          {widthPct <= 10 && (
                            <span className="ml-1 text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity absolute whitespace-nowrap" style={{ left: `calc(${offsetPct}% + ${widthPct}% + 0.5rem)`}}>
                              {span.duration}ms
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Span Details Drawer */}
        {selectedSpan && (
          <div className="w-[350px] card flex flex-col p-0 overflow-hidden shrink-0 border border-gray-800 bg-gray-950 shadow-2xl animate-in slide-in-from-right-8">
            <div className="p-3 border-b border-gray-800 bg-gray-900 flex items-center justify-between">
              <div className="flex gap-4">
                <button 
                  onClick={() => setDrawerTab('details')}
                  className={`font-semibold flex items-center gap-2 pb-1 border-b-2 transition-colors ${drawerTab === 'details' ? 'border-blue-500 text-gray-200' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                  <Info size={16}/> Details
                </button>
                <button 
                  onClick={() => setDrawerTab('logs')}
                  className={`font-semibold flex items-center gap-2 pb-1 border-b-2 transition-colors ${drawerTab === 'logs' ? 'border-blue-500 text-gray-200' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                  <FileText size={16}/> Logs
                </button>
              </div>
              <button onClick={() => setSelectedSpan(null)} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors mb-1">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-6">
              
              {drawerTab === 'details' ? (
                <>
                  {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${selectedSpan.status_code >= 400 || selectedSpan.status === 'error' ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'}`}>
                    {selectedSpan.service}
                  </span>
                  <span className="text-lg font-semibold text-gray-200">{selectedSpan.operation || selectedSpan.event}</span>
                </div>
                <div className="flex gap-2 text-sm">
                  <span className="text-gray-400">Duration:</span>
                  <span className="text-gray-200 font-mono">{selectedSpan.duration}ms</span>
                </div>
                <div className="flex gap-2 text-sm">
                  <span className="text-gray-400">Timestamp:</span>
                  <span className="text-gray-200 font-mono">{new Date(selectedSpan.start_time).toISOString()}</span>
                </div>
              </div>

              {/* Identifiers */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 border-b border-gray-800 pb-1">Identifiers</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-gray-400 shrink-0">Trace ID:</span>
                    <span className="text-gray-300 font-mono truncate" title={selectedSpan.trace_id}>{selectedSpan.trace_id}</span>
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-gray-400 shrink-0">Span ID:</span>
                    <span className="text-gray-300 font-mono truncate" title={selectedSpan.span_id}>{selectedSpan.span_id}</span>
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-gray-400 shrink-0">Parent ID:</span>
                    <span className="text-gray-300 font-mono truncate" title={selectedSpan.parent_span_id || '-'}>{selectedSpan.parent_span_id || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-gray-400 shrink-0">Correlation ID:</span>
                    <span className="text-gray-300 font-mono truncate" title={selectedSpan.correlation_id || '-'}>{selectedSpan.correlation_id || '-'}</span>
                  </div>
                </div>
              </div>

              {/* HTTP Info */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 border-b border-gray-800 pb-1">HTTP Details</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400 shrink-0">Method:</span>
                    <span className="text-blue-400 font-mono">{selectedSpan.method || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400 shrink-0">Endpoint:</span>
                    <span className="text-gray-300 font-mono break-all">{selectedSpan.endpoint || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400 shrink-0">Status Code:</span>
                    <span className={`font-mono ${selectedSpan.status_code >= 500 ? 'text-red-400' : selectedSpan.status_code >= 400 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {selectedSpan.status_code || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400 shrink-0">IP Address:</span>
                    <span className="text-gray-300 font-mono">{selectedSpan.ip_address || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Application Context */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 border-b border-gray-800 pb-1">Application Context</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400 shrink-0">Message:</span>
                    <span className="text-gray-300 break-words flex-1 text-right">{selectedSpan.message || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Payloads */}
              {selectedSpan.request_payload && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 border-b border-gray-800 pb-1">Request Payload</h4>
                  <pre className="bg-gray-950 p-2 rounded text-xs overflow-x-auto border border-gray-800 text-blue-300 font-mono whitespace-pre-wrap">
                    {selectedSpan.request_payload}
                  </pre>
                </div>
              )}
              {selectedSpan.response_payload && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 border-b border-gray-800 pb-1">Response Payload</h4>
                  <pre className="bg-gray-950 p-2 rounded text-xs overflow-x-auto border border-gray-800 text-green-300 font-mono whitespace-pre-wrap">
                    {selectedSpan.response_payload}
                  </pre>
                </div>
              )}
              </>
              ) : (
                <div className="space-y-4">
                  <div className="text-xs text-gray-500 mb-2">Logs correlated to this span</div>
                  {isLoadingLogs ? (
                    <div className="text-gray-400 text-sm animate-pulse">Fetching correlated logs...</div>
                  ) : spanLogs.length === 0 ? (
                    <div className="text-gray-500 text-sm italic">No logs found for this span.</div>
                  ) : (
                    <div className="space-y-3">
                      {spanLogs.map((log, i) => (
                        <div key={i} className="bg-gray-900 border border-gray-800 rounded p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] text-gray-500 font-mono">{new Date(log.timestamp).toISOString()}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${log.severity === 'ERROR' ? 'bg-red-900/30 text-red-400' : log.severity === 'WARN' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-blue-900/30 text-blue-400'}`}>
                              {log.severity}
                            </span>
                          </div>
                          <div className="text-xs text-gray-300 font-mono break-all whitespace-pre-wrap">
                            {log.message || JSON.stringify(log.payload)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
