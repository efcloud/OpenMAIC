/**
 * Live TTS — sentence-level chunked TTS for discussion/QA agent responses.
 *
 * As text streams in, detects sentence boundaries and generates TTS for each
 * sentence as soon as it's complete. Audio chunks are queued and played
 * sequentially for seamless playback that stays close to the text stream.
 */

import { useSettingsStore } from '@/lib/store/settings';
import { useAvatarStore } from '@/lib/store/avatar';
import { createLogger } from '@/lib/logger';

const log = createLogger('LiveTTS');

// Sentence boundary regex — split on . ? ! and Chinese equivalents, but not on abbreviations like "Dr." or "3.14"
const SENTENCE_BOUNDARY = /(?<=[.!?。！？])\s+|(?<=[.!?。！？])$/;

let prevText = '';
let spokenUpTo = 0; // character index already queued for TTS
let audioQueue: HTMLAudioElement[] = [];
let isPlaying = false;
let aborted = false;

/** Call on each onLiveSpeech tick to detect and speak new sentences */
export function onLiveSpeechTick(text: string | null, agentId: string | null) {
  if (text !== null && agentId !== null) {
    prevText = text;
    // Check for new complete sentences in the accumulated text
    const unspoken = text.slice(spokenUpTo);
    const sentences = splitSentences(unspoken);

    // Speak all complete sentences (keep the last fragment for next tick)
    if (sentences.length > 1) {
      for (let i = 0; i < sentences.length - 1; i++) {
        const sentence = sentences[i].trim();
        if (sentence) {
          spokenUpTo += sentences[i].length;
          queueSentence(sentence);
        }
      }
    }
  } else if (text === null && agentId === null) {
    // Agent turn ended — speak any remaining text
    const remaining = prevText.slice(spokenUpTo).trim();
    if (remaining) {
      queueSentence(remaining);
    }
    prevText = '';
    spokenUpTo = 0;
  }
}

/** Stop all TTS playback and clear queue */
export function stopLiveTTS() {
  aborted = true;
  prevText = '';
  spokenUpTo = 0;

  // Stop current audio
  if (audioQueue.length > 0) {
    const current = audioQueue[0];
    if (current) {
      current.pause();
      current.src = '';
    }
  }
  audioQueue = [];
  isPlaying = false;

  // Cancel browser TTS
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  // Reset abort flag after cleanup
  setTimeout(() => { aborted = false; }, 0);
}

function splitSentences(text: string): string[] {
  // Split keeping the delimiter with the preceding sentence
  const parts = text.split(SENTENCE_BOUNDARY);
  return parts.filter(Boolean);
}

async function queueSentence(sentence: string) {
  const settings = useSettingsStore.getState();
  if (settings.ttsMuted || aborted) return;
  if (!sentence.trim()) return;

  // Browser-native TTS
  if (settings.ttsProviderId === 'browser-native-tts') {
    queueBrowserTTS(sentence, settings.ttsSpeed);
    return;
  }

  // Server-side TTS
  const providerConfig = settings.ttsProvidersConfig[settings.ttsProviderId];

  try {
    const response = await fetch('/api/generate/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: sentence,
        audioId: `live-tts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ttsProviderId: settings.ttsProviderId,
        ttsVoice: settings.ttsVoice,
        ttsSpeed: settings.ttsSpeed,
        ttsApiKey: providerConfig?.apiKey || undefined,
        ttsBaseUrl: providerConfig?.baseUrl || undefined,
      }),
    });

    if (!response.ok || aborted) return;

    const data = await response.json();
    if (!data.base64 || aborted) return;

    const binaryStr = atob(data.base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const format = data.format;
    const mimeType = format === 'wav' ? 'audio/wav' : format === 'ogg' ? 'audio/ogg' : 'audio/mp3';
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);
    audio.volume = settings.ttsVolume;
    audio.playbackRate = settings.playbackSpeed || 1;
    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(url);
      playNext();
    });
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      playNext();
    });

    audioQueue.push(audio);

    // Start playing if nothing is currently playing
    if (!isPlaying) {
      playNext();
    }
  } catch (err) {
    if (aborted) return;
    log.error('Live TTS sentence error:', err);
  }
}

function playNext() {
  // Remove the finished audio
  if (audioQueue.length > 0 && isPlaying) {
    audioQueue.shift();
  }

  if (audioQueue.length === 0 || aborted) {
    isPlaying = false;
    useAvatarStore.getState().setMode('listening');
    return;
  }

  isPlaying = true;
  useAvatarStore.getState().setMode('speaking');
  const next = audioQueue[0];
  next.play().catch(() => {
    playNext();
  });
}

function queueBrowserTTS(text: string, speed: number) {
  if (!('speechSynthesis' in window) || aborted) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = speed;
  utterance.onstart = () => {
    useAvatarStore.getState().setMode('speaking');
  };
  utterance.onend = () => {
    // Only go to listening if nothing else is queued
    if (!window.speechSynthesis.speaking) {
      useAvatarStore.getState().setMode('listening');
    }
  };
  window.speechSynthesis.speak(utterance);
}
