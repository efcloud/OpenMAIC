'use client';

import { useState } from 'react';

type AvatarPhase = 'hello' | 'idle';

const AVATAR_SOURCES: Record<AvatarPhase, string> = {
  hello: '/addi/hello.webm',
  idle: '/addi/idle.webm',
};

export function AvatarVideoOverlay() {
  const [phase, setPhase] = useState<AvatarPhase>('hello');

  return (
    <div className="pointer-events-none fixed bottom-2 left-2 z-[200] w-[22rem] select-none sm:bottom-3 sm:left-3 sm:w-[26rem] md:bottom-5 md:left-5 md:w-[30rem] lg:w-[36rem] xl:w-[40rem]">
      <video
        key={phase}
        aria-hidden="true"
        className="block h-auto w-full drop-shadow-[0_12px_30px_rgba(15,23,42,0.18)]"
        autoPlay
        loop={phase === 'idle'}
        muted
        playsInline
        preload="auto"
        onEnded={() => setPhase('idle')}
        onError={() => setPhase('idle')}
      >
        <source src={AVATAR_SOURCES[phase]} type="video/webm" />
      </video>
    </div>
  );
}
