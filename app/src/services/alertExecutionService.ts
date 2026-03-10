interface AlertScanResponse {
  scannedRules: number;
  triggeredRules: number;
  insertedLogs: number;
}

export async function runAlertScan(strategyId?: number): Promise<AlertScanResponse> {
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