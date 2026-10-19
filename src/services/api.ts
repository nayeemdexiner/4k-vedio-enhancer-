/**
 * VideoEnhance Studio - Client API Service
 */

import { EnhancementConfig, MediaSourceInfo } from '../types';

export interface SystemHealthStatus {
  apiStatus: 'healthy' | 'degraded' | 'down';
  workerConnected: boolean;
  workerStatusText: string;
  environment: string;
}

export async function fetchSystemHealth(): Promise<SystemHealthStatus> {
  try {
    const res = await fetch('/api/healthz');
    if (!res.ok) throw new Error(`Health check returned ${res.status}`);
    const data = await res.json();
    return {
      apiStatus: 'healthy',
      workerConnected: Boolean(data.services?.gpuWorker?.configured),
      workerStatusText: data.services?.gpuWorker?.message || 'In-browser WebGL engine',
      environment: data.environment || 'production'
    };
  } catch (err) {
    return {
      apiStatus: 'healthy',
      workerConnected: false,
      workerStatusText: 'In-browser WebGL engine',
      environment: 'client'
    };
  }
}

export async function requestSignedUploadUrl(fileName: string, fileSize: number) {
  const res = await fetch('/api/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: fileName, size: fileSize })
  });
  if (!res.ok) throw new Error('Failed to obtain upload token');
  return res.json();
}
