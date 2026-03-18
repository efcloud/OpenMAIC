/**
 * Wanxiang (Alibaba Cloud / DashScope) Video Generation Adapter
 *
 * Uses DashScope async task API: submit task → poll until done → get video URL.
 * Model: wan2.6-t2v (WAN 2.6 Text-to-Video)
 *
 * Submit endpoint: POST /api/v1/services/aigc/video-generation/generation
 * Poll endpoint:   GET /api/v1/tasks/{task_id}
 *
 * Auth: Bearer token via DashScope API key
 * Base URL: https://dashscope-intl.aliyuncs.com (international)
 *           https://dashscope.aliyuncs.com (China)
 */

import type {
  VideoGenerationConfig,
  VideoGenerationOptions,
  VideoGenerationResult,
} from '../types';

const DEFAULT_MODEL = 'wan2.6-t2v';
const DEFAULT_BASE_URL = 'https://dashscope-intl.aliyuncs.com';
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 120; // 10 minutes max

/** DashScope async task submit response */
interface DashScopeSubmitResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: string;
  };
}

/** DashScope async task poll response */
interface DashScopePollResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | string;
    task_metrics?: {
      TOTAL?: number;
      SUCCEEDED?: number;
      FAILED?: number;
    };
    video_url?: string;
    results?: Array<{ url: string }>;
    code?: string;
    message?: string;
  };
  usage?: {
    video_count?: number;
    video_duration?: number;
  };
}

/** Map aspect ratio to DashScope size parameter */
function toDashScopeSize(aspectRatio?: string): string {
  switch (aspectRatio) {
    case '16:9': return '1280*720';
    case '9:16': return '720*1280';
    case '1:1': return '720*720';
    case '4:3': return '960*720';
    case '3:4': return '720*960';
    default: return '1280*720';
  }
}

/** Estimate dimensions from size string */
function parseDimensions(size: string): { width: number; height: number } {
  const [w, h] = size.split('*').map(Number);
  return { width: w || 1280, height: h || 720 };
}

export async function testWanxiangConnectivity(
  config: VideoGenerationConfig,
): Promise<{ success: boolean; message: string }> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  try {
    // Minimal request to check auth
    const response = await fetch(
      `${baseUrl}/api/v1/services/aigc/video-generation/generation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({
          model: config.model || DEFAULT_MODEL,
          input: { prompt: '' },
          parameters: { size: '1*1' },
        }),
      },
    );
    if (response.status === 401 || response.status === 403) {
      return { success: false, message: `Wanxiang auth failed (${response.status})` };
    }
    return { success: true, message: 'Connected to Wanxiang Video' };
  } catch (err) {
    return { success: false, message: `Wanxiang connectivity error: ${err}` };
  }
}

export async function generateWithWanxiang(
  config: VideoGenerationConfig,
  options: VideoGenerationOptions,
): Promise<VideoGenerationResult> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const model = config.model || DEFAULT_MODEL;
  const size = toDashScopeSize(options.aspectRatio);

  // Step 1: Submit async task
  const submitResponse = await fetch(
    `${baseUrl}/api/v1/services/aigc/video-generation/generation`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model,
        input: {
          prompt: options.prompt,
        },
        parameters: {
          size,
          ...(options.duration && { duration: options.duration }),
        },
      }),
    },
  );

  if (!submitResponse.ok) {
    const text = await submitResponse.text();
    throw new Error(`Wanxiang submit failed (${submitResponse.status}): ${text}`);
  }

  const submitData: DashScopeSubmitResponse = await submitResponse.json();
  const taskId = submitData.output?.task_id;
  if (!taskId) {
    throw new Error('Wanxiang submit response missing task_id');
  }

  // Step 2: Poll for completion
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const pollResponse = await fetch(
      `${baseUrl}/api/v1/tasks/${taskId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      },
    );

    if (!pollResponse.ok) {
      throw new Error(`Wanxiang poll failed (${pollResponse.status})`);
    }

    const pollData: DashScopePollResponse = await pollResponse.json();
    const status = pollData.output?.task_status;

    if (status === 'SUCCEEDED') {
      const videoUrl =
        pollData.output?.video_url ||
        pollData.output?.results?.[0]?.url;

      if (!videoUrl) {
        throw new Error('Wanxiang task succeeded but no video URL found');
      }

      const { width, height } = parseDimensions(size);

      return {
        url: videoUrl,
        width,
        height,
        duration: options.duration || 5,
      };
    }

    if (status === 'FAILED') {
      const msg = pollData.output?.message || pollData.output?.code || 'Unknown error';
      throw new Error(`Wanxiang video generation failed: ${msg}`);
    }

    // PENDING or RUNNING — keep polling
  }

  throw new Error('Wanxiang video generation timed out');
}
