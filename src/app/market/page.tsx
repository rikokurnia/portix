import { Market } from '@/features/market/Market';

export const metadata = {
  title: 'PORTIX — Market',
  description: 'Trade tokenized stocks with pUSDC and deploy directly into carry yield vaults.',
};

export default function MarketPage() {
  return <Market />;
}
