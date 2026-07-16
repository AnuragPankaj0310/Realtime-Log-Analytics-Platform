import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Overview from './pages/Overview';
import Services from './pages/Services';
import ServiceDetails from './pages/ServiceDetails';
import Tracing from './pages/Tracing';
import Analytics from './pages/Analytics';
import Logs from './pages/Logs';
import Alerts from './pages/Alerts';
import GlobalSearch from './pages/Search';
import Architecture from './pages/Architecture';
import { CommandPalette } from './components/CommandPalette';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TimeProvider } from './contexts/TimeContext';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 2000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TimeProvider>
      <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-[#0a0c10] text-gray-100 font-sans">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopNav />
          <main className="flex-1 overflow-y-auto p-6 scroll-smooth relative">
            <Toaster position="top-right" toastOptions={{ style: { background: '#1f2937', color: '#fff', border: '1px solid #374151' } }} />
            <CommandPalette />
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/services" element={<Services />} />
              <Route path="/services/:id" element={<ServiceDetails />} />
              <Route path="/tracing" element={<Tracing />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/search" element={<GlobalSearch />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/architecture" element={<Architecture />} />
            </Routes>
          </main>
        </div>
      </div>
      </BrowserRouter>
      </TimeProvider>
    </QueryClientProvider>
  );
}

export default App;
