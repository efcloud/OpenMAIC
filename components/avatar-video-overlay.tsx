'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAvatarStore } from '@/lib/store/avatar';
import { useSettingsStore } from '@/lib/store/settings';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { AVATAR_LOOPS, AVATAR_EMOTIONS } from '@/lib/constants/avatars';

const WELCOME_MESSAGE =
  'Hello, welcome to the Efekta classroom experience. Please use the text box to let me know what you would like to learn today.';

let welcomeAudio: HTMLAudioElement | null = null;

function stopWelcomeAudio() {
  if (welcomeAudio) {
    welcomeAudio.pause();
    welcomeAudio.src = '';
    welcomeAudio = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function getTeacherVoice(): string {
  const agents = useAgentRegistry.getState().listAgents();
  const teacher = agents.find((a) => a.role === 'teacher');
  return teacher?.voiceId || useSettingsStore.getState().ttsVoice;
}

async function speakWelcome(attempt = 0): Promise<void> {
  const MAX_RETRIES = 2;
  const settings = useSettingsStore.getState();
  const teacherVoice = getTeacherVoice();
  if (settings.ttsMuted) return;

  if (settings.ttsProviderId === 'browser-native-tts') {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(WELCOME_MESSAGE);
    u.rate = settings.ttsSpeed;
    u.onstart = () => useAvatarStore.getState().setMode('speaking');
    u.onend = () => useAvatarStore.getState().setMode('listening');
    u.onerror = () => useAvatarStore.getState().setMode('listening');
    window.speechSynthesis.speak(u);
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
        ttsVoice: teacherVoice,
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

    const binaryStr = atob(data.base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const mimeType = data.format === 'wav' ? 'audio/wav' : data.format === 'ogg' ? 'audio/ogg' : 'audio/mp3';
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);

    welcomeAudio = new Audio(url);
    welcomeAudio.volume = settings.ttsVolume;
    welcomeAudio.addEventListener('playing', () => useAvatarStore.getState().setMode('speaking'));
    welcomeAudio.addEventListener('ended', () => { URL.revokeObjectURL(url); welcomeAudio = null; useAvatarStore.getState().setMode('listening'); });
    welcomeAudio.addEventListener('error', () => { URL.revokeObjectURL(url); welcomeAudio = null; useAvatarStore.getState().setMode('listening'); });
    await welcomeAudio.play();
  } catch {
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      return speakWelcome(attempt + 1);
    }
    useAvatarStore.getState().setMode('listening');
  }
}

/**
 * Detect if browser needs canvas chromakey (Safari) or supports native VP9 alpha (Chrome/FF).
 * Safari can play VP9 but doesn't render the alpha channel.
 */
function needsCanvasChromakey(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua);
}

/**
 * Avatar Video Overlay
 *
 * Chrome/Firefox: native VP9 alpha WebM
 * Safari: canvas chromakey on green-screen MP4 (same-origin, works perfectly)
 */
export function AvatarVideoOverlay() {
  const mode = useAvatarStore((s) => s.mode);
  const emotion = useAvatarStore((s) => s.emotion);
  const clearEmotion = useAvatarStore((s) => s.clearEmotion);
  const setMode = useAvatarStore((s) => s.setMode);

  const pathname = usePathname();
  const loopRef = useRef<HTMLVideoElement>(null);
  const emotionRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const welcomeSpokenRef = useRef(false);
  const [useSafari, setUseSafari] = useState(false);

  useEffect(() => {
    setUseSafari(needsCanvasChromakey());
  }, []);

  const loopSrcs = AVATAR_LOOPS[mode] || AVATAR_LOOPS.listening;
  const emotionSrcs = emotion ? AVATAR_EMOTIONS[emotion] : null;
  const isPlayingEmotion = !!emotionSrcs;

  // Skip hello on non-main pages
  useEffect(() => {
    if (pathname !== '/' && mode === 'hello') {
      stopWelcomeAudio();
      setMode('listening');
    }
  }, [pathname, mode, setMode]);

  // Welcome TTS after user interaction
  useEffect(() => {
    if (pathname !== '/' || welcomeSpokenRef.current) return;
    const handle = () => {
      if (welcomeSpokenRef.current) return;
      welcomeSpokenRef.current = true;
      document.removeEventListener('click', handle);
      document.removeEventListener('keydown', handle);
      setTimeout(() => speakWelcome(), 500);
    };
    document.addEventListener('click', handle);
    document.addEventListener('keydown', handle);
    return () => { document.removeEventListener('click', handle); document.removeEventListener('keydown', handle); };
  }, [pathname]);

  // Stop welcome on navigation
  useEffect(() => { if (pathname !== '/') stopWelcomeAudio(); }, [pathname]);

  const handleLoopEnded = useCallback(() => {
    if (mode === 'hello') setMode('listening');
  }, [mode, setMode]);

  const handleEmotionEnded = useCallback(() => { clearEmotion(); }, [clearEmotion]);

  // Sync loop video
  useEffect(() => {
    const v = loopRef.current;
    if (v) { v.load(); v.play().catch(() => {}); }
  }, [mode, useSafari]);

  // Sync emotion video
  useEffect(() => {
    const v = emotionRef.current;
    if (!v) return;
    if (emotionSrcs) { v.load(); v.play().catch(() => {}); }
    else v.pause();
  }, [emotionSrcs, useSafari]);

  // Canvas chromakey render loop (Safari only)
  useEffect(() => {
    if (!useSafari) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let stopped = false;

    const render = () => {
      if (stopped) return;
      const video = (isPlayingEmotion ? emotionRef.current : loopRef.current);
      if (video && !video.paused && !video.ended && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.drawImage(video, 0, 0);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = frame.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          if (g > 170 && r < 50 && b < 50) {
            d[i + 3] = 0;
          } else if (g > 140 && r < 70 && b < 70 && g > (r + b) * 2) {
            const ratio = g / Math.max(r + b, 1);
            d[i + 3] = Math.max(0, Math.round(255 * Math.max(0, 1 - (ratio - 2) / 3)));
          }
        }
        ctx.putImageData(frame, 0, 0);
      }
      // Use requestVideoFrameCallback for Safari frame-sync
      const activeVid = (isPlayingEmotion ? emotionRef.current : loopRef.current);
      if (activeVid && 'requestVideoFrameCallback' in activeVid) {
        (activeVid as any).requestVideoFrameCallback(render);
      } else {
        requestAnimationFrame(render);
      }
    };

    // Start render loop
    const startRender = () => { if (!stopped) render(); };
    const loop = loopRef.current;
    const emo = emotionRef.current;
    loop?.addEventListener('playing', startRender);
    loop?.addEventListener('loadeddata', startRender);
    emo?.addEventListener('playing', startRender);
    emo?.addEventListener('loadeddata', startRender);
    if (loop && !loop.paused) startRender();

    return () => {
      stopped = true;
      loop?.removeEventListener('playing', startRender);
      loop?.removeEventListener('loadeddata', startRender);
      emo?.removeEventListener('playing', startRender);
      emo?.removeEventListener('loadeddata', startRender);
    };
  }, [useSafari, isPlayingEmotion, mode, emotion]);

  // Choose video source based on browser
  const loopSrc = useSafari ? loopSrcs.mp4 : loopSrcs.webm;
  const emotionSrc = emotionSrcs ? (useSafari ? emotionSrcs.mp4 : emotionSrcs.webm) : null;

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 z-[200] w-[22rem] select-none sm:w-[26rem] md:w-[30rem] lg:w-[36rem] xl:w-[40rem]">
      {/* Canvas — only rendered for Safari, sits on top */}
      {useSafari && (
        <canvas ref={canvasRef} aria-hidden="true" className="block h-auto w-full" />
      )}

      {/* Loop video — visible on Chrome, offscreen on Safari */}
      <video
        key={`loop-${mode}-${useSafari}`}
        ref={loopRef}
        aria-hidden="true"
        className="block h-auto w-full"
        style={useSafari
          ? { position: 'fixed', left: -2000, top: 0, width: 1280, height: 720 }
          : { opacity: isPlayingEmotion ? 0 : 1, transition: 'opacity 150ms ease-in-out' }
        }
        autoPlay
        loop={mode !== 'hello'}
        muted
        playsInline
        preload="auto"
        onEnded={handleLoopEnded}
      >
        <source src={loopSrc} type="video/mp4" />
      </video>

      {/* Emotion video */}
      {emotionSrc && (
        <video
          key={`emo-${emotion}-${useSafari}`}
          ref={emotionRef}
          aria-hidden="true"
          className="block h-auto w-full"
          style={useSafari
            ? { position: 'fixed', left: -2000, top: 0, width: 1280, height: 720 }
            : { position: 'absolute', inset: 0 }
          }
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={handleEmotionEnded}
        >
          <source src={emotionSrc} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
