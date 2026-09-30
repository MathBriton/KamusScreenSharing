import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { ImagePlus, Loader2, SendHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export const MAX_TEXT = 2000;
const MAX_FILES = 10;
const MAX_FILE_MB = 10;

interface Pending {
  file: File;
  preview: string;
}

interface Props {
  disabled: boolean;
  onSend: (text: string, files: File[]) => Promise<void>;
  /** Arquivos soltos em cima do painel (arrastar e soltar). */
  droppedFiles: File[];
  onDroppedConsumed: () => void;
}

export function Composer({ disabled, onSend, droppedFiles, onDroppedConsumed }: Props) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const addFiles = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length < files.length) toast.error('Só dá para enviar imagens (PNG, JPEG, GIF ou WebP).');
    const ok = images.filter((f) => {
      if (f.size <= MAX_FILE_MB * 1024 * 1024) return true;
      toast.error(`"${f.name}" passa de ${MAX_FILE_MB} MB.`);
      return false;
    });
    setPending((prev) =>
      [...prev, ...ok.map((file) => ({ file, preview: URL.createObjectURL(file) }))].slice(0, MAX_FILES),
    );
  };

  useEffect(() => {
    if (droppedFiles.length) {
      addFiles(droppedFiles);
      onDroppedConsumed();
    }
  }, [droppedFiles]);

  const remove = (index: number) =>
    setPending((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if ((!body && pending.length === 0) || sending || disabled) return;
    setSending(true);
    try {
      await onSend(body, pending.map((p) => p.file));
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setPending([]);
      setText('');
    } catch (err) {
      toast.error('Não foi possível enviar', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSending(false);
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    const files = [...e.clipboardData.files];
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <form className="mt-3 grid gap-2" onSubmit={submit}>
      {pending.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Imagens a enviar">
          {pending.map((p, i) => (
            <li key={p.preview} className="relative">
              <img src={p.preview} alt={p.file.name} className="size-16 rounded-md border object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-foreground text-background"
                aria-label={`Remover ${p.file.name}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          hidden
          onChange={(e) => {
            addFiles([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          onClick={() => fileInput.current?.click()}
          aria-label="Anexar imagem"
          title="Anexar imagem (ou cole com Ctrl+V)"
        >
          <ImagePlus />
        </Button>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          placeholder={disabled ? 'Conectando…' : 'Mensagem, link ou cole um print…'}
          maxLength={MAX_TEXT}
          disabled={disabled}
          rows={1}
          className="max-h-32 min-h-9 resize-none py-2"
          aria-label="Mensagem"
        />
        <Button
          type="submit"
          size="icon"
          disabled={disabled || sending || (!text.trim() && pending.length === 0)}
          aria-label="Enviar"
        >
          {sending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
        </Button>
      </div>
    </form>
  );
}
