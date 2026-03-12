import { useEffect, useMemo } from 'react';
import { subscribeToQuoteLatestSnapshots } from '@/lib/supabase';
import {
  fetchStockQuoteItemsByCodes,
  mapSnapshotToStockQuoteItem,
  type StockQuoteItem,
  type StockQuoteSnapshot,
} from '@/services/stockDetailService';

interface UseLiveQuoteSnapshotsOptions {
  enabled?: boolean;
  pollIntervalMs?: number;
}

export function useLiveQuoteSnapshots(
  tsCodes: string[],
  onQuotes: (items: StockQuoteItem[]) => void,
  options: UseLiveQuoteSnapshotsOptions = {},
) {
  const { enabled = true, pollIntervalMs = 5_000 } = options;
  const codes = useMemo(
    () => Array.from(new Set(tsCodes.filter(Boolean))),
    [tsCodes.join('|')],
  );

  useEffect(() => {
    if (!enabled || codes.length === 0) return;

    let cancelled = false;

    const syncSnapshots = async () => {
      const items = await fetchStockQuoteItemsByCodes(codes);
      if (!cancelled && items.length > 0) {
        onQuotes(items);
      }
    };

    void syncSnapshots();

    const timerId = pollIntervalMs > 0
      ? window.setInterval(() => {
          void syncSnapshots();
        }, pollIntervalMs)
      : null;

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearInterval(timerId);
      }
    };
  }, [codes, enabled, onQuotes, pollIntervalMs]);

  useEffect(() => {
    if (!enabled || codes.length === 0) return;

    return subscribeToQuoteLatestSnapshots(codes, (snapshot) => {
      onQuotes([mapSnapshotToStockQuoteItem(snapshot as StockQuoteSnapshot)]);
    });
  }, [codes, enabled, onQuotes]);
}