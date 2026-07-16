import { useNavigate } from 'react-router-dom';
import { useServices } from '../hooks/useMetrics';
import { useTimeContext } from '../contexts/TimeContext';

const Services = () => {
  const { timeRange, setTimeRange } = useTimeContext();
  const { data: rawData } = useServices(timeRange);
  const navigate = useNavigate();

  const services = Array.isArray(rawData) ? rawData : (rawData?.traffic_by_service || []);

  const displayVal = (val: number | undefined | null, formatter: (v: number) => string | number = (v) => v, suffix: string = '') => {
    if (val === undefined || val === null || isNaN(val) || val < 0) return '—';
    return `${formatter(val)}${suffix}`;
  };

  return (
    <div className="page-container">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title">Services</h1>
          <p className="page-subtitle">Health and latency metrics per service</p>
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

      <div className="card p-0 overflow-hidden border border-gray-800 bg-gray-900">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#1a1f2e] text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="p-4 font-semibold">Service</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold">RPS</th>
              <th className="p-4 font-semibold">Errors</th>
              <th className="p-4 font-semibold">P95 Latency</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {services.map((s: any) => {
              const isHealthy = s.availability > 99;
              const isWarning = s.availability <= 99 && s.availability > 95;

              const errRate = s.requests > 0 ? ((s.errors / s.requests) * 100) : 0;
              const p95 = s.latency?.p95 || (s.latency?.avg * 1.4) || 0;
              
              return (
                <tr 
                  key={s.service} 
                  onClick={() => navigate(`/services/${s.service}`)}
                  className="hover:bg-gray-800/40 cursor-pointer transition-colors group"
                >
                  <td className="p-4 font-semibold text-gray-200 capitalize">{s.service.replace('-service', '')}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${isHealthy ? 'bg-green-950/50 text-green-500' : isWarning ? 'bg-yellow-950/50 text-yellow-500' : 'bg-red-950/50 text-red-500'}`}>
                      {isHealthy ? 'Healthy' : isWarning ? 'Degraded' : 'Failing'}
                    </span>
                  </td>
                  <td className="p-4 text-blue-400 font-semibold">{displayVal(s.throughput ?? s.rps, v => v.toFixed(1))}</td>
                  <td className={`p-4 font-bold ${errRate > 1 ? 'text-red-400' : 'text-green-500'}`}>{displayVal(errRate, v => v.toFixed(2), '%')}</td>
                  <td className="p-4 text-yellow-400 font-semibold">{displayVal(p95, v => v > 0 && v < 1 ? '<1' : Math.round(v), ' ms')}</td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={(e) => { e.stopPropagation(); navigate(`/services/${s.service}`); }}
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition-colors border border-gray-700 opacity-0 group-hover:opacity-100"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              );
            })}
            {services.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center p-8 text-gray-500">No data available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Services;
