import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type TimeRange = '15m' | '1h' | '6h' | '24h' | '7d';

interface TimeContextType {
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
}

const TimeContext = createContext<TimeContextType | undefined>(undefined);

export function TimeProvider({ children }: { children: ReactNode }) {
  const [timeRange, setTimeRange] = useState<TimeRange>('15m');

  return (
    <TimeContext.Provider value={{ timeRange, setTimeRange }}>
      {children}
    </TimeContext.Provider>
  );
}

export function useTimeContext() {
  const context = useContext(TimeContext);
  if (context === undefined) {
    throw new Error('useTimeContext must be used within a TimeProvider');
  }
  return context;
}
