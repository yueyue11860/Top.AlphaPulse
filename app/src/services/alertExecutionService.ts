import { ENABLE_PICKER_ALERTS } from '@/config/featureFlags';

interface AlertScanResponse {
  scannedRules: number;
  triggeredRules: number;
  insertedLogs: number;
}

export async function runAlertScan(strategyId?: number): Promise<AlertScanResponse> {
  if (!ENABLE_PICKER_ALERTS) {
    return {
      scannedRules: 0,
      triggeredRules: 0,
      insertedLogs: 0,
    };
  }

  const response = await fetch('/api/picker-alert/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(strategyId ? { strategyId } : {}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `预警扫描失败: ${response.status}`);
  }

  return response.json() as Promise<AlertScanResponse>;
}