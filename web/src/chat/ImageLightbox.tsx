import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export interface LightboxImage {
  url: string;
  caption?: string;
}

interface Props {
  image: LightboxImage | null;
  onClose: () => void;
}

export function ImageLightbox({ image, onClose }: Props) {
  return (
    <Dialog open={!!image} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] gap-2 p-2 sm:max-w-5xl">
        <DialogTitle className="sr-only">Imagem</DialogTitle>
        {image && (
          <>
            <img
              src={image.url}
              alt={image.caption ?? 'Imagem'}
              referrerPolicy="no-referrer"
              className="max-h-[80vh] w-full rounded-md object-contain"
            />
            <DialogDescription asChild>
              <div className="flex items-center justify-between gap-2 px-1 text-xs">
                <span>{image.caption}</span>
                <a
                  href={image.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                >
                  <ExternalLink className="size-3" />
                  Abrir original
                </a>
              </div>
            </DialogDescription>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
