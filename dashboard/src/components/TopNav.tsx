import { Search, Clock, RefreshCw, Bell } from 'lucide-react';
import { useTimeContext } from '../contexts/TimeContext';

export default function TopNav() {
  const { timeRange, setTimeRange } = useTimeContext();

  return (
    <header className="h-16 border-b border-gray-800 bg-[#0a0c10] flex items-center justify-between px-6 shrink-0 z-10 sticky top-0">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-gray-100">System Overview</h1>
        <span className="text-sm text-gray-500">Real-time health and performance across all services.</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Global Search */}
        <button 
          className="flex items-center gap-2 bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-md px-3 py-1.5 text-gray-400 text-sm w-64 transition-colors"
          onClick={() => {
            const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
            document.dispatchEvent(event);
          }}
        >
          <Search size={16} />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">⌘K</kbd>
        </button>

        {/* Global Time Range */}
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-md px-3 py-1.5 text-gray-300 text-sm">
          <Clock size={16} className="text-gray-400" />
          <select 
            className="bg-transparent border-none outline-none cursor-pointer"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
          >
            <option value="5m">Last 5 minutes</option>
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last 1 hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
          </select>
        </div>

        {/* Auto Refresh */}
        <button className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-gray-800 transition-colors" title="Manual Refresh">
          <RefreshCw size={18} />
        </button>

        {/* Live Badge */}
        <div className="flex items-center gap-2 px-3 py-1 bg-green-950/30 border border-green-900/50 rounded-full">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-xs font-semibold text-green-500 uppercase tracking-wider">Live</span>
        </div>

        {/* Notifications */}
        <button className="p-2 text-gray-400 hover:text-white relative ml-2">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0a0c10]"></span>
        </button>
      </div>
    </header>
  );
}
