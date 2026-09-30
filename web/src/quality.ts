import type { LocalVideoTrack, ScreenShareCaptureOptions, TrackPublishOptions } from 'livekit-client';

export type QualityId = 'texto' | 'equilibrado' | 'movimento' | 'maxima';

export interface QualityPreset {
  id: QualityId;
  label: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  /** bits por segundo */
  maxBitrate: number;
  contentHint: 'detail' | 'text' | 'motion';
  /** O que sacrificar quando a rede aperta. */
  degradation: RTCDegradationPreference;
}

export const QUALITY_PRESETS: QualityPreset[] = [
  {
    id: 'texto',
    label: 'Texto / código',
    description: '1080p · 15 fps — máxima nitidez',
    width: 1920,
    height: 1080,
    fps: 15,
    maxBitrate: 2_500_000,
    contentHint: 'detail',
    degradation: 'maintain-resolution',
  },
  {
    id: 'equilibrado',
    label: 'Equilibrado',
    description: '1080p · 30 fps — uso geral',
    width: 1920,
    height: 1080,
    fps: 30,
    maxBitrate: 4_000_000,
    contentHint: 'detail',
    degradation: 'balanced',
  },
  {
    id: 'movimento',
    label: 'Jogo / vídeo',
    description: '720p · 60 fps — fluidez',
    width: 1280,
    height: 720,
    fps: 60,
    maxBitrate: 4_000_000,
    contentHint: 'motion',
    degradation: 'maintain-framerate',
  },
  {
    id: 'maxima',
    label: 'Máxima',
    description: '1080p · 60 fps — exige boa internet',
    width: 1920,
    height: 1080,
    fps: 60,
    maxBitrate: 7_000_000,
    contentHint: 'motion',
    degradation: 'maintain-framerate',
  },
];

export const DEFAULT_QUALITY: QualityId = 'equilibrado';

export function getPreset(id: QualityId): QualityPreset {
  return QUALITY_PRESETS.find((p) => p.id === id) ?? QUALITY_PRESETS[1];
}

export function captureOptions(preset: QualityPreset, audio: boolean): ScreenShareCaptureOptions {
  return {
    audio,
    systemAudio: audio ? 'include' : 'exclude',
    resolution: { width: preset.width, height: preset.height, frameRate: preset.fps },
    contentHint: preset.contentHint,
    // Evita o "espelho infinito" de compartilhar a própria aba.
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
  };
}

export function publishOptions(preset: QualityPreset): TrackPublishOptions {
  return {
    screenShareEncoding: { maxBitrate: preset.maxBitrate, maxFramerate: preset.fps },
    degradationPreference: preset.degradation,
  };
}

/** Troca a qualidade de um compartilhamento em andamento, sem abrir o seletor de tela de novo. */
export async function applyQuality(track: LocalVideoTrack, preset: QualityPreset): Promise<void> {
  const media = track.mediaStreamTrack;
  media.contentHint = preset.contentHint;
  // "max" reduz a captura sem nunca ampliar além da resolução real da tela.
  await media.applyConstraints({
    width: { max: preset.width },
    height: { max: preset.height },
    frameRate: { max: preset.fps },
  });
  await track.setDegradationPreference(preset.degradation);

  const sender = track.sender;
  if (!sender) return;
  const params = sender.getParameters();
  if (!params.encodings?.length) return;
  // Com simulcast há camadas menores; ajusta só a camada principal (sem redução de escala).
  const main = params.encodings.reduce((best, enc) =>
    (enc.scaleResolutionDownBy ?? 1) < (best.scaleResolutionDownBy ?? 1) ? enc : best,
  );
  main.maxBitrate = preset.maxBitrate;
  main.maxFramerate = preset.fps;
  await sender.setParameters(params);
}
