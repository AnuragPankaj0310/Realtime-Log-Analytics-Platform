import { NavLink } from 'react-router-dom';
import { Activity, Server, FileText, BarChart2, AlertTriangle, Network } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="sidebar flex flex-col w-64 bg-[#161b22]/70 border-r border-white/10 backdrop-blur-md p-4 pt-6">
      <div className="font-bold text-xl mb-8 bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent px-2">
        Observability Platform
      </div>
      
      <div className="flex flex-col gap-2">
        <NavLink to="/" className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-blue-500/15 text-blue-400 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
          <Activity size={18} /> System Overview
        </NavLink>
        <NavLink to="/services" className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-blue-500/15 text-blue-400 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
          <Server size={18} /> Services
        </NavLink>
        <NavLink to="/tracing" className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-blue-500/15 text-blue-400 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
          <Network size={18} /> Trace Explorer
        </NavLink>
        <NavLink to="/logs" className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-blue-500/15 text-blue-400 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
          <FileText size={18} /> Logs
        </NavLink>
        <NavLink to="/analytics" className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-blue-500/15 text-blue-400 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
          <BarChart2 size={18} /> Analytics
        </NavLink>
        <NavLink to="/alerts" className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-blue-500/15 text-blue-400 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
          <AlertTriangle size={18} /> Alerts
        </NavLink>
        <NavLink to="/architecture" className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-blue-500/15 text-blue-400 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
          <Network size={18} /> Architecture
        </NavLink>
      </div>
      
      <div className="mt-auto pt-6 border-t border-gray-800">
        <div className="flex items-center gap-3 px-3">
          <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-blue-300 font-bold text-sm">AU</div>
          <div>
            <div className="text-sm font-medium text-gray-200">Admin User</div>
            <div className="text-xs text-gray-500">admin@example.com</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
