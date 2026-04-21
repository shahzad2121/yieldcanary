import { Expand } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type ZoomableImageProps = {
  src: string;
  alt: string;
  frameClassName?: string;
  imageClassName?: string;
};

export function ZoomableImage({
  src,
  alt,
  frameClassName = '',
  imageClassName = 'block h-auto w-full',
}: ZoomableImageProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group relative block w-full cursor-zoom-in rounded-[inherit] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Open image preview: ${alt}`}
        >
          <div className={frameClassName}>
            <img
              src={src}
              alt={alt}
              className={imageClassName}
              loading="lazy"
              decoding="async"
            />
          </div>
          <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-background/85 px-2 py-1 text-[11px] font-medium text-foreground opacity-0 shadow-sm ring-1 ring-border/60 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Expand className="h-3.5 w-3.5" />
            Expand
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="w-[min(96vw,1400px)] max-w-7xl border-border/60 bg-background/95 p-2 sm:p-3 [&>button]:right-3 [&>button]:top-3 [&>button]:rounded-md [&>button]:bg-primary [&>button]:p-2 [&>button]:text-primary-foreground [&>button]:opacity-100 [&>button]:ring-1 [&>button]:ring-primary/30 [&>button]:shadow-md [&>button]:hover:bg-primary/90 [&>button]:focus:ring-primary/40 [&>button_svg]:h-4 [&>button_svg]:w-4">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div className="custom-scrollbar max-h-[88vh] overflow-auto rounded-md pr-1">
          <img
            src={src}
            alt={alt}
            className="mx-auto h-auto w-full rounded-md object-contain"
            decoding="async"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
