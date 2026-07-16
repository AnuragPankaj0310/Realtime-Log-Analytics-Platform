import { useEffect, useState, useRef } from 'react';
import { Search, Activity, FileText, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Handle Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch search results
  useEffect(() => {
    if (!query) {
      setResults([
        { title: 'Go to System Overview', type: 'nav', path: '/' },
        { title: 'Go to Services', type: 'nav', path: '/services' },
        { title: 'Go to Trace Explorer', type: 'nav', path: '/tracing' },
        { title: 'Go to Logs', type: 'nav', path: '/logs' },
        { title: 'Go to Analytics', type: 'nav', path: '/analytics' },
        { title: 'Go to Alerts', type: 'nav', path: '/alerts' },
        { title: 'Go to Architecture', type: 'nav', path: '/architecture' },
      ]);
      return;
    }

    const staticNavs = [
      { title: 'Go to System Overview', type: 'nav', path: '/' },
      { title: 'Go to Services', type: 'nav', path: '/services' },
      { title: 'Go to Trace Explorer', type: 'nav', path: '/tracing' },
      { title: 'Go to Logs', type: 'nav', path: '/logs' },
      { title: 'Go to Analytics', type: 'nav', path: '/analytics' },
      { title: 'Go to Alerts', type: 'nav', path: '/alerts' },
      { title: 'Go to Architecture', type: 'nav', path: '/architecture' },
    ].filter(n => n.title.toLowerCase().includes(query.toLowerCase()));

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults([...staticNavs, ...(data.results || [])]);
          setSelectedIndex(0);
        }
      } catch (e) {
        console.error(e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Handle navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleNavigation = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        const selected = results[selectedIndex];
        handleSelect(selected);
      }
    };
    window.addEventListener('keydown', handleNavigation);
    return () => window.removeEventListener('keydown', handleNavigation);
  }, [isOpen, results, selectedIndex]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const handleSelect = (item: any) => {
    setIsOpen(false);
    if (item.type === 'nav') {
      navigate(item.path);
    } else if (item.trace_id) {
      navigate(`/tracing?traceId=${item.trace_id}`);
    } else if (item.service) {
      navigate(`/services/${item.service}`);
    } else {
      navigate(`/logs?q=${encodeURIComponent(item.message || '')}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsOpen(false)}>
      <div 
        className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-gray-800">
          <Search size={20} className="text-gray-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-lg"
            placeholder="Search logs, traces, services... (e.g. 'payment error')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        {results.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {results.map((result, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div 
                  key={index} 
                  className={`flex items-center justify-between p-3 rounded cursor-pointer transition-colors ${isSelected ? 'bg-blue-600/20 border border-blue-500/50' : 'hover:bg-gray-800 border border-transparent'}`}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => handleSelect(result)}
                >
                  <div className="flex items-start gap-3 overflow-hidden">
                    {result.type === 'nav' ? <Activity size={16} className="mt-0.5 text-blue-400 shrink-0" /> : result.trace_id ? <Activity size={16} className="mt-0.5 text-purple-400 shrink-0" /> : <FileText size={16} className="mt-0.5 text-gray-400 shrink-0" />}
                    <div className="overflow-hidden">
                      <div className="text-sm font-medium text-gray-200 truncate">{result.title || result.message || result.trace_id}</div>
                      {!result.type && (
                        <div className="text-xs text-gray-500 mt-1 flex gap-2">
                          {result.service && <span className="text-purple-400">{result.service}</span>}
                          {result.endpoint && <span className="text-green-400">{result.endpoint}</span>}
                          {result.timestamp && <span>{new Date(result.timestamp).toLocaleString()}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 shrink-0 hidden sm:block">
                    {isSelected && '↵ to select'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {query && results.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No results found for "{query}"
          </div>
        )}

        {!query && (
          <div className="p-4 bg-gray-800/30 border-t border-gray-800 text-xs text-gray-500 flex justify-between">
            <div>Global search powered by Elasticsearch</div>
            <div className="flex gap-4">
              <span><kbd className="bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">↑</kbd> <kbd className="bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">↓</kbd> Navigate</span>
              <span><kbd className="bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">↵</kbd> Select</span>
              <span><kbd className="bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">esc</kbd> Close</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
