'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useAvatarStore } from '@/lib/store/avatar';
import { useSettingsStore } from '@/lib/store/settings';
import { AVATAR_LOOPS, AVATAR_EMOTIONS } from '@/lib/constants/avatars';

const WELCOME_MESSAGE =
  'Hello, welcome to the Efekta classroom experience. Please use the text box to let me know what you would like to learn today.';

/**
 * Speak the welcome message via TTS if a provider is configured.
 * Falls back to browser-native TTS. Skipped if TTS is muted or no keys.
 */
async function speakWelcome() {
  const settings = useSettingsStore.getState();
  if (settings.ttsMuted) return;

  // Browser-native fallback
  if (settings.ttsProviderId === 'browser-native-tts') {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(WELCOME_MESSAGE);
    utterance.rate = settings.ttsSpeed;
    window.speechSynthesis.speak(utterance);
    return;
  }

  // Server-side TTS — check if provider has API key configured
  const providerConfig = settings.ttsProvidersConfig[settings.ttsProviderId];
  if (!providerConfig?.isServerConfigured && !providerConfig?.apiKey) return;

  try {
    const response = await fetch('/api/generate/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: WELCOME_MESSAGE,
        audioId: `welcome-${Date.now()}`,
        ttsProviderId: settings.ttsProviderId,
        ttsVoice: settings.ttsVoice,
        ttsSpeed: settings.ttsSpeed,
        ttsApiKey: providerConfig?.apiKey || undefined,
        ttsBaseUrl: providerConfig?.baseUrl || undefined,
      }),
    });

    if (!response.ok) return;

    const { base64, format } = await response.json();
    if (!base64) return;

    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const mimeType = format === 'wav' ? 'audio/wav' : format === 'ogg' ? 'audio/ogg' : 'audio/mp3';
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);
    audio.volume = settings.ttsVolume;
    audio.addEventListener('ended', () => URL.revokeObjectURL(url));
    await audio.play();
  } catch {
    // Silently fail — welcome is a nice-to-have, not critical
  }
}

/**
 * Avatar Video Overlay
 *
 * Always-on-top animated avatar that syncs with TTS/speech state.
 *
 * State machine:
 *   hello (one-shot + welcome TTS) → listening (loop)
 *   listening ↔ speaking (loop, driven by PlaybackEngine)
 *   any state → emotion (one-shot) → return to previous loop
 */
export function AvatarVideoOverlay() {
  const mode = useAvatarStore((s) => s.mode);
  const emotion = useAvatarStore((s) => s.emotion);
  const clearEmotion = useAvatarStore((s) => s.clearEmotion);
  const setMode = useAvatarStore((s) => s.setMode);

  const loopRef = useRef<HTMLVideoElement>(null);
  const emotionRef = useRef<HTMLVideoElement>(null);
  const welcomeSpokenRef = useRef(false);

  // Determine which video source to show
  const loopSrc = AVATAR_LOOPS[mode] || AVATAR_LOOPS.listening;
  const emotionSrc = emotion ? AVATAR_EMOTIONS[emotion] : null;
  const isPlayingEmotion = !!emotionSrc;

  // Speak welcome message once on mount (when hello clip starts)
  useEffect(() => {
    if (mode === 'hello' && !welcomeSpokenRef.current) {
      welcomeSpokenRef.current = true;
      speakWelcome();
    }
  }, [mode]);

  // When the hello clip finishes, switch to listening
  const handleLoopEnded = useCallback(() => {
    if (mode === 'hello') {
      setMode('listening');
    }
  }, [mode, setMode]);

  // When an emotion clip finishes, clear it (returns to previous loop)
  const handleEmotionEnded = useCallback(() => {
    clearEmotion();
  }, [clearEmotion]);

  // Keep loop video in sync with mode changes
  useEffect(() => {
    const video = loopRef.current;
    if (!video) return;

    const expectedSrc = AVATAR_LOOPS[mode] || AVATAR_LOOPS.listening;
    if (!video.currentSrc.endsWith(expectedSrc)) {
      video.src = expectedSrc;
      video.load();
    }
    video.play().catch(() => {});
  }, [mode]);

  // Start/stop emotion video
  useEffect(() => {
    const video = emotionRef.current;
    if (!video) return;

    if (emotionSrc) {
      video.src = emotionSrc;
      video.load();
      video.play().catch(() => {});
    } else {
      video.pause();
      video.removeAttribute('src');
    }
  }, [emotionSrc]);

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 z-[200] w-[22rem] select-none sm:w-[26rem] md:w-[30rem] lg:w-[36rem] xl:w-[40rem]">
      {/* Loop video (listening/speaking) — always mounted, hidden during emotion */}
      <video
        ref={loopRef}
        aria-hidden="true"
        className="block h-auto w-full"
        style={{
          opacity: isPlayingEmotion ? 0 : 1,
          transition: 'opacity 150ms ease-in-out',
        }}
        autoPlay
        loop={mode !== 'hello'}
        muted
        playsInline
        preload="auto"
        onEnded={handleLoopEnded}
      >
        <source src={loopSrc} type="video/webm" />
      </video>

      {/* Emotion video (one-shot overlay) — only visible when playing */}
      <video
        ref={emotionRef}
        aria-hidden="true"
        className="absolute inset-0 block h-auto w-full"
        style={{
          opacity: isPlayingEmotion ? 1 : 0,
          transition: 'opacity 150ms ease-in-out',
        }}
        muted
        playsInline
        preload="none"
        onEnded={handleEmotionEnded}
      />
    </div>
  );
}
