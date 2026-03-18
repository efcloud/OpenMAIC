/**
 * Live TTS — per-agent voiced, turn-aware, sentence-chunked TTS.
 *
 * Each agent has its own voice (from AgentConfig.voiceId).
 * Audio plays sequentially — agent B's audio waits for agent A's to finish.
 * Sentences are detected during streaming and queued as they arrive.
 */

import { useSettingsStore } from '@/lib/store/settings';
import { useAvatarStore } from '@/lib/store/avatar';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { createLogger } from '@/lib/logger';

const log = createLogger('LiveTTS');

const SENTENCE_BOUNDARY = /(?<=[.!?。！？])\s+|(?<=[.!?。！？])$/;

interface QueueItem {
  audio: HTMLAudioElement;
  url: string;
  agentId: string;
}

let currentAgentId: string | null = null;
let prevText = '';
let spokenUpTo = 0;
let queue: QueueItem[] = [];
let isPlaying = false;
let aborted = false;

/** Whether the TTS audio queue is currently playing or has pending items */
export function isLiveTTSActive(): boolean {
  return isPlaying || queue.length > 0;
}

/** Call on each onLiveSpeech tick */
export function onLiveSpeechTick(text: string | null, agentId: string | null) {
  // Agent switch signal (text=null, agentId=new) — flush previous agent's remaining text
  if (text === null && agentId !== null && agentId !== currentAgentId) {
    if (prevText && spokenUpTo < prevText.length && currentAgentId) {
      const remaining = prevText.slice(spokenUpTo).trim();
      if (remaining) queueSentence(remaining, currentAgentId);
    }
    currentAgentId = agentId;
    prevText = '';
    spokenUpTo = 0;
    return;
  }

  if (text !== null && agentId !== null) {
    // Track agent (first text tick might be the first we see the agentId)
    if (agentId !== currentAgentId) {
      if (prevText && spokenUpTo < prevText.length && currentAgentId) {
        const remaining = prevText.slice(spokenUpTo).trim();
        if (remaining) queueSentence(remaining, currentAgentId);
      }
      currentAgentId = agentId;
      prevText = '';
      spokenUpTo = 0;
    }

    prevText = text;

    // Detect complete sentences in new text
    const unspoken = text.slice(spokenUpTo);
    const sentences = splitSentences(unspoken);

    if (sentences.length > 1) {
      for (let i = 0; i < sentences.length - 1; i++) {
        const sentence = sentences[i].trim();
        if (sentence) {
          spokenUpTo += sentences[i].length;
          queueSentence(sentence, agentId);
        }
      }
    }
  } else if (text === null && agentId === null) {
    // Agent turn ended — speak remaining text
    if (prevText && spokenUpTo < prevText.length) {
      const remaining = prevText.slice(spokenUpTo).trim();
      if (remaining && currentAgentId) {
        queueSentence(remaining, currentAgentId);
      }
    }
    prevText = '';
    spokenUpTo = 0;
    currentAgentId = null;
  }
}

/** Stop all TTS playback and clear queue */
export function stopLiveTTS() {
  aborted = true;
  prevText = '';
  spokenUpTo = 0;
  currentAgentId = null;

  // Stop current audio
  if (queue.length > 0) {
    const current = queue[0];
    if (current) {
      current.audio.pause();
      current.audio.src = '';
      URL.revokeObjectURL(current.url);
    }
  }
  queue = [];
  isPlaying = false;

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  setTimeout(() => { aborted = false; }, 0);
}

function splitSentences(text: string): string[] {
  return text.split(SENTENCE_BOUNDARY).filter(Boolean);
}

/** Resolve the TTS voice for a given agent */
function getVoiceForAgent(agentId: string): string {
  const agent = useAgentRegistry.getState().getAgent(agentId);
  if (agent?.voiceId) return agent.voiceId;
  // Fall back to global TTS voice setting
  return useSettingsStore.getState().ttsVoice;
}

async function queueSentence(sentence: string, agentId: string) {
  const settings = useSettingsStore.getState();
  if (settings.ttsMuted || aborted) return;
  if (!sentence.trim()) return;

  const voiceId = getVoiceForAgent(agentId);

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
        audioId: `live-${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ttsProviderId: settings.ttsProviderId,
        ttsVoice: voiceId,
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
    audio.addEventListener('ended', () => playNext());
    audio.addEventListener('error', () => playNext());

    queue.push({ audio, url, agentId });

    if (!isPlaying) {
      playNext();
    }
  } catch (err) {
    if (aborted) return;
    log.error('Live TTS error:', err);
  }
}

function playNext() {
  // Clean up finished item
  if (queue.length > 0 && isPlaying) {
    const finished = queue.shift()!;
    URL.revokeObjectURL(finished.url);
  }

  if (queue.length === 0 || aborted) {
    isPlaying = false;
    useAvatarStore.getState().setMode('listening');
    return;
  }

  isPlaying = true;
  useAvatarStore.getState().setMode('speaking');
  const next = queue[0];
  next.audio.play().catch(() => playNext());
}

function queueBrowserTTS(text: string, speed: number) {
  if (!('speechSynthesis' in window) || aborted) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = speed;
  utterance.onstart = () => useAvatarStore.getState().setMode('speaking');
  utterance.onend = () => {
    if (!window.speechSynthesis.speaking) {
      useAvatarStore.getState().setMode('listening');
    }
  };
  window.speechSynthesis.speak(utterance);
}
