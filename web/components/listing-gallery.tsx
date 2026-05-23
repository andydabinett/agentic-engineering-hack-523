"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ListingGalleryProps {
  photos: string[];
  alt: string;
}

const FALLBACK =
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80";

export function ListingGallery({ photos, alt }: ListingGalleryProps) {
  const [active, setActive] = useState(0);
  const gallery = photos.length > 0 ? photos : [FALLBACK];
  const current = gallery[active] ?? gallery[0];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-rule bg-surface-raised">
        <Image
          key={current}
          src={current}
          alt={alt}
          fill
          priority
          sizes="(max-width: 1280px) 100vw, 1200px"
          className="object-cover animate-fade-up"
          unoptimized
        />
      </div>
      <ul className="grid grid-cols-5 gap-2">
        {gallery.slice(0, 5).map((p, i) => (
          <li key={`${p}-${i}`}>
            <button
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1}`}
              className={cn(
                "relative aspect-[4/3] w-full overflow-hidden rounded-md border transition",
                i === active
                  ? "border-accent ring-2 ring-accent/30"
                  : "border-rule hover:border-rule-strong opacity-80 hover:opacity-100",
              )}
            >
              <Image
                src={p}
                alt={`${alt} photo ${i + 1}`}
                fill
                sizes="200px"
                className="object-cover"
                unoptimized
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
