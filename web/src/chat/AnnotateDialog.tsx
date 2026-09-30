import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowUpRight, Circle, Eraser, Pencil, Square, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Tool = 'arrow' | 'ellipse' | 'rect' | 'pen';

interface Point {
  x: number;
  y: number;
}

interface Shape {
  tool: Tool;
  color: string;
  width: number;
  points: Point[];
}

const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: 'arrow', label: 'Seta', icon: <ArrowUpRight /> },
  { id: 'ellipse', label: 'Círculo', icon: <Circle /> },
  { id: 'rect', label: 'Retângulo', icon: <Square /> },
  { id: 'pen', label: 'Traço livre', icon: <Pencil /> },
];

// Cores de anotação (conteúdo do usuário, não da interface).
const COLORS = [
  { value: '#f0443a', label: 'Vermelho' },
  { value: '#8cf04a', label: 'Verde' },
  { value: '#e3b341', label: 'Amarelo' },
  { value: '#ffffff', label: 'Branco' },
];

function drawShape(g: CanvasRenderingContext2D, shape: Shape) {
  const [a, b] = [shape.points[0], shape.points[shape.points.length - 1]];
  if (!a || !b) return;
  g.strokeStyle = shape.color;
  g.lineWidth = shape.width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  if (shape.tool === 'pen') {
    shape.points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
  } else if (shape.tool === 'rect') {
    g.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  } else if (shape.tool === 'ellipse') {
    g.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
  } else {
    // Seta: linha + ponta com duas abas.
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const head = shape.width * 4 + 10;
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    for (const side of [-1, 1]) {
      g.moveTo(b.x, b.y);
      g.lineTo(b.x - head * Math.cos(angle + side * 0.45), b.y - head * Math.sin(angle + side * 0.45));
    }
  }
  g.stroke();
}

interface Props {
  file: File | null;
  onSave: (file: File) => void;
  onClose: () => void;
}

/** Rabiscar no print antes de enviar: seta, círculo, retângulo e traço livre. */
export function AnnotateDialog({ file, onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [tool, setTool] = useState<Tool>('arrow');
  const [color, setColor] = useState(COLORS[0].value);
  // onClose chega como função nova a cada render; não pode reiniciar o carregamento.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setShapes([]);
    setDraft(null);
    setImage(null);
    if (!file) return;
    let bitmap: ImageBitmap | null = null;
    createImageBitmap(file)
      .then((b) => {
        bitmap = b;
        setImage(b);
      })
      .catch(() => onCloseRef.current());
    return () => bitmap?.close();
  }, [file]);

  // Redesenha tudo na resolução original da imagem.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    canvas.width = image.width;
    canvas.height = image.height;
    const g = canvas.getContext('2d')!;
    g.drawImage(image, 0, 0);
    [...shapes, ...(draft ? [draft] : [])].forEach((s) => drawShape(g, s));
  }, [image, shapes, draft]);

  const toImage = (e: PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!image) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const width = Math.max(3, Math.round(Math.max(image.width, image.height) / 250));
    const p = toImage(e);
    setDraft({ tool, color, width, points: [p, p] });
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!draft) return;
    const p = toImage(e);
    setDraft({ ...draft, points: draft.tool === 'pen' ? [...draft.points, p] : [draft.points[0], p] });
  };

  const onPointerUp = () => {
    if (!draft) return;
    const [a, b] = [draft.points[0], draft.points[draft.points.length - 1]];
    // Ignora cliques sem arrastar.
    if (Math.hypot(b.x - a.x, b.y - a.y) > 3 || draft.points.length > 2) setShapes((s) => [...s, draft]);
    setDraft(null);
  };

  const undo = useCallback(() => setShapes((s) => s.slice(0, -1)), []);

  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, undo]);

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas || !file) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const name = file.name.replace(/\.[^.]+$/, '') + '-anotado.png';
      onSave(new File([blob], name, { type: 'image/png' }));
    }, 'image/png');
  };

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] gap-3 p-3 sm:max-w-5xl" onPointerDownOutside={(e) => draft && e.preventDefault()}>
        <DialogTitle className="text-sm">Rabiscar no print</DialogTitle>
        <DialogDescription className="sr-only">Desenhe setas, círculos ou traços antes de enviar.</DialogDescription>

        <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Ferramentas de desenho">
          {TOOLS.map((t) => (
            <Button
              key={t.id}
              size="icon-sm"
              variant="ghost"
              onClick={() => setTool(t.id)}
              aria-label={t.label}
              aria-pressed={tool === t.id}
              title={t.label}
              className={cn(tool === t.id && 'border border-primary/40 bg-primary/10 text-primary')}
            >
              {t.icon}
            </Button>
          ))}
          <span className="mx-1 h-5 w-px bg-border" />
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              aria-label={`Cor ${c.label}`}
              aria-pressed={color === c.value}
              title={c.label}
              className={cn('size-6 rounded-sm border-2', color === c.value ? 'border-foreground' : 'border-transparent')}
              style={{ backgroundColor: c.value }}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-border" />
          <Button size="sm" variant="ghost" onClick={undo} disabled={shapes.length === 0} title="Desfazer (Ctrl+Z)">
            <Undo2 />
            Desfazer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShapes([])} disabled={shapes.length === 0}>
            <Eraser />
            Limpar
          </Button>
        </div>

        <div className="grid max-h-[70vh] place-items-center overflow-hidden rounded-md bg-black">
          <canvas
            ref={canvasRef}
            aria-label="Área de desenho"
            className="max-h-[70vh] max-w-full cursor-crosshair touch-none object-contain"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!image}>
            Usar imagem
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
