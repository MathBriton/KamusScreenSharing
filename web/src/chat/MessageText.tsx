import { Fragment } from 'react';
import { isImageUrl, splitLinks } from './links';
import { splitMentions } from './mentions';
import { SafeImage } from './SafeImage';

interface Props {
  text: string;
  /** Regex das menções conhecidas (ver mentionPattern). */
  mentionPattern?: RegExp | null;
  /** Termo a destacar (resultado de busca). */
  highlight?: string;
  onOpenImage?: (url: string) => void;
  /** Sem prévias de imagem (ex.: citações e resultados de busca). */
  compact?: boolean;
}

function Highlighted({ text, term }: { text: string; term?: string }) {
  if (!term) return <>{text}</>;
  const lower = text.toLocaleLowerCase('pt-BR');
  const needle = term.toLocaleLowerCase('pt-BR');
  const out: React.ReactNode[] = [];
  let from = 0;
  for (let i = lower.indexOf(needle); i !== -1 && needle; i = lower.indexOf(needle, from)) {
    out.push(text.slice(from, i), <mark key={i} className="rounded-sm bg-primary/25 text-foreground">{text.slice(i, i + needle.length)}</mark>);
    from = i + needle.length;
  }
  out.push(text.slice(from));
  return <>{out}</>;
}

/** Texto com links clicáveis e @menções; links diretos de imagem/GIF ganham prévia. */
export function MessageText({ text, mentionPattern, highlight, onOpenImage, compact }: Props) {
  if (!text) return null;
  const parts = splitLinks(text);
  const imageLinks = compact ? [] : parts.filter((p) => p.type === 'link' && isImageUrl(p.url));
  return (
    <>
      <p className="mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere]">
        {parts.map((part, i) =>
          part.type === 'link' ? (
            <a
              key={i}
              href={part.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              <Highlighted text={part.url} term={highlight} />
            </a>
          ) : (
            <Fragment key={i}>
              {splitMentions(part.value, mentionPattern ?? null).map((m, j) =>
                m.type === 'mention' ? (
                  <span key={j} className="rounded-sm bg-primary/15 px-0.5 font-medium text-primary">
                    @{m.name}
                  </span>
                ) : (
                  <Highlighted key={j} text={m.value} term={highlight} />
                ),
              )}
            </Fragment>
          ),
        )}
      </p>
      {imageLinks.map(
        (p, i) =>
          p.type === 'link' && (
            <button key={i} type="button" className="mt-1.5 block" onClick={() => onOpenImage?.(p.url)}>
              <SafeImage
                src={p.url}
                alt="Imagem de link"
                loading="lazy"
                referrerPolicy="no-referrer"
                className="max-h-48 max-w-full rounded-md border object-contain"
              />
            </button>
          ),
      )}
    </>
  );
}
