import { useState, useEffect } from 'react';
import { Search as SearchIcon, FileText, Network, Server, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SearchResult {
  message?: string;
  trace_id?: string;
  service?: string;
  endpoint?: string;
  status?: string | number;
  timestamp?: string;
  [key: string]: any;
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch (err) {
        console.error('Failed to search', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const getResultIcon = (result: SearchResult) => {
    if (result.message) return <FileText size={16} className="text-gray-400" />;
    if (result.trace_id) return <Network size={16} className="text-blue-400" />;
    if (result.endpoint) return <Server size={16} className="text-green-400" />;
    return <SearchIcon size={16} className="text-gray-400" />;
  };

  const getResultTitle = (result: SearchResult) => {
    if (result.message) return result.message;
    if (result.endpoint) return `${result.service} - ${result.endpoint}`;
    if (result.trace_id) return `Trace: ${result.trace_id}`;
    return 'Unknown Event';
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">Global Search</h1>
        <p className="page-subtitle">Search across logs, traces, endpoints, and services</p>
      </header>
      
      <div className="search-container mb-4">
        <div className="search-input-wrapper relative shadow-lg">
          <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={24} />
          <input 
            type="text" 
            placeholder="Search for traces, endpoints, or error messages..." 
            className="w-full bg-[#0d1117] border-2 border-gray-800 rounded-xl py-4 pl-12 pr-4 text-white text-lg focus:outline-none focus:border-blue-500 transition-colors"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="search-results">
        {loading && <div className="text-center py-8 text-gray-400">Searching...</div>}
        
        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="text-center py-8 text-gray-400">No results found for "{query}"</div>
        )}
        
        {!loading && results.length > 0 && (
          <div className="results-list space-y-2">
            {results.map((result, i) => {
              let toPath = "#";
              if (result.trace_id) toPath = `/tracing?trace=${result.trace_id}`;
              else if (result.endpoint) toPath = `/services/${result.service}`;
              else if (result.service) toPath = `/logs?service=${result.service}`;

              return (
                <Link key={i} to={toPath} className="card hover:bg-gray-800/50 cursor-pointer transition-colors p-4 flex items-start gap-4 block group">
                  <div className="mt-1">{getResultIcon(result)}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-medium text-white truncate max-w-lg">{getResultTitle(result)}</h4>
                      <span className="text-xs text-gray-500">{new Date(result.timestamp || '').toLocaleString()}</span>
                    </div>
                    <div className="flex gap-4 text-sm text-gray-400">
                      {result.service && <span>Service: <span className="text-gray-300">{result.service}</span></span>}
                      {result.status && <span>Status: <span className={Number(result.status) >= 500 ? 'text-red-400' : 'text-gray-300'}>{result.status}</span></span>}
                      {result.trace_id && <span className="truncate max-w-xs">Trace: <span className="text-gray-300">{result.trace_id}</span></span>}
                    </div>
                  </div>
                  <div className="self-center opacity-0 group-hover:opacity-100 text-blue-400 transition-opacity">
                    <ArrowRight size={16} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
