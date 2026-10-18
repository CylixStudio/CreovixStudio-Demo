import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUpRight } from "lucide-react";

import { LinkInBioGallery } from "@/components/link-in-bio/LinkInBioGallery";
import { LinkInBioPlatformLogo } from "@/components/link-in-bio/LinkInBioPlatformLogo";
import {
  BENTO_COLS,
  BENTO_SIZES,
  bentoSizeOf,
  bentoTilePaint,
  customLinkFaviconUrl,
  packBento,
  sanitizeColSpan,
  sanitizeRowSpan,
  type BentoColSpan,
  type BentoRowSpan,
  type BentoSize,
  type BentoTilePaint,
  type PublicBioLink,
  type LinkInBioTheme,
  type LinkPlatform,
  type LinkTilePreview,
  type LivePlatformFlags,
} from "@/lib/linkInBio";
import { cn } from "@/lib/utils";

const PLATFORM_NAME: Record<PublicBioLink["platform"], string> = {
  kick: "Kick",
  twitch: "Twitch",
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  snapchat: "Snapchat",
  x: "X",
  discord: "Discord",
  whatsapp: "WhatsApp",
  custom: "Link",
};

const GAP = 20;
const ROW = 188;

function cellFromPoint(root: DOMRect, clientX: number, clientY: number, colSpan: number) {
  const cellW = (root.width - GAP * (BENTO_COLS - 1)) / BENTO_COLS;
  const x = Math.min(
    BENTO_COLS - colSpan,
    Math.max(0, Math.floor((clientX - root.left) / (cellW + GAP))),
  );
  const y = Math.max(0, Math.floor((clientY - root.top) / (ROW + GAP)));
  return { x, y };
}

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type SpanPatch = { colSpan: BentoColSpan; rowSpan: BentoRowSpan; gridX: number; gridY: number };

function snapSpan(width: number, height: number, cellW: number): { colSpan: BentoColSpan; rowSpan: BentoRowSpan } {
  const col = Math.round((width + GAP) / (cellW + GAP));
  const row = Math.round((height + GAP) / (ROW + GAP));
  return {
    colSpan: sanitizeColSpan(col),
    rowSpan: sanitizeRowSpan(row),
  };
}

export function LinkInBioBento({
  links,
  theme,
  livePlatforms,
  tilePreviews,
  editable = false,
  arrangeMode = false,
  selectedId,
  onSelect,
  onMove,
  onResize,
}: {
  links: PublicBioLink[];
  theme: LinkInBioTheme;
  livePlatforms?: LivePlatformFlags;
  tilePreviews?: Partial<Record<LinkPlatform, LinkTilePreview>>;
  editable?: boolean;
  arrangeMode?: boolean;
  selectedId?: string | null;
  onSelect?: ((id: string) => void) | undefined;
  onMove?: ((id: string, gridX: number, gridY: number) => void) | undefined;
  onResize?: ((id: string, colSpan: number, rowSpan: number, gridX?: number, gridY?: number) => void) | undefined;
}) {
  const packed = useMemo(() => packBento(links), [links]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [resizePreview, setResizePreview] = useState<{ id: string; colSpan: number; rowSpan: number } | null>(
    null,
  );
  const placed = editable || arrangeMode;
  const maxRow = packed.reduce((max, item) => Math.max(max, item.gridY + item.rowSpan), 2);
  const fill = !placed;

  const commitHoverMove = (id: string, clientX: number, clientY: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    const item = packed.find((link) => link.id === id);
    if (!rect || !item) return;
    const cell = cellFromPoint(rect, clientX, clientY, item.colSpan);
    onMove?.(id, cell.x, cell.y);
  };

  const updateHover = (id: string, clientX: number, clientY: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    const item = packed.find((link) => link.id === id);
    if (!rect || !item) return;
    setHover(cellFromPoint(rect, clientX, clientY, item.colSpan));
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative grid w-full",
        fill && "grid-cols-2 @min-[36rem]:grid-cols-4 @min-[60rem]:grid-cols-6 [grid-auto-flow:dense]",
      )}
      style={{
        gridTemplateColumns: fill ? undefined : `repeat(${BENTO_COLS}, minmax(0, 1fr))`,
        gridAutoRows: `${ROW}px`,
        gap: GAP,
        minHeight: placed ? maxRow * (ROW + GAP) : undefined,
      }}
      onDragOver={(event) => {
        if (!editable || arrangeMode || !dragId) return;
        event.preventDefault();
        updateHover(dragId, event.clientX, event.clientY);
      }}
      onDrop={(event) => {
        if (!editable || arrangeMode || !dragId) return;
        event.preventDefault();
        commitHoverMove(dragId, event.clientX, event.clientY);
        setDragId(null);
        setHover(null);
      }}
    >
      {placed && hover && dragId ? (
        <div
          className="pointer-events-none rounded-[28px] border border-dashed border-white/40 bg-white/5"
          style={{
            gridColumn: `${hover.x + 1} / span ${packed.find((item) => item.id === dragId)?.colSpan ?? 1}`,
            gridRow: `${hover.y + 1} / span ${packed.find((item) => item.id === dragId)?.rowSpan ?? 1}`,
          }}
        />
      ) : null}
      {packed.map((link) => {
        const preview = resizePreview?.id === link.id ? resizePreview : null;
        return (
          <BentoTile
            key={link.id}
            link={
              preview
                ? { ...link, colSpan: sanitizeColSpan(preview.colSpan), rowSpan: sanitizeRowSpan(preview.rowSpan) }
                : link
            }
            live={Boolean(livePlatforms?.[link.platform as keyof LivePlatformFlags] || tilePreviews?.[link.platform]?.live)}
            preview={tilePreviews?.[link.platform]}
            editable={editable && !arrangeMode}
            arrangeMode={arrangeMode}
            fill={fill}
            selected={selectedId === link.id}
            paint={bentoTilePaint(link.platform, theme)}
            onSelect={onSelect}
            onResize={onResize}
            onDragStart={() => setDragId(link.id)}
            onDragEnd={() => {
              setDragId(null);
              setHover(null);
            }}
            onArrangePointerDown={(event) => {
              if ((event.target as HTMLElement).closest("[data-bento-chrome]")) return;
              onSelect?.(link.id);
              setDragId(link.id);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onArrangePointerMove={(event) => {
              if (!dragId || resizePreview) return;
              updateHover(dragId, event.clientX, event.clientY);
            }}
            onArrangePointerUp={(event) => {
              if (!dragId || resizePreview) return;
              const rect = rootRef.current?.getBoundingClientRect();
              const item = packed.find((entry) => entry.id === dragId);
              if (rect && item) {
                const start = cellFromPoint(rect, event.clientX, event.clientY, item.colSpan);
                const current = packed.find((entry) => entry.id === dragId);
                if (!current || start.x !== current.gridX || start.y !== current.gridY) {
                  commitHoverMove(dragId, event.clientX, event.clientY);
                }
              }
              setDragId(null);
              setHover(null);
            }}
            onArrangeResize={(next) => setResizePreview(next ? { id: link.id, ...next } : null)}
          />
        );
      })}
    </div>
  );
}

function BentoTile({
  link,
  live,
  preview,
  editable,
  arrangeMode,
  fill,
  selected,
  paint,
  onSelect,
  onResize,
  onDragStart,
  onDragEnd,
  onArrangePointerDown,
  onArrangePointerMove,
  onArrangePointerUp,
  onArrangeResize,
}: {
  link: PublicBioLink;
  live: boolean;
  preview?: LinkTilePreview | undefined;
  editable: boolean;
  arrangeMode: boolean;
  fill: boolean;
  selected: boolean;
  paint: BentoTilePaint;
  onSelect?: ((id: string) => void) | undefined;
  onResize?: ((id: string, colSpan: number, rowSpan: number, gridX?: number, gridY?: number) => void) | undefined;
  onDragStart: () => void;
  onDragEnd: () => void;
  onArrangePointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onArrangePointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onArrangePointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onArrangeResize: (next: { colSpan: number; rowSpan: number } | null) => void;
}) {
  const name = PLATFORM_NAME[link.platform];
  const large = link.colSpan >= 2 && link.rowSpan >= 2;
  const logoSize = large ? 48 : 40;
  const size = bentoSizeOf(link.colSpan, link.rowSpan);
  const interactive = editable || arrangeMode;

  const applySize = (next: BentoSize) => {
    const found = BENTO_SIZES.find((item) => item.id === next) ?? BENTO_SIZES[0]!;
    onSelect?.(link.id);
    onResize?.(link.id, found.colSpan, found.rowSpan, link.gridX, link.gridY);
  };

  const applySpan = (colSpan: number, rowSpan: number, gridX = link.gridX, gridY = link.gridY) => {
    onSelect?.(link.id);
    onResize?.(link.id, sanitizeColSpan(colSpan), sanitizeRowSpan(rowSpan), gridX, gridY);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!arrangeMode) return;
    const map: Record<string, BentoSize> = { "1": "1x1", "2": "2x1", "3": "1x2", "4": "2x2" };
    if (map[event.key]) {
      event.preventDefault();
      applySize(map[event.key]!);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      applySpan(link.colSpan + 1, link.rowSpan);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      applySpan(link.colSpan - 1, link.rowSpan);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      applySpan(link.colSpan, link.rowSpan + 1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      applySpan(link.colSpan, link.rowSpan - 1);
    }
  };

  const startResize = (dir: ResizeDir) => (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(link.id);
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const tile = handle.closest("[data-tile]") as HTMLElement | null;
    const origin = tile?.getBoundingClientRect();
    const grid = tile?.parentElement?.getBoundingClientRect();
    if (!origin || !grid) return;
    const cellW = (grid.width - GAP * (BENTO_COLS - 1)) / BENTO_COLS;
    const originCol = link.colSpan;
    const originRow = link.rowSpan;
    const originGX = link.gridX;
    const originGY = link.gridY;
    let last: SpanPatch = { colSpan: originCol, rowSpan: originRow, gridX: originGX, gridY: originGY };
    const onMove = (next: PointerEvent) => {
      let width = origin.width;
      let height = origin.height;
      if (dir.includes("e")) width = next.clientX - origin.left;
      if (dir.includes("w")) width = origin.right - next.clientX;
      if (dir.includes("s")) height = next.clientY - origin.top;
      if (dir.includes("n")) height = origin.bottom - next.clientY;
      const snapped = snapSpan(width, height, cellW);
      let gridX = originGX;
      let gridY = originGY;
      if (dir.includes("w")) gridX = Math.max(0, originGX + originCol - snapped.colSpan);
      if (dir.includes("n")) gridY = Math.max(0, originGY + originRow - snapped.rowSpan);
      last = { ...snapped, gridX, gridY };
      onArrangeResize({ colSpan: last.colSpan, rowSpan: last.rowSpan });
    };
    const onUp = () => {
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      onArrangeResize(null);
      onResize?.(link.id, last.colSpan, last.rowSpan, last.gridX, last.gridY);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  };

  const frost = paint.glass ? (
    <span
      className="pointer-events-none absolute inset-0 rounded-[28px]"
      style={{
        background: paint.fill,
        backdropFilter: paint.backdropFilter,
        WebkitBackdropFilter: paint.backdropFilter,
      }}
      aria-hidden
    />
  ) : null;

  const inner =
    link.kind === "gallery" ? (
      <div className="relative z-[1] flex h-full flex-col p-4">
        <LinkInBioGallery images={link.galleryImages} title={link.title} className="min-h-0 flex-1" />
      </div>
    ) : (
      <>
        {paint.wash ? (
          <span className="pointer-events-none absolute inset-0 z-[1]" style={{ background: paint.wash }} aria-hidden />
        ) : null}
        <span className="sr-only">{name}</span>
        <span
          className="absolute start-5 top-5 z-[1] grid place-items-center"
          style={{
            width: paint.glass ? logoSize + 14 : logoSize,
            height: paint.glass ? logoSize + 14 : logoSize,
            ...(paint.glass
              ? {
                  borderRadius: 16,
                  background: paint.onLight ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.08)",
                  border: paint.onLight ? "1px solid rgba(255,255,255,0.86)" : "1px solid rgba(255,255,255,0.22)",
                  boxShadow: paint.onLight
                    ? "inset 0 1px 0 rgba(255,255,255,0.95), 0 8px 22px rgba(15,23,32,0.07)"
                    : "inset 0 1px 0 rgba(255,255,255,0.22), 0 8px 22px rgba(0,0,0,0.4)",
                  backdropFilter: "blur(18px) saturate(1.65)",
                  WebkitBackdropFilter: "blur(18px) saturate(1.65)",
                }
              : {}),
          }}
        >
          <LinkInBioPlatformLogo
            key={`${link.id}-mark-${
              paint.whiteIcons
                ? paint.onLight
                  ? "glow-light"
                  : "glow-dark"
                : paint.monoIcons
                  ? paint.onLight
                    ? "mono-light"
                    : "mono-dark"
                  : "brand"
            }`}
            platform={link.platform}
            size={paint.glass ? logoSize - 4 : logoSize}
            ink={paint.ink}
            onLight={paint.onLight}
            whiteIcons={paint.whiteIcons}
            monoIcons={paint.monoIcons}
            faviconUrl={link.platform === "custom" ? customLinkFaviconUrl(link.url) : null}
          />
        </span>
        {live ? (
          <span className="absolute end-5 top-5 z-[1] rounded-full bg-red-500 px-1.5 py-0.5 text-[0.55rem] font-bold tracking-wide text-white">
            LIVE
          </span>
        ) : null}
        {preview?.thumbnailUrl ? (
          <img
            src={preview.thumbnailUrl}
            alt=""
            className="pointer-events-none absolute bottom-12 start-5 z-0 h-10 w-[3.6rem] rounded-md object-cover opacity-90"
          />
        ) : null}
        {!arrangeMode ? (
          <span
            className="pointer-events-none absolute bottom-5 end-5 z-[1] grid size-8 place-items-center rounded-full border"
            style={{
              borderColor: paint.monoIcons
                ? paint.onLight
                  ? "#cfd4da"
                  : "rgba(255,255,255,0.22)"
                : paint.onLight
                  ? "color-mix(in oklab, #000000 22%, transparent)"
                  : "color-mix(in oklab, #ffffff 42%, transparent)",
              color: paint.monoIcons
                ? paint.onLight
                  ? "#111111"
                  : "#f5f5f5"
                : paint.onLight
                  ? "color-mix(in oklab, #000000 72%, transparent)"
                  : "color-mix(in oklab, #ffffff 78%, transparent)",
              background: paint.glass
                ? paint.onLight
                  ? "rgba(255,255,255,0.32)"
                  : "rgba(255,255,255,0.08)"
                : paint.monoIcons
                  ? paint.onLight
                    ? "rgba(17,17,17,0.06)"
                    : "rgba(255,255,255,0.08)"
                  : undefined,
              backdropFilter: paint.glass ? "blur(14px) saturate(1.55)" : undefined,
              WebkitBackdropFilter: paint.glass ? "blur(14px) saturate(1.55)" : undefined,
            }}
            aria-hidden
          >
            <ArrowUpRight className="size-3.5" strokeWidth={2.4} />
          </span>
        ) : null}
      </>
    );

  const chrome = arrangeMode && selected && onResize ? (
    <>
      <div
        data-bento-chrome
        className="absolute inset-x-3 bottom-3 z-10 flex -translate-y-0 justify-center gap-1 rounded-full bg-black/55 p-1 backdrop-blur-md"
      >
        {BENTO_SIZES.map((item) => (
          <button
            key={item.id}
            type="button"
            data-bento-chrome
            className={cn(
              "rounded-full px-2.5 py-1 text-[0.62rem] font-medium",
              size === item.id ? "bg-white text-black" : "text-white/75 hover:bg-white/10",
            )}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              applySize(item.id);
            }}
          >
            {item.id.replace("x", "×")}
          </button>
        ))}
      </div>
      <button
        type="button"
        data-bento-chrome
        data-resize="n"
        aria-label={`Resize ${name} from top`}
        className="absolute inset-x-4 top-0 z-10 h-2 cursor-n-resize rounded-sm bg-white/25"
        onPointerDown={startResize("n")}
      />
      <button
        type="button"
        data-bento-chrome
        data-resize="s"
        aria-label={`Resize ${name} from bottom`}
        className="absolute inset-x-4 bottom-0 z-10 h-2 cursor-s-resize rounded-sm bg-white/25"
        onPointerDown={startResize("s")}
      />
      <button
        type="button"
        data-bento-chrome
        data-resize="e"
        aria-label={`Resize ${name} from right`}
        className="absolute inset-y-4 right-0 z-10 w-2 cursor-e-resize rounded-sm bg-white/25"
        onPointerDown={startResize("e")}
      />
      <button
        type="button"
        data-bento-chrome
        data-resize="w"
        aria-label={`Resize ${name} from left`}
        className="absolute inset-y-4 left-0 z-10 w-2 cursor-w-resize rounded-sm bg-white/25"
        onPointerDown={startResize("w")}
      />
      <button
        type="button"
        data-bento-chrome
        data-resize="se"
        aria-label={`Resize ${name} from corner`}
        className="absolute bottom-0 right-0 z-10 size-3.5 cursor-se-resize rounded-sm border border-white/70 bg-white/50"
        onPointerDown={startResize("se")}
      />
      <button
        type="button"
        data-bento-chrome
        data-resize="sw"
        aria-label={`Resize ${name} from bottom left`}
        className="absolute bottom-0 left-0 z-10 size-3.5 cursor-sw-resize rounded-sm border border-white/70 bg-white/50"
        onPointerDown={startResize("sw")}
      />
      <button
        type="button"
        data-bento-chrome
        data-resize="ne"
        aria-label={`Resize ${name} from top right`}
        className="absolute top-0 right-0 z-10 size-3.5 cursor-ne-resize rounded-sm border border-white/70 bg-white/50"
        onPointerDown={startResize("ne")}
      />
      <button
        type="button"
        data-bento-chrome
        data-resize="nw"
        aria-label={`Resize ${name} from top left`}
        className="absolute top-0 left-0 z-10 size-3.5 cursor-nw-resize rounded-sm border border-white/70 bg-white/50"
        onPointerDown={startResize("nw")}
      />
    </>
  ) : null;

  const sharedClass = cn(
    "relative isolate overflow-hidden rounded-[28px] outline-none transition-transform",
    !interactive && "hover:-translate-y-0.5",
    selected && "ring-2 ring-violet-400/75 ring-offset-2 ring-offset-transparent",
    arrangeMode && "cursor-grab active:cursor-grabbing",
  );
  const sharedStyle = {
    gridColumn: fill ? `span ${link.colSpan}` : `${link.gridX + 1} / span ${link.colSpan}`,
    gridRow: fill ? `span ${link.rowSpan}` : `${link.gridY + 1} / span ${link.rowSpan}`,
    background: paint.glass ? "transparent" : paint.fill,
    border: paint.border,
    boxShadow: paint.boxShadow,
  } as const;

  if (arrangeMode) {
    return (
      <div
        data-tile
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`${name}, ${link.colSpan} by ${link.rowSpan}. Drag to move. Drag edges to resize.`}
        onPointerDown={onArrangePointerDown}
        onPointerMove={onArrangePointerMove}
        onPointerUp={onArrangePointerUp}
        onClick={() => onSelect?.(link.id)}
        onKeyDown={onKeyDown}
        className={sharedClass}
        style={sharedStyle}
      >
        {frost}
        {inner}
        {chrome}
      </div>
    );
  }

  if (editable) {
    return (
      <button
        type="button"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={() => onSelect?.(link.id)}
        className={cn(sharedClass, "cursor-grab active:cursor-grabbing")}
        style={sharedStyle}
        aria-label={name}
      >
        {frost}
        {inner}
      </button>
    );
  }

  if (link.kind === "gallery") {
    return (
      <div className={sharedClass} style={sharedStyle}>
        {frost}
        {inner}
      </div>
    );
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={sharedClass}
      style={sharedStyle}
      aria-label={name}
    >
      {frost}
      {inner}
    </a>
  );
}
