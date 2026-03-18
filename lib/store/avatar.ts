import { create } from 'zustand';

export type AvatarMode = 'hello' | 'listening' | 'speaking';

export type AvatarEmotion =
  | 'clap'
  | 'confused'
  | 'dance'
  | 'idea'
  | 'laugh'
  | 'love'
  | 'no'
  | 'prompt'
  | 'shock'
  | 'think'
  | 'thumbsUp'
  | 'wave'
  | 'yes';

interface AvatarState {
  mode: AvatarMode;
  emotion: AvatarEmotion | null;
  /** Mode to return to after an emotion clip finishes */
  returnMode: AvatarMode;

  setMode: (mode: AvatarMode) => void;
  showEmotion: (emotion: AvatarEmotion) => void;
  clearEmotion: () => void;
}

export const useAvatarStore = create<AvatarState>()((set, get) => ({
  mode: 'hello',
  emotion: null,
  returnMode: 'listening',

  setMode: (mode) => set({ mode, emotion: null }),

  showEmotion: (emotion) => {
    const current = get();
    set({
      emotion,
      returnMode: current.emotion ? current.returnMode : current.mode,
    });
  },

  clearEmotion: () => {
    const { returnMode } = get();
    set({ emotion: null, mode: returnMode });
  },
}));
