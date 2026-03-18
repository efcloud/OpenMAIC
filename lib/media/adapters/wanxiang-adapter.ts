/**
 * Wanxiang (通义万象) Video Generation Adapter
 * Alibaba Cloud Bailian / DashScope
 *
 * Async task pattern: submit → poll → return video URL.
 *
 * REST endpoints:
 * - Submit: POST /api/v1/services/aigc/video-generation/video-synthesis
 * - Poll:   GET  /api/v1/tasks/{task_id}
 *
 * Authentication: DashScope API key as Bearer token.
 * Required header on submit: X-DashScope-Async: enable
 *
 * Supported models:
 * - wan2.6-t2v          (latest, with audio, multi-shot)
 * - wan2.5-t2v-preview  (with audio)
 * - wan2.2-t2v-plus     (silent video)
 * - wanx2.1-t2v-turbo   (legacy, silent, fast)
 * - wanx2.1-t2v-plus    (legacy, silent, quality)
 *
 * Regions:
 * - Beijing (default): https://dashscope.aliyuncs.com
 * - Singapore:         https://dashscope-intl.aliyuncs.com
 * - Virginia:          https://dashscope-us.aliyuncs.com
 *
 * API docs: https://help.aliyun.com/zh/model-studio/text-to-video-api-reference
 */

import type {
  VideoGenerationConfig,
  VideoGenerationOptions,
  VideoGenerationResult,
} from '../types';

const DEFAULT_MODEL = 'wan2.6-t2v';
const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com';
const POLL_INTERVAL_MS = 8_000;
const MAX_POLL_ATTEMPTS = 75; // ~10 minutes max

// ---------------------------------------------------------------------------
// Size helpers
// ---------------------------------------------------------------------------

/** Map aspect ratio to DashScope "W*H" size string */
function resolveDashScopeSize(aspectRatio?: string, resolution?: string): string {
  const is1080p = resolution === '1080p';

  switch (aspectRatio) {
    case '9:16':
      return is1080p ? '1080*1920' : '720*1280';
    case '1:1':
      return is1080p ? '1024*1024' : '960*960';
    case '4:3':
      return is1080p ? '1440*1080' : '1024*768';
    case '3:4':
      return is1080p ? '1080*1440' : '768*1024';
    case '21:9':
      return '1680*720';
    default: // 16:9
      return is1080p ? '1920*1080' : '1280*720';
  }
}

/** Parse "W*H" back to numeric dimensions */
function parseDimensions(size: string): { width: number; height: number } {
  const parts = size.split('*');
  return {
    width: parseInt(parts[0] ?? '1280', 10),
    height: parseInt(parts[1] ?? '720', 10),
  };
}

// ---------------------------------------------------------------------------
// REST types
// ---------------------------------------------------------------------------

interface WanxiangSubmitResponse {
  output: {
    task_id: string;
    task_status: string;
  };
  request_id?: string;
  code?: string;
  message?: string;
}

interface WanxiangPollResponse {
  output: {
    task_id: string;
    task_status: string; // PENDING | RUNNING | SUCCEEDED | FAILED
    task_status_msg?: string;
    video_url?: string;
    // wan2.6+ may also include video_url inside task_result
    task_result?: {
      videos?: Array<{ url: string; cover_image_url?: string }>;
    };
    code?: string;
    message?: string;
  };
  usage?: {
    video_duration?: number;
    video_ratio?: string;
  };
  request_id?: string;
  code?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Connectivity test
// ---------------------------------------------------------------------------

export async function testWanxiangConnectivity(
  config: VideoGenerationConfig,
): Promise<{ success: boolean; message: string }> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  try {
    // A lightweight GET to the tasks endpoint with a dummy ID:
    // 401/403 → invalid key; 404 → key valid, task not found (expected)
    const response = await fetch(`${baseUrl}/api/v1/tasks/connectivity-check`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (response.status === 401 || response.status === 403) {
      const text = await response.text();
      return {
        success: false,
        message: `Wanxiang auth failed (${response.status}): ${text}`,
      };
    }
    return { success: true, message: 'Connected to Wanxiang (通义万象)' };
  } catch (err) {
    return { success: false, message: `Wanxiang connectivity error: ${err}` };
  }
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

async function submitTask(
  baseUrl: string,
  apiKey: string,
  model: string,
  options: VideoGenerationOptions,
): Promise<string> {
  const size = resolveDashScopeSize(options.aspectRatio, options.resolution);

  const body: Record<string, unknown> = {
    model,
    input: {
      prompt: options.prompt,
    },
    parameters: {
      size,
      prompt_extend: true,
      ...(options.duration ? { duration: options.duration } : {}),
    },
  };

  const response = await fetch(
    `${baseUrl}/api/v1/services/aigc/video-generation/video-synthesis`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Wanxiang submit failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as WanxiangSubmitResponse;

  // Check for API-level errors
  if (data.code && data.code !== '200') {
    throw new Error(`Wanxiang submit error ${data.code}: ${data.message}`);
  }

  const taskId = data.output?.task_id;
  if (!taskId) {
    throw new Error('Wanxiang returned empty task_id');
  }

  return taskId;
}

// ---------------------------------------------------------------------------
// Poll
// ---------------------------------------------------------------------------

async function pollTask(
  baseUrl: string,
  apiKey: string,
  taskId: string,
): Promise<WanxiangPollResponse['output']> {
  const response = await fetch(`${baseUrl}/api/v1/tasks/${taskId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Wanxiang poll failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as WanxiangPollResponse;

  if (data.code && data.code !== '200') {
    throw new Error(`Wanxiang poll error ${data.code}: ${data.message}`);
  }

  return data.output;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function generateWithWanxiang(
  config: VideoGenerationConfig,
  options: VideoGenerationOptions,
): Promise<VideoGenerationResult> {
  const model = config.model || DEFAULT_MODEL;
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const apiKey = config.apiKey;

  // 1. Submit
  const taskId = await submitTask(baseUrl, apiKey, model, options);

  // 2. Poll until done
  const size = resolveDashScopeSize(options.aspectRatio, options.resolution);
  const { width, height } = parseDimensions(size);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const output = await pollTask(baseUrl, apiKey, taskId);

    if (output.task_status === 'SUCCEEDED') {
      // video_url may be top-level or inside task_result.videos[0]
      const videoUrl =
        output.video_url ?? output.task_result?.videos?.[0]?.url;

      if (!videoUrl) {
        throw new Error('Wanxiang task succeeded but no video URL returned');
      }

      return {
        url: videoUrl,
        duration: options.duration ?? 5,
        width,
        height,
        poster: output.task_result?.videos?.[0]?.cover_image_url,
      };
    }

    if (output.task_status === 'FAILED') {
      throw new Error(
        `Wanxiang video generation failed: ${output.task_status_msg ?? output.message ?? 'Unknown error'}`,
      );
    }

    // PENDING or RUNNING — keep polling
  }

  throw new Error(
    `Wanxiang video generation timed out after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s (task: ${taskId})`,
  );
}
