import { useQuery, keepPreviousData } from '@tanstack/react-query';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error fetching ${url}`);
  return res.json();
};

export const useSystemOverview = (timeRange: string = '15m') => {
  return useQuery({
    queryKey: ['overview', timeRange],
    queryFn: () => fetcher(`/api/system/overview?time_range=${timeRange}`),
    refetchInterval: 5000,
    placeholderData: keepPreviousData,
  });
};

export const useAnalytics = (timeRange: string = '15m') => {
  return useQuery({
    queryKey: ['analytics', timeRange],
    queryFn: () => fetcher(`/api/analytics?time_range=${timeRange}`),
    refetchInterval: 5000,
    placeholderData: keepPreviousData,
  });
};

export const useServices = (timeRange: string = '15m') => {
  return useQuery({
    queryKey: ['services', timeRange],
    queryFn: () => fetcher(`/api/services?time_range=${timeRange}`),
    refetchInterval: 5000,
    placeholderData: keepPreviousData,
  });
};

export const useServiceDetails = (serviceId: string, timeRange: string = '15m') => {
  return useQuery({
    queryKey: ['service', serviceId, timeRange],
    queryFn: () => fetcher(`/api/services/${serviceId}/details?time_range=${timeRange}`),
    refetchInterval: 5000,
    enabled: !!serviceId,
    placeholderData: keepPreviousData,
  });
};

export const useRecentTraces = () => {
  return useQuery({
    queryKey: ['traces'],
    queryFn: () => fetcher('/api/traces/recent'),
    refetchInterval: 5000,
    placeholderData: keepPreviousData,
  });
};

export const useTrace = (traceId: string) => {
  return useQuery({
    queryKey: ['trace', traceId],
    queryFn: () => fetcher(`/api/trace/${traceId}`),
    enabled: !!traceId,
  });
};

export const useAlerts = () => {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetcher('/api/alerts'),
    refetchInterval: 5000,
    placeholderData: keepPreviousData,
  });
};

export const useLogsSearch = (query: string, limit: number = 100) => {
  return useQuery({
    queryKey: ['logs', 'search', query, limit],
    queryFn: () => {
      if (query) return fetcher(`/api/logs/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      return fetcher(`/api/logs?limit=${limit}`);
    },
    enabled: true, // we might want to manually trigger, but let's just use it reactively
  });
};

export const useRca = () => {
  return useQuery({
    queryKey: ['rca'],
    queryFn: () => fetcher('/api/rca'),
    refetchInterval: 10000,
    placeholderData: keepPreviousData,
  });
};
