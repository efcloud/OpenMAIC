/**
 * Live TTS — generates and plays TTS audio for discussion/QA agent responses.
 *
 * Accumulates streamed text chunks, then when the agent turn ends,
 * sends the full text to /api/generate/tts and plays the result.
 *
 * Sentence-level chunking (for lower latency) can be added later.
 */

import { useSettingsStore } from '@/lib/store/settings';
import { createLogger } from '@/lib/logger';

const log = createLogger('LiveTTS');

let currentAudio: HTMLAudioElement | null = null;
let pendingText = '';
let abortController: AbortController | null = null;

/** Call this on each onLiveSpeech(text, agentId) tick */
export function onLiveSpeechTick(text: string | null, agentId: string | null) {
  if (text !== null && agentId !== null) {
    // Agent is streaming — accumulate text
    pendingText = text;
  } else if (text === null && agentId === null && pendingText) {
    // Agent turn ended — speak the accumulated text
    const textToSpeak = pendingText;
    pendingText = '';
    speakText(textToSpeak);
  }
}

/** Stop any in-progress TTS playback */
export function stopLiveTTS() {
  pendingText = '';
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

async function speakText(text: string) {
  const settings = useSettingsStore.getState();

  if (settings.ttsMuted) return;
  if (!text.trim()) return;

  // Browser-native TTS — use Web Speech API directly (no server round-trip)
  if (settings.ttsProviderId === 'browser-native-tts') {
    speakWithBrowserTTS(text, settings.ttsSpeed);
    return;
  }

  // Server-side TTS — call /api/generate/tts
  const providerConfig = settings.ttsProvidersConfig[settings.ttsProviderId];

  abortController = new AbortController();

  try {
    const response = await fetch('/api/generate/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController.signal,
      body: JSON.stringify({
        text,
        audioId: `live-tts-${Date.now()}`,
        ttsProviderId: settings.ttsProviderId,
        ttsVoice: settings.ttsVoice,
        ttsSpeed: settings.ttsSpeed,
        ttsApiKey: providerConfig?.apiKey || undefined,
        ttsBaseUrl: providerConfig?.baseUrl || undefined,
      }),
    });

    if (!response.ok) {
      log.warn('TTS API error:', response.status);
      return;
    }

    const { base64, format } = await response.json();
    if (!base64) return;

    // Decode and play
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const mimeType = format === 'wav' ? 'audio/wav' : format === 'ogg' ? 'audio/ogg' : 'audio/mp3';
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);

    // Stop any previous audio
    if (currentAudio) {
      currentAudio.pause();
    }

    currentAudio = new Audio(url);
    currentAudio.volume = settings.ttsVolume;
    currentAudio.playbackRate = settings.playbackSpeed || 1;
    currentAudio.addEventListener('ended', () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
    });
    await currentAudio.play();
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    log.error('Live TTS error:', err);
  }
}

function speakWithBrowserTTS(text: string, speed: number) {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = speed;
  window.speechSynthesis.speak(utterance);
}
