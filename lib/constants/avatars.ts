import type { AvatarEmotion } from '@/lib/store/avatar';

export const TEACHER_AVATAR = '/addi/img.png';

/**
 * Video sources per asset.
 * webm: VP9 with alpha (Chrome/Firefox — native transparency)
 * mp4: H.264 green screen (Safari — canvas chromakey removes green)
 */
export interface AvatarVideoSrc {
  webm: string;
  mp4: string;
}

/** Video loops — keyed by avatar mode */
export const AVATAR_LOOPS: Record<string, AvatarVideoSrc> = {
  hello: { webm: '/addi/hello.webm', mp4: '/addi/emotions/wave.mp4' }, // Safari: use wave as hello
  listening: { webm: '/addi/listen_loop.webm', mp4: '/addi/listen_loop.mp4' },
  speaking: { webm: '/addi/talk_loop.webm', mp4: '/addi/talk_loop.mp4' },
};

/** One-shot emotion clips (Ashridge character) */
export const AVATAR_EMOTIONS: Record<AvatarEmotion, AvatarVideoSrc> = {
  clap: { webm: '/addi/emotions/clap.webm', mp4: '/addi/emotions/clap.mp4' },
  confused: { webm: '/addi/emotions/confused.webm', mp4: '/addi/emotions/confused.mp4' },
  dance: { webm: '/addi/emotions/dance.webm', mp4: '/addi/emotions/dance.mp4' },
  idea: { webm: '/addi/emotions/idea.webm', mp4: '/addi/emotions/idea.mp4' },
  laugh: { webm: '/addi/emotions/laugh.webm', mp4: '/addi/emotions/laugh.mp4' },
  love: { webm: '/addi/emotions/love.webm', mp4: '/addi/emotions/love.mp4' },
  no: { webm: '/addi/emotions/no.webm', mp4: '/addi/emotions/no.mp4' },
  prompt: { webm: '/addi/emotions/prompt.webm', mp4: '/addi/emotions/prompt.mp4' },
  shock: { webm: '/addi/emotions/shock.webm', mp4: '/addi/emotions/shock.mp4' },
  think: { webm: '/addi/emotions/think.webm', mp4: '/addi/emotions/think.mp4' },
  thumbsUp: { webm: '/addi/emotions/thumbsUp.webm', mp4: '/addi/emotions/thumbsUp.mp4' },
  wave: { webm: '/addi/emotions/wave.webm', mp4: '/addi/emotions/wave.mp4' },
  yes: { webm: '/addi/emotions/yes.webm', mp4: '/addi/emotions/yes.mp4' },
};
