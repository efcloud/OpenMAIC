# Voice Configuration Guide

## Overview

The classroom uses Text-to-Speech (TTS) for three purposes:
1. **Welcome message** — greeting on the landing page (teacher's voice)
2. **Lecture playback** — pre-generated audio for slides (teacher's voice)
3. **Live discussion/QA** — real-time agent responses (per-agent voices)

Each AI agent can have a distinct voice. The teacher avatar (Ashridge/Addi) is male, so the default teacher voice is set to match.

## TTS Provider Priority

On first launch, the system selects a TTS provider automatically:

```
1. Server-configured provider detected?
   YES → Auto-select it (e.g. Qwen TTS if TTS_QWEN_API_KEY is in .env.local)
   NO  → Fall back to browser-native Web Speech API

2. User manually changes provider in Settings?
   → Persisted in localStorage, overrides auto-selection
```

## Voice Resolution Order

When generating speech audio, the voice is resolved in this order:

```
Welcome message:
  teacher agent voiceId → global ttsVoice setting

Lecture playback (pre-generated):
  action.agentId → agent.voiceId → teacher.voiceId → global ttsVoice

Live discussion/QA:
  agent.voiceId → voice pool (hash-based) → global ttsVoice
```

## Default Agent Voices

| Agent | Role | Voice ID | Provider | Gender |
|-------|------|----------|----------|--------|
| AI teacher | teacher | Aiden | Qwen TTS | Male |
| AI assistant | assistant | Serena | Qwen TTS | Female |
| Class clown | student | Pip | Qwen TTS | Male (child) |
| Curious student | student | Cherry | Qwen TTS | Female |
| Note-taker | student | Ethan | Qwen TTS | Male |
| Thinker | student | Vivian | Qwen TTS | Female |

These are set on the default agents in `lib/orchestration/registry/store.ts` via the `voiceId` field.

## LLM-Generated Agents

When the LLM creates custom agents for a classroom (e.g. "Maya Analyze", "Leo Curiosity"), they don't have a `voiceId` set. The system assigns voices dynamically from a pool:

- **Teachers** → `['Aiden', 'Ethan', 'Ryan']`
- **Others (female)** → `['Serena', 'Cherry', 'Vivian', 'Chelsie', 'Mia']`
- **Others (male)** → `['Pip', 'Ethan', 'Kai', 'Neil', 'Mochi']`

Assignment is deterministic: the same `agentId` always gets the same voice (hash-based). Male/female alternates based on the hash.

## Environment Variables

### Qwen TTS (recommended — matches avatar)

```bash
# .env.local
TTS_QWEN_API_KEY=sk-your-key-here
TTS_QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/api/v1
```

On first launch with these set, the system auto-selects Qwen TTS with Aiden voice.

### OpenAI TTS

```bash
TTS_OPENAI_API_KEY=sk-your-key-here
```

Default voice: `alloy` (neutral). Override per-agent voices in the registry.

### Azure TTS

```bash
TTS_AZURE_API_KEY=your-key-here
TTS_AZURE_BASE_URL=https://your-region.tts.speech.microsoft.com
```

Default voice: `zh-CN-XiaoxiaoNeural` (female Chinese).

### No API Key (Browser Fallback)

If no TTS provider is configured, the system uses the browser's Web Speech API:
- Voice depends on the OS/browser (usually female on macOS)
- No control over male/female matching
- Works offline, zero latency
- Quality varies significantly

## Scenarios

### Scenario 1: Fresh install, no .env.local

```
TTS Provider: browser-native-tts
Voice: OS default (no gender control)
Welcome: browser speechSynthesis
Lecture: reading timer only (no audio generated)
Discussion: browser speechSynthesis
Avatar: male (Ashridge) — may mismatch voice
```

### Scenario 2: .env.local with TTS_QWEN_API_KEY

```
TTS Provider: qwen-tts (auto-selected on first run)
Global voice: Aiden (male, matches avatar)
Welcome: Aiden via Qwen TTS
Lecture: Aiden via Qwen TTS (teacher default)
Discussion: per-agent voices (Aiden, Serena, Pip, etc.)
Avatar: male (Ashridge) — matches Aiden voice
```

### Scenario 3: User changes voice in Settings

```
TTS Provider: whatever user selected
Global voice: whatever user selected
Welcome: teacher.voiceId (Aiden) — ignores global override
Lecture: teacher.voiceId (Aiden) — ignores global override
Discussion: per-agent voiceId — ignores global override
```

The global voice setting only applies as a final fallback when no agent voice is configured.

## Customizing Agent Voices

### Default Agents

Edit `lib/orchestration/registry/store.ts`, change the `voiceId` field:

```typescript
'default-1': {
  id: 'default-1',
  name: 'AI teacher',
  role: 'teacher',
  voiceId: 'Aiden', // ← change this
  ...
}
```

### Generated Agent Voice Pool

Edit `lib/audio/live-tts.ts`, modify the voice pools:

```typescript
const VOICE_POOL_TEACHER = ['Aiden', 'Ethan', 'Ryan'];
const VOICE_POOL_FEMALE = ['Serena', 'Cherry', 'Vivian', 'Chelsie', 'Mia'];
const VOICE_POOL_MALE = ['Pip', 'Ethan', 'Kai', 'Neil', 'Mochi'];
```

### Changing the Avatar

The avatar (Ashridge) is male. If you switch to a female avatar, update:
1. The teacher's `voiceId` to a female voice (e.g. `'Serena'`)
2. The `DEFAULT_TTS_VOICES['qwen-tts']` in `lib/audio/constants.ts`
3. The `VOICE_POOL_TEACHER` in `lib/audio/live-tts.ts`

## File Reference

| File | Purpose |
|------|---------|
| `lib/audio/constants.ts` | Default voice per TTS provider (`DEFAULT_TTS_VOICES`) |
| `lib/audio/live-tts.ts` | Live discussion TTS, voice pools, per-agent resolution |
| `lib/orchestration/registry/store.ts` | Default agent configs with `voiceId` |
| `lib/orchestration/registry/types.ts` | `AgentConfig.voiceId` type definition |
| `lib/hooks/use-scene-generator.ts` | Lecture TTS generation with voice override |
| `lib/store/settings.ts` | Global TTS settings, auto-config from server providers |
| `components/avatar-video-overlay.tsx` | Welcome message TTS (uses teacher voice) |
