'use client';

import { useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAvatarStore } from '@/lib/store/avatar';
import { useSettingsStore } from '@/lib/store/settings';
import { AVATAR_LOOPS, AVATAR_EMOTIONS } from '@/lib/constants/avatars';

const WELCOME_MESSAGE =
  'Hello, welcome to the Efekta classroom experience. Please use the text box to let me know what you would like to learn today.';

/**
 * Speak the welcome message via TTS.
 * Retries up to 2 times with increasing delay if the request fails
 * (server config may not be loaded yet on first attempt).
 */
async function speakWelcome(attempt = 0): Promise<void> {
  const MAX_RETRIES = 2;
  const settings = useSettingsStore.getState();

  if (settings.ttsMuted) return;

  // Browser-native fallback
  if (settings.ttsProviderId === 'browser-native-tts') {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(WELCOME_MESSAGE);
    utterance.rate = settings.ttsSpeed;
    utterance.onstart = () => useAvatarStore.getState().setMode('speaking');
    utterance.onend = () => useAvatarStore.getState().setMode('listening');
    utterance.onerror = () => useAvatarStore.getState().setMode('listening');
    window.speechSynthesis.speak(utterance);
    return;
  }

  const providerConfig = settings.ttsProvidersConfig[settings.ttsProviderId];

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

    if (!response.ok) {
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        return speakWelcome(attempt + 1);
      }
      return;
    }

    const data = await response.json();
    if (!data.base64) {
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        return speakWelcome(attempt + 1);
      }
      return;
    }

    // Decode base64 audio
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

    audio.addEventListener('playing', () => {
      useAvatarStore.getState().setMode('speaking');
    });
    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(url);
      useAvatarStore.getState().setMode('listening');
    });
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      useAvatarStore.getState().setMode('listening');
    });

    await audio.play();
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      return speakWelcome(attempt + 1);
    }
    useAvatarStore.getState().setMode('listening');
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

  const pathname = usePathname();
  const loopRef = useRef<HTMLVideoElement>(null);
  const emotionRef = useRef<HTMLVideoElement>(null);
  const welcomeSpokenRef = useRef(false);

  // Determine which video source to show
  const loopSrc = AVATAR_LOOPS[mode] || AVATAR_LOOPS.listening;
  const emotionSrc = emotion ? AVATAR_EMOTIONS[emotion] : null;
  const isPlayingEmotion = !!emotionSrc;

  // On main page: play hello clip, then idle, then speak welcome.
  // On other pages: skip straight to listening.
  useEffect(() => {
    if (mode === 'hello') {
      if (pathname !== '/') {
        setMode('listening');
      }
    }
  }, [mode, pathname, setMode]);

  // Trigger welcome TTS after the user's first interaction (browser autoplay policy
  // blocks audio.play() until the user clicks/taps/types on the page).
  useEffect(() => {
    if (pathname !== '/' || welcomeSpokenRef.current) return;

    const handleInteraction = () => {
      if (welcomeSpokenRef.current) return;
      welcomeSpokenRef.current = true;
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      setTimeout(() => speakWelcome(), 500);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('keydown', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, [pathname]);

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
