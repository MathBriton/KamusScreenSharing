import { useEffect, useRef, useState } from 'react';
import { LocalVideoTrack, RemoteVideoTrack, type Room, type VideoTrack } from 'livekit-client';

const INTERVAL_MS = 2000;

/** Ping (RTT da sinalização com o LiveKit), em ms. */
export function usePing(room: Room, connected: boolean): number | null {
  const [ping, setPing] = useState<number | null>(null);
  useEffect(() => {
    if (!connected) return;
    const read = () => {
      const rtt = room.engine?.client?.rtt;
      setPing(typeof rtt === 'number' && rtt > 0 ? Math.round(rtt) : null);
    };
    read();
    const id = setInterval(read, INTERVAL_MS);
    return () => clearInterval(id);
  }, [room, connected]);
  return ping;
}

export interface StreamStats {
  width?: number;
  height?: number;
  fps?: number;
  /** kbps */
  bitrate?: number;
}

interface Sample {
  bytes: number;
  frames: number;
  at: number;
}

/**
 * Resolução, FPS e bitrate de uma transmissão, pelas estatísticas do WebRTC:
 * enviadas (se for a sua) ou recebidas (se for de outra pessoa).
 */
export function useStreamStats(track: VideoTrack | undefined): StreamStats | null {
  const [stats, setStats] = useState<StreamStats | null>(null);
  const last = useRef<Sample | null>(null);

  useEffect(() => {
    last.current = null;
    setStats(null);
    if (!track) return;
    let cancelled = false;

    const read = async () => {
      try {
        let sample: Sample;
        let result: StreamStats;
        if (track instanceof LocalVideoTrack) {
          const layers = await track.getSenderStats();
          if (!layers.length) return;
          const top = layers.reduce((a, b) => ((b.frameWidth ?? 0) > (a.frameWidth ?? 0) ? b : a));
          sample = {
            bytes: layers.reduce((sum, l) => sum + (l.bytesSent ?? 0), 0),
            frames: top.framesSent ?? 0,
            at: top.timestamp,
          };
          result = { width: top.frameWidth, height: top.frameHeight, fps: top.framesPerSecond };
        } else if (track instanceof RemoteVideoTrack) {
          const s = await track.getReceiverStats();
          if (!s) return;
          sample = { bytes: s.bytesReceived ?? 0, frames: s.framesDecoded ?? 0, at: s.timestamp };
          result = { width: s.frameWidth, height: s.frameHeight };
        } else {
          return;
        }

        const prev = last.current;
        last.current = sample;
        if (prev && sample.at > prev.at) {
          const seconds = (sample.at - prev.at) / 1000;
          result.bitrate = Math.max(0, Math.round(((sample.bytes - prev.bytes) * 8) / 1000 / seconds));
          result.fps ??= Math.max(0, Math.round((sample.frames - prev.frames) / seconds));
        }
        if (!cancelled) setStats(result);
      } catch {
        // Estatísticas indisponíveis (ex.: trilha encerrando): ignora esta leitura.
      }
    };

    void read();
    const id = setInterval(read, INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [track]);

  return stats;
}

export function formatBitrate(kbps: number | undefined): string {
  if (kbps === undefined) return '—';
  return kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${kbps} kbps`;
}

/** Duração desde `since` (ms), atualizada a cada segundo: "01:24:17". */
export function useElapsed(since: number | null): string | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since]);
  if (!since) return null;
  const total = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
