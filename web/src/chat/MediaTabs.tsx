import { ExternalLink, ImageIcon, ImageOff, Link2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatTime, hostOf, type GalleryImage, type SharedLink } from './links';
import { SafeImage } from './SafeImage';

export function ImagesTab({ images, onOpen }: { images: GalleryImage[]; onOpen: (img: GalleryImage) => void }) {
  if (images.length === 0) {
    return (
      <Empty icon={<ImageIcon />} text="Nenhuma imagem ainda. Cole um print (Ctrl+V) ou um link de GIF no chat." />
    );
  }
  return (
    <ScrollArea className="min-h-0 flex-1">
      <ul className="grid grid-cols-3 gap-2 pr-3">
        {images.map((img) => (
          <li key={img.key}>
            <button
              type="button"
              onClick={() => onOpen(img)}
              className="group relative block aspect-square w-full overflow-hidden rounded-md border bg-muted"
              title={`${img.author} · ${formatTime(img.createdAt)}`}
            >
              <SafeImage
                fallback={
                  <span className="grid size-full place-items-center text-xs text-muted-foreground">
                    <span className="grid justify-items-center gap-1">
                      <ImageOff className="size-5" />
                      indisponível
                    </span>
                  </span>
                }
                src={img.url}
                alt={`Imagem de ${img.author}`}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="size-full object-cover transition-transform group-hover:scale-105"
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-left text-[10px] text-white">
                {img.author} · {formatTime(img.createdAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}

export function LinksTab({ links }: { links: SharedLink[] }) {
  if (links.length === 0) {
    return <Empty icon={<Link2 />} text="Nenhum link ainda. Links enviados no chat aparecem aqui." />;
  }
  return (
    <ScrollArea className="min-h-0 flex-1">
      <ul className="grid gap-1 pr-3">
        {links.map((l) => (
          <li key={l.key}>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="group flex items-start gap-2 rounded-md p-2 hover:bg-accent"
            >
              <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="grid min-w-0 gap-0.5">
                <span className="truncate text-sm font-medium">{hostOf(l.url)}</span>
                <span className="truncate text-xs text-blue-600 group-hover:underline dark:text-blue-400">{l.url}</span>
                <span className="text-xs text-muted-foreground">
                  {l.author} · {formatTime(l.createdAt)}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="grid flex-1 place-items-center p-4 text-center text-sm text-muted-foreground [&_svg]:mx-auto [&_svg]:mb-2 [&_svg]:size-6">
      <div>
        {icon}
        {text}
      </div>
    </div>
  );
}
