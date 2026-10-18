import { useEffect, useState } from "react";

import { LinkInBioText } from "@/components/link-in-bio/LinkInBioText";
import type { GalleryImage } from "@/lib/linkInBio";
import { cn } from "@/lib/utils";

export function LinkInBioGallery({
  images,
  title,
  className,
}: {
  images: GalleryImage[];
  title?: string;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduce || images.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % images.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, [images.length, reduce]);

  if (images.length === 0) {
    return (
      <div
        className={cn("grid h-full place-items-center px-4 text-sm", className)}
        style={{ color: "var(--bio-muted)" }}
      >
        Add photos to this gallery
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-28 flex-col gap-3", className)}>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[22px]">
        {images.map((image, imageIndex) => (
          <img
            key={image.id}
            src={image.url}
            alt=""
            className="absolute inset-0 size-full object-cover"
            style={{
              opacity: imageIndex === index ? 1 : 0,
              transform: reduce ? undefined : imageIndex === index ? "scale(1)" : "scale(1.04)",
              transition: reduce ? "none" : "opacity 800ms ease, transform 900ms ease",
            }}
          />
        ))}
      </div>
      {(title || images.length > 1) && (
        <div className="flex items-center justify-between gap-3 px-0.5">
          {title ? (
            <LinkInBioText className="min-w-0 flex-1 text-[0.8rem] font-medium" style={{ color: "var(--bio-fg)" }}>
              {title}
            </LinkInBioText>
          ) : (
            <span />
          )}
          {images.length > 1 ? (
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Gallery slides">
              {images.map((image, imageIndex) => (
                <span
                  key={image.id}
                  className="rounded-full"
                  style={{
                    width: imageIndex === index ? 16 : 7,
                    height: 7,
                    background:
                      imageIndex === index
                        ? "color-mix(in oklab, var(--bio-fg) 82%, transparent)"
                        : "color-mix(in oklab, var(--bio-fg) 28%, transparent)",
                    transition: reduce ? "none" : "width 280ms ease, background-color 280ms ease",
                  }}
                  aria-current={imageIndex === index ? "true" : undefined}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
