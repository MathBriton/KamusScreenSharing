import { isImageUrl, splitLinks } from './links';
import { SafeImage } from './SafeImage';

interface Props {
  text: string;
  onOpenImage: (url: string) => void;
}

/** Texto com links clicáveis; links diretos de imagem/GIF ganham prévia. */
export function MessageText({ text, onOpenImage }: Props) {
  if (!text) return null;
  const parts = splitLinks(text);
  const imageLinks = parts.filter((p) => p.type === 'link' && isImageUrl(p.url));
  return (
    <>
      <p className="mt-0.5 break-words whitespace-pre-wrap">
        {parts.map((part, i) =>
          part.type === 'text' ? (
            part.value
          ) : (
            <a
              key={i}
              href={part.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              {part.url}
            </a>
          ),
        )}
      </p>
      {imageLinks.map(
        (p, i) =>
          p.type === 'link' && (
            <button key={i} type="button" className="mt-1.5 block" onClick={() => onOpenImage(p.url)}>
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
