'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useAvatarStore } from '@/lib/store/avatar';
import { AVATAR_LOOPS, AVATAR_EMOTIONS } from '@/lib/constants/avatars';

/**
 * Avatar Video Overlay
 *
 * Always-on-top animated avatar that syncs with TTS/speech state.
 *
 * State machine:
 *   hello (one-shot) → listening (loop)
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

  // Determine which video source to show
  const loopSrc = AVATAR_LOOPS[mode] || AVATAR_LOOPS.listening;
  const emotionSrc = emotion ? AVATAR_EMOTIONS[emotion] : null;
  const isPlayingEmotion = !!emotionSrc;

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

    // Update source if it changed
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
