import type { StockId } from '@/lib/assets';
import type { Time } from 'lightweight-charts';

export type MarketStockId = StockId;

export type Timeframe = '1D' | '1W' | '1M';

export interface StockMarketInfo {
  id: MarketStockId;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  logo: string;
}

export interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MovingAveragePoint {
  time: Time;
  value: number;
}
