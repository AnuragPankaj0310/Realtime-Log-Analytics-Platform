import { useState, useMemo } from 'react';
import { ReactFlow, Background, type Node, MarkerType, getBezierPath, BaseEdge, EdgeLabelRenderer } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSystemOverview } from '../hooks/useMetrics';

// Custom edge for packet animations
const PacketEdge = ({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, data }: any) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetPosition, targetX, targetY,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {data?.animated && (
        <circle r="4" fill={style.stroke || '#fff'}>
          <animateMotion dur={`${Math.max(1, 3 - (data.throughput || 0) / 100)}s`} repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: 'rgba(0,0,0,0.8)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: 10,
              fontWeight: 'bold',
              color: style.stroke || '#fff',
              pointerEvents: 'all',
              border: `1px solid ${style.stroke || '#555'}`,
            }}
            className="nodrag nopan"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const edgeTypes = {
  packet: PacketEdge,
};

const Architecture = () => {
  const [animatedEdges, setAnimatedEdges] = useState(true);
  const { data: overviewData } = useSystemOverview();
  
  const throughput = overviewData?.throughput ?? overviewData?.metrics?.throughput ?? 0;
  const errorRate = (overviewData?.errors ?? overviewData?.metrics?.errors ?? 0) * 100;

  const nodes: Node[] = useMemo(() => [
    { id: 'clients', position: { x: 50, y: 300 }, data: { label: 'Web Clients & k6\nLoad Generator' }, style: { background: '#2f81f7', color: '#fff', border: 'none', borderRadius: '12px', padding: '16px', width: 200, fontSize: '14px', fontWeight: 'bold', textAlign: 'center' as const, boxShadow: '0 8px 15px rgba(0,0,0,0.4)' } },
    { id: 'gateway', position: { x: 350, y: 300 }, data: { label: 'Nginx API Gateway\nLoad Balancer' }, style: { background: '#1f2937', color: '#fff', border: '1px solid #4b5563', borderRadius: '12px', padding: '16px', width: 200, fontSize: '14px', fontWeight: 'bold', textAlign: 'center' as const, boxShadow: '0 8px 15px rgba(0,0,0,0.4)' } },
    { id: 'services', position: { x: 700, y: 300 }, data: { label: 'Microservices Fleet\n(User, Order, Payment)' }, style: { background: '#10b981', color: '#fff', border: 'none', borderRadius: '12px', padding: '16px', width: 220, fontSize: '14px', fontWeight: 'bold', textAlign: 'center' as const, boxShadow: animatedEdges ? '0 0 30px rgba(16,185,129,0.5)' : '0 0 15px rgba(16,185,129,0.3)' } },
    { id: 'kafka', position: { x: 700, y: 550 }, data: { label: 'Apache Kafka\nMessage Broker' }, style: { background: '#000', color: '#fff', border: '1px solid #4b5563', borderRadius: '12px', padding: '16px', width: 200, fontSize: '14px', fontWeight: 'bold', textAlign: 'center' as const, boxShadow: '0 8px 15px rgba(0,0,0,0.4)' } },
    { id: 'spark', position: { x: 1100, y: 550 }, data: { label: 'Spark Structured\nStreaming Jobs' }, style: { background: '#f97316', color: '#fff', border: 'none', borderRadius: '12px', padding: '16px', width: 200, fontSize: '14px', fontWeight: 'bold', textAlign: 'center' as const, boxShadow: animatedEdges ? '0 0 30px rgba(249,115,22,0.5)' : '0 0 15px rgba(249,115,22,0.3)' } },
    { id: 'elastic', position: { x: 1450, y: 400 }, data: { label: 'Elasticsearch\nLog Indexing' }, style: { background: '#1f2937', color: '#fff', border: '1px solid #4b5563', borderRadius: '12px', padding: '16px', width: 200, fontSize: '14px', fontWeight: 'bold', textAlign: 'center' as const, boxShadow: '0 8px 15px rgba(0,0,0,0.4)' } },
    { id: 'redis', position: { x: 1450, y: 700 }, data: { label: 'Redis Cache\nState & Alerts' }, style: { background: '#ef4444', color: '#fff', border: 'none', borderRadius: '12px', padding: '16px', width: 200, fontSize: '14px', fontWeight: 'bold', textAlign: 'center' as const, boxShadow: animatedEdges ? '0 0 30px rgba(239,68,68,0.5)' : '0 0 15px rgba(239,68,68,0.3)' } },
    { id: 'api', position: { x: 1800, y: 550 }, data: { label: 'Analytics API\nBackend' }, style: { background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '12px', padding: '16px', width: 200, fontSize: '14px', fontWeight: 'bold', textAlign: 'center' as const, boxShadow: animatedEdges ? '0 0 30px rgba(139,92,246,0.5)' : '0 0 15px rgba(139,92,246,0.3)' } },
    { id: 'dashboard', position: { x: 1800, y: 250 }, data: { label: 'React Dashboard\nObservability UI' }, style: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '12px', padding: '16px', width: 220, fontSize: '14px', fontWeight: 'bold', textAlign: 'center' as const, boxShadow: animatedEdges ? '0 0 30px rgba(59,130,246,0.5)' : '0 0 15px rgba(59,130,246,0.3)' } },
  ], [animatedEdges]);

  const getEdgeStyle = (color: string) => ({
    stroke: color,
    strokeWidth: 2,
    filter: animatedEdges ? `drop-shadow(0 0 8px ${color})` : 'none',
  });
  
  const markerEnd = { type: MarkerType.ArrowClosed, color: '#9ca3af' };

  const edges = useMemo(() => [
    { id: 'e1', type: 'packet', source: 'clients', target: 'gateway', data: { animated: animatedEdges, throughput, label: `${throughput} req/s` }, style: getEdgeStyle('#60a5fa'), markerEnd: { ...markerEnd, color: '#60a5fa' } },
    { id: 'e2', type: 'packet', source: 'gateway', target: 'services', data: { animated: animatedEdges, throughput, label: 'HTTP' }, style: getEdgeStyle('#34d399'), markerEnd: { ...markerEnd, color: '#34d399' } },
    { id: 'e3', type: 'packet', source: 'services', target: 'kafka', data: { animated: animatedEdges, throughput, label: errorRate > 5 ? `${errorRate.toFixed(1)}% errors` : 'Logs (JSON)' }, style: getEdgeStyle(errorRate > 5 ? '#ef4444' : '#9ca3af'), markerEnd: { ...markerEnd, color: errorRate > 5 ? '#ef4444' : '#9ca3af' } },
    { id: 'e4', type: 'packet', source: 'kafka', target: 'spark', data: { animated: animatedEdges, throughput, label: 'Streams' }, style: getEdgeStyle('#fb923c'), markerEnd: { ...markerEnd, color: '#fb923c' } },
    { id: 'e5', type: 'packet', source: 'spark', target: 'elastic', data: { animated: animatedEdges, throughput, label: 'Aggs' }, style: getEdgeStyle('#fca5a5'), markerEnd: { ...markerEnd, color: '#fca5a5' } },
    { id: 'e6', type: 'packet', source: 'spark', target: 'redis', data: { animated: animatedEdges, throughput, label: 'Alerts' }, style: getEdgeStyle('#fca5a5'), markerEnd: { ...markerEnd, color: '#fca5a5' } },
    { id: 'e7', type: 'packet', source: 'elastic', target: 'api', data: { animated: animatedEdges, throughput, label: 'Query' }, style: getEdgeStyle('#a78bfa'), markerEnd: { ...markerEnd, color: '#a78bfa' } },
    { id: 'e8', type: 'packet', source: 'redis', target: 'api', data: { animated: animatedEdges, throughput, label: 'State' }, style: getEdgeStyle('#a78bfa'), markerEnd: { ...markerEnd, color: '#a78bfa' } },
    { id: 'e9', type: 'packet', source: 'api', target: 'dashboard', data: { animated: animatedEdges, throughput, label: 'Polling/SSE' }, style: getEdgeStyle('#60a5fa'), markerEnd: { ...markerEnd, color: '#60a5fa' } },
    { id: 'e10', type: 'packet', source: 'gateway', target: 'dashboard', data: { animated: animatedEdges, throughput, label: 'Static' }, style: getEdgeStyle('#3b82f6'), markerEnd: { ...markerEnd, color: '#3b82f6' } },
  ], [animatedEdges, throughput, errorRate]);

  return (
    <div className="page-container h-[calc(100vh-2rem)] flex flex-col">
      <header className="page-header shrink-0">
        <h1 className="page-title">Architecture</h1>
        <p className="page-subtitle">Data flow from client requests to observability insights</p>
      </header>

      <div className="card flex-1 flex flex-col min-h-0 p-4">
        <div className="flex justify-between mb-4 shrink-0 items-center">
          <div className="flex gap-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#60a5fa] animate-pulse"></span> {throughput} Req/s</span>
            {errorRate > 0 && <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse"></span> {errorRate.toFixed(2)}% Errors</span>}
          </div>
          <button 
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${animatedEdges ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`} 
            onClick={() => setAnimatedEdges(!animatedEdges)}
          >
            {animatedEdges ? 'Pause Data Flow' : 'Animate Data Flow'}
          </button>
        </div>
        <div className="flex-1 border border-gray-800 rounded-lg overflow-hidden bg-[#0d1117]">
          <ReactFlow nodes={nodes} edges={edges} edgeTypes={edgeTypes} fitView colorMode="dark">
            <Background color="#374151" gap={16} size={1} />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
};

export default Architecture;
