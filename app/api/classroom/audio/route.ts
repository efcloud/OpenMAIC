/**
 * POST /api/classroom/audio — Persist a TTS audio file to server-side storage.
 * GET  /api/classroom/audio?classroomId=X&audioId=Y — Retrieve audio as base64.
 */

import { type NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import {
  isValidClassroomId,
  persistAudioFile,
  readAudioFile,
} from '@/lib/server/classroom-storage';

export async function POST(request: NextRequest) {
  try {
    const { classroomId, audioId, base64, format } = await request.json();

    if (!classroomId || !audioId || !base64 || !format) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing required fields');
    }
    if (!isValidClassroomId(classroomId)) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Invalid classroom id');
    }

    await persistAudioFile(classroomId, audioId, base64, format);
    return apiSuccess({ stored: true });
  } catch (error) {
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'Failed to store audio',
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const classroomId = request.nextUrl.searchParams.get('classroomId');
    const audioId = request.nextUrl.searchParams.get('audioId');

    if (!classroomId || !audioId) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing classroomId or audioId');
    }
    if (!isValidClassroomId(classroomId)) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Invalid classroom id');
    }

    const result = await readAudioFile(classroomId, audioId);
    if (!result) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 404, 'Audio not found');
    }

    return apiSuccess(result);
  } catch (error) {
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'Failed to read audio',
      error instanceof Error ? error.message : String(error),
    );
  }
}
