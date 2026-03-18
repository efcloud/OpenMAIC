import type { AvatarEmotion } from '@/lib/store/avatar';

export const TEACHER_AVATAR = '/addi/img.png';

/** Video loops — keyed by avatar mode */
export const AVATAR_LOOPS: Record<string, string> = {
  hello: '/addi/hello.webm',
  listening: '/addi/listen_loop.webm',
  speaking: '/addi/talk_loop.webm',
};

/** One-shot emotion clips (Ashridge character) */
export const AVATAR_EMOTIONS: Record<AvatarEmotion, string> = {
  clap: '/addi/emotions/clap.webm',
  confused: '/addi/emotions/confused.webm',
  dance: '/addi/emotions/dance.webm',
  idea: '/addi/emotions/idea.webm',
  laugh: '/addi/emotions/laugh.webm',
  love: '/addi/emotions/love.webm',
  no: '/addi/emotions/no.webm',
  prompt: '/addi/emotions/prompt.webm',
  shock: '/addi/emotions/shock.webm',
  think: '/addi/emotions/think.webm',
  thumbsUp: '/addi/emotions/thumbsUp.webm',
  wave: '/addi/emotions/wave.webm',
  yes: '/addi/emotions/yes.webm',
};
