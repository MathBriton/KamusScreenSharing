import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { ImagePlus, Loader2, Pencil, SendHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/api';
import { AnnotateDialog } from './AnnotateDialog';
import { fold, mentionQueryAt } from './mentions';
import { ReplyQuote } from './MessageItem';

export const MAX_TEXT = 2000;
const MAX_FILES = 10;
const MAX_FILE_MB = 10;

interface Pending {
  file: File;
  preview: string;
}

interface Props {
  disabled: boolean;
  onSend: (text: string, files: File[], replyTo?: string) => Promise<void>;
  /** Arquivos soltos em cima do painel (arrastar e soltar). */
  droppedFiles: File[];
  onDroppedConsumed: () => void;
  /** Nomes para o autocompletar de @menção (sem o próprio). */
  names: string[];
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  onTyping: () => void;
  onStopTyping: () => void;
}

export function Composer(props: Props) {
  const { disabled, onSend, droppedFiles, onDroppedConsumed, names, replyTo, onCancelReply } = props;
  const [text, setText] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [caret, setCaret] = useState(0);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const [suggestClosed, setSuggestClosed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  /** Posição do cursor a aplicar depois de inserir uma menção. */
  const pendingCaret = useRef<number | null>(null);

  // Aplica o cursor logo após a atualização, antes da próxima tecla (evita letras fora de ordem).
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !textarea.current) return;
    textarea.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [text]);

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

  // Ao escolher "Responder", o cursor vai para o campo.
  useEffect(() => {
    if (replyTo) textarea.current?.focus();
  }, [replyTo]);

  const remove = (index: number) =>
    setPending((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });

  const replaceFile = (index: number, file: File) =>
    setPending((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        URL.revokeObjectURL(p.preview);
        return { file, preview: URL.createObjectURL(file) };
      }),
    );

  // ---- Autocompletar de @menção ----
  const mention = suggestClosed ? null : mentionQueryAt(text, caret);
  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = fold(mention.query);
    return [...new Set(names)].filter((n) => fold(n).startsWith(q)).slice(0, 6);
  }, [mention?.query, names]);
  const showSuggestions = suggestions.length > 0;

  const pickSuggestion = (name: string) => {
    if (!mention) return;
    const next = `${text.slice(0, mention.start)}@${name} ${text.slice(caret)}`;
    const position = mention.start + name.length + 2;
    pendingCaret.current = position;
    setText(next);
    setCaret(position);
    textarea.current?.focus();
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if ((!body && pending.length === 0) || sending || disabled) return;
    setSending(true);
    try {
      await onSend(body, pending.map((p) => p.file), replyTo?.id);
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setPending([]);
      setText('');
      setCaret(0);
      onCancelReply();
      props.onStopTyping();
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
    if (showSuggestions) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        setSuggestIndex((i) => (i + delta + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickSuggestion(suggestions[Math.min(suggestIndex, suggestions.length - 1)]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSuggestClosed(true);
        return;
      }
    }
    if (e.key === 'Escape' && replyTo) {
      onCancelReply();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <form className="relative mt-3 grid min-w-0 grid-cols-1 gap-2" onSubmit={submit}>
      {replyTo && (
        <div className="flex items-center gap-2 rounded-md border bg-surface-2/50 px-2 py-1.5" aria-label="Respondendo">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] text-muted-foreground">Respondendo</span>
            <ReplyQuote
              reply={{
                id: replyTo.id,
                author: replyTo.author,
                text: replyTo.text,
                hasImage: replyTo.attachments.length > 0,
              }}
            />
          </div>
          <Button type="button" size="icon-xs" variant="ghost" onClick={onCancelReply} aria-label="Cancelar resposta">
            <X />
          </Button>
        </div>
      )}

      {pending.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Imagens a enviar">
          {pending.map((p, i) => (
            <li key={p.preview} className="group/pending relative">
              <img src={p.preview} alt={p.file.name} className="size-16 rounded-md border object-cover" />
              {p.file.type !== 'image/gif' && (
                <button
                  type="button"
                  onClick={() => setEditing(i)}
                  className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-md bg-black/75 py-0.5 text-[10px] text-white"
                  aria-label={`Rabiscar em ${p.file.name}`}
                >
                  <Pencil className="size-3" />
                  rabiscar
                </button>
              )}
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

      {showSuggestions && (
        <ul
          role="listbox"
          aria-label="Mencionar"
          className="absolute bottom-full left-10 z-20 mb-1 grid min-w-44 gap-0.5 rounded-md border bg-popover p-1 shadow-md"
        >
          {suggestions.map((name, i) => (
            <li key={name} role="option" aria-selected={i === suggestIndex}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickSuggestion(name);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm',
                  i === suggestIndex ? 'bg-primary/10 text-primary' : 'hover:bg-surface-2',
                )}
              >
                <span className="grid size-5 place-items-center rounded-sm bg-surface-2 text-[10px] font-semibold uppercase text-foreground">
                  {name.charAt(0)}
                </span>
                {name}
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
          ref={textarea}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart);
            setSuggestIndex(0);
            setSuggestClosed(false);
            if (e.target.value.trim()) props.onTyping();
            else props.onStopTyping();
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onBlur={() => props.onStopTyping()}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          placeholder={disabled ? 'Conectando…' : 'Mensagem, @menção, link ou cole um print…'}
          maxLength={MAX_TEXT}
          disabled={disabled}
          rows={1}
          className="max-h-32 min-h-9 resize-none py-2"
          aria-label="Mensagem"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
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

      <AnnotateDialog
        file={editing !== null ? (pending[editing]?.file ?? null) : null}
        onClose={() => setEditing(null)}
        onSave={(file) => {
          if (editing !== null) replaceFile(editing, file);
          setEditing(null);
        }}
      />
    </form>
  );
}
