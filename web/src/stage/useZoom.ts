import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';

export const MAX_ZOOM = 6;

interface ZoomState {
  s: number;
  x: number;
  y: number;
}

const IDENTITY: ZoomState = { s: 1, x: 0, y: 0 };

/**
 * Zoom e arrastar sobre um elemento: roda do mouse (no ponto do cursor),
 * pinça com dois dedos e arrastar quando ampliado.
 */
export function useZoom(containerRef: RefObject<HTMLElement | null>) {
  const [zoom, setZoom] = useState<ZoomState>(IDENTITY);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  // Mantém o conteúdo cobrindo o container (sem "sobrar" borda ao arrastar).
  const clamp = useCallback(
    ({ s, x, y }: ZoomState): ZoomState => {
      const el = containerRef.current;
      const scale = Math.min(MAX_ZOOM, Math.max(1, s));
      if (!el || scale === 1) return IDENTITY;
      const w = el.clientWidth;
      const h = el.clientHeight;
      return {
        s: scale,
        x: Math.min(0, Math.max(w - w * scale, x)),
        y: Math.min(0, Math.max(h - h * scale, y)),
      };
    },
    [containerRef],
  );

  /** Amplia mantendo o ponto (cx, cy) do container parado sob o cursor/dedos. */
  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) =>
      setZoom((prev) => {
        const s = Math.min(MAX_ZOOM, Math.max(1, prev.s * factor));
        const r = s / prev.s;
        return clamp({ s, x: cx - (cx - prev.x) * r, y: cy - (cy - prev.y) * r });
      }),
    [clamp],
  );

  const zoomCenter = useCallback(
    (factor: number) => {
      const el = containerRef.current;
      if (el) zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2);
    },
    [containerRef, zoomAt],
  );

  const reset = useCallback(() => setZoom(IDENTITY), []);

  // Roda do mouse (precisa de listener não-passivo para impedir a rolagem).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    // Ao redimensionar (ex.: tela cheia), reajusta os limites.
    const observer = new ResizeObserver(() => setZoom((prev) => clamp(prev)));
    observer.observe(el);
    return () => {
      el.removeEventListener('wheel', onWheel);
      observer.disconnect();
    };
  }, [containerRef, zoomAt, clamp]);

  const local = (e: PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
  };

  const onPointerMove = (e: PointerEvent) => {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    if (!prev) return;
    const next = local(e);

    if (map.size === 1) {
      // Arrastar (só faz sentido ampliado).
      setZoom((z) => (z.s === 1 ? z : clamp({ ...z, x: z.x + next.x - prev.x, y: z.y + next.y - prev.y })));
    } else if (map.size === 2) {
      // Pinça: escala pela distância entre os dedos, em torno do ponto médio.
      const other = [...map.entries()].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      if (before > 0) zoomAt(after / before, (next.x + other.x) / 2, (next.y + other.y) / 2);
    }
    map.set(e.pointerId, next);
  };

  const onPointerUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
  };

  return {
    scale: zoom.s,
    zoomIn: () => zoomCenter(1.25),
    zoomOut: () => zoomCenter(1 / 1.25),
    reset,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    transform: { transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`, transformOrigin: '0 0' },
  };
}
