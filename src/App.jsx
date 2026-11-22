import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from "framer-motion";
import CommissionPage from "./CommissionPage";
import { commissionLink, INSTAGRAM_URL } from "./commissions";

const TAU = Math.PI * 2;
const landingTitle = "sycophantic, prophetic, socratic junkie wannabe";
const DesktopGallery = lazy(() => import("./DesktopGallery"));

const artworkImageModules = import.meta.glob("../art/*.{avif,gif,jpeg,jpg,png,webp}", {
  eager: true,
  import: "default",
  query: "?url",
});

const artworkThumbnailModules = import.meta.glob("../art/thumbnails/*.{avif,gif,jpeg,jpg,png,webp}", {
  eager: true,
  import: "default",
  query: "?url",
});

function titleFromArtworkPath(path) {
  const fileName = path.split("/").pop() ?? "Untitled";
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function artworkFormatRank(path) {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return { webp: 0, avif: 1, jpg: 2, jpeg: 2, png: 3, gif: 4 }[extension] ?? 5;
}

const artworkEntries = Array.from(
  Object.entries(artworkImageModules).reduce((selected, [path, image]) => {
    const title = titleFromArtworkPath(path);
    const current = selected.get(title);

    if (!current || artworkFormatRank(path) < artworkFormatRank(current.path)) {
      selected.set(title, { path, image, title });
    }

    return selected;
  }, new Map()).values()
).sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" }));

const artworkThumbnails = new Map(
  Object.entries(artworkThumbnailModules).map(([path, image]) => [titleFromArtworkPath(path), image])
);

const artworks = artworkEntries.map(({ image, title }) => ({
  title,
  image,
  thumbnail: artworkThumbnails.get(title) ?? image,
  year: "2026",
  medium: "Portfolio study",
}));

const studioNotes = [
  {
    title: "Why the strip loops",
    date: "The gallery",
    summary:
      "A Möbius strip has one continuous surface. I used that shape to make a gallery you can turn and return to, instead of a row of images with an obvious beginning and end.",
  },
  {
    title: "Character studies",
    date: "The archive",
    summary:
      "The archive brings together drawings of characters from manga, anime, and animation. They’re a record of what I notice in those designs, from a silhouette to a pose or expression.",
  },
  {
    title: "Starting a commission",
    date: "The studio",
    summary:
      "A subject, a deadline, and a few references are enough to start. If a piece in the archive has the mood or treatment you want, mention its title when you get in touch.",
  },
];

const routes = [
  { path: "/", label: "Home" },
  { path: "/work", label: "Browse art" },
  { path: "/about", label: "About" },
  { path: "/journal", label: "Journal" },
  { path: "/commissions", label: "Get a quote" },
];

function readLocation() {
  const [hashPath, search = ""] = window.location.hash.slice(1).split("?");
  const legacyPath = "/" + (window.location.pathname.split("/").filter(Boolean).at(-1) ?? "");
  const path = hashPath.startsWith("/") ? hashPath.replace(/\/+$/, "") || "/" : legacyPath;
  const params = new URLSearchParams(search);
  const isContact = path === "/contact";

  return {
    path: isContact ? "/commissions" : routes.find((route) => route.path === path)?.path ?? "/",
    type: isContact ? "general" : params.get("type"),
    isContact,
    reference: params.get("reference"),
  };
}

function mod(n, m) {
  return ((n % m) + m) % m;
}

function useDocumentVisibility() {
  const [isVisible, setIsVisible] = useState(() => document.visibilityState !== "hidden");

  useEffect(() => {
    function syncVisibility() {
      setIsVisible(document.visibilityState !== "hidden");
    }

    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  return isVisible;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    function handler() {
      setIsMobile(window.innerWidth < 768);
    }

    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return isMobile;
}

function ArtworkImage({ art }) {
  const [imageState, setImageState] = useState("loading");

  return (
    <div className="relative h-[min(52dvh,520px)] min-h-[180px] overflow-hidden bg-black md:h-auto md:min-h-[min(70dvh,640px)]">
      {imageState !== "ready" && (
        <img src={art.thumbnail} alt={art.title} className="absolute inset-0 h-full w-full object-contain" />
      )}
      <img
        src={art.image}
        alt={imageState === "ready" ? art.title : ""}
        aria-hidden={imageState !== "ready"}
        decoding="async"
        data-artwork-image
        className={`absolute inset-0 h-full w-full object-contain ${imageState === "ready" ? "" : "opacity-0"}`}
        onLoad={() => setImageState("ready")}
        onError={() => setImageState("unavailable")}
      />
      {imageState === "unavailable" && (
        <p role="status" className="absolute inset-x-0 bottom-0 bg-black/80 px-3 py-2 text-center text-xs text-white/80">Showing the artwork preview.</p>
      )}
    </div>
  );
}

function ArtworkModal({ art, onClose, onInquire, onNavigate }) {
  const index = artworks.indexOf(art);
  const neighbors = [-1, 0, 1];
  const dialogRef = useRef(null);
  const isOpen = Boolean(art);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector("button")?.focus({ preventScroll: true });

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onNavigate(-1);
      if (event.key === "ArrowRight") onNavigate(1);
      if (event.key !== "Tab") return;

      const buttons = dialogRef.current?.querySelectorAll("button, a[href]");
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [isOpen, onClose, onNavigate]);

  return (
    <AnimatePresence>
      {art && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-2 backdrop-blur-xl sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="artwork-title"
            className="archive-dialog relative grid max-h-[94dvh] w-full max-w-6xl grid-cols-1 overflow-y-auto overscroll-contain md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]"
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="exhibit-toolbar">
              <span aria-live="polite">Artwork {index + 1} / {artworks.length}</span>
              <button
              type="button"
              aria-label="Close artwork detail"
              onClick={onClose}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/55 text-xl leading-none text-white backdrop-blur-sm transition hover:bg-sky-900"
            >
              ×
              </button>
            </div>

            <div className="exhibit-stage">
              <ArtworkImage key={art.image} art={art} />
            </div>

            <div className="archive-detail relative flex min-w-0 flex-col justify-between p-4 md:p-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.10),transparent_32%)]" />

              <div className="relative">
                <h2 id="artwork-title" className="exhibit-title">{art.title}</h2>
                <a href={art.image} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-sky-100 underline underline-offset-4">Open full-resolution image</a>
                <div className="exhibit-film" aria-label="Browse nearby artwork">
                  {neighbors.map((offset) => {
                    const piece = artworks[mod(index + offset, artworks.length)];
                    return offset === 0 ? (
                      <img key={offset} src={piece.thumbnail} alt="" className="exhibit-current" />
                    ) : (
                      <button key={offset} type="button" onClick={() => onNavigate(offset)} aria-label={`${offset < 0 ? "Previous" : "Next"} artwork: ${piece.title}`}>
                        <img src={piece.thumbnail} alt="" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative mt-6 grid gap-2">
                <a
                  href={commissionLink("portrait", art.title)}
                  onClick={(event) => {
                    if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onInquire();
                  }}
                  className="inline-flex min-h-11 w-fit items-center rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-[#07111b] transition hover:bg-white"
                >
                  Commission in this style
                </a>
                <a
                  href={commissionLink("artwork", art.title)}
                  onClick={(event) => {
                    if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onInquire();
                  }}
                  className="inline-flex min-h-11 w-fit items-center text-sm text-sky-100/80 underline underline-offset-4 transition hover:text-white"
                >
                  Ask to buy this piece
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function GridGallery({ artworksToShow, onSelect }) {
  return (
    <div className="archive-grid mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
      {artworksToShow.map((art) => (
        <article key={art.title} className="archive-tile flex min-w-0 flex-col">
          <button type="button" onClick={() => onSelect(art)} className="group block w-full text-left">
            <div className="overflow-hidden">
              <img src={art.thumbnail} alt="" loading="lazy" decoding="async"
                className="w-full bg-[#070c15] object-cover transition duration-300 group-hover:scale-105" />
            </div>
            <h2 className="break-words px-3 py-3 text-sm font-semibold leading-snug text-white sm:px-5 sm:text-xl">{art.title}</h2>
          </button>
          <a href={commissionLink("artwork", art.title)} aria-label={`Ask to buy ${art.title}`} className="mt-auto inline-flex min-h-11 items-center self-start px-3 text-sm text-sky-100/85 underline underline-offset-4 sm:px-5">Ask to buy</a>
        </article>
      ))}
    </div>
  );
}

function PageShell({ eyebrow, title, intro, children, aside }) {
  return (
    <section className="archive-page relative min-h-screen px-5 pb-20 pt-28 md:pb-24 md:pt-32">
      <div className="mx-auto max-w-7xl">
        <div className="archive-heading grid gap-5 pb-8 lg:grid-cols-[1fr_0.65fr] lg:items-end">
          <div>
            <div className="text-xs uppercase tracking-[0.34em] text-sky-100/42">{eyebrow}</div>
            <h1 className="archive-title mt-4 max-w-4xl">
              {title}
            </h1>
          </div>
          <div className="max-w-xl text-base leading-7 text-sky-100/62 lg:justify-self-end">
            <p>{intro}</p>
            {aside}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

function createMobileMobiusVisual() {
  const uSegments = 72;
  const vSegments = 6;
  const radius = 1.72;
  const halfWidth = 0.72;
  const centerX = 195;
  const centerY = 248;
  const scale = 90;

  function project(u, v) {
    const x = (radius + v * Math.cos(u / 2)) * Math.cos(u);
    const y = v * Math.sin(u / 2);
    const z = (radius + v * Math.cos(u / 2)) * Math.sin(u);
    const depth = z * 0.9 + y * 0.34;

    return {
      x: centerX + x * scale,
      y: centerY + z * 34 - y * 78,
      depth,
    };
  }

  function fmt(value) {
    return Number(value.toFixed(2));
  }

  function pathFor(v, samples = 120, turns = 1) {
    return Array.from({ length: samples + 1 }, (_, index) => {
      const point = project((index / samples) * TAU * turns, v);
      return `${index === 0 ? "M" : "L"}${fmt(point.x)} ${fmt(point.y)}`;
    }).join(" ");
  }

  const patches = [];

  for (let i = 0; i < uSegments; i++) {
    const u0 = (i / uSegments) * TAU;
    const u1 = ((i + 1) / uSegments) * TAU;

    for (let j = 0; j < vSegments; j++) {
      const v0 = -halfWidth + (j / vSegments) * halfWidth * 2;
      const v1 = -halfWidth + ((j + 1) / vSegments) * halfWidth * 2;
      const corners = [project(u0, v0), project(u1, v0), project(u1, v1), project(u0, v1)];
      const depth = corners.reduce((sum, point) => sum + point.depth, 0) / corners.length;
      const depthLight = Math.min(1, Math.max(0, (depth + 1.8) / 3.6));
      const innerShade = 1 - Math.abs((j + 0.5) / vSegments - 0.5) * 1.25;
      const tone = Math.round(46 + depthLight * 88 + innerShade * 28);
      const alpha = 0.105 + depthLight * 0.19 + innerShade * 0.04;

      patches.push({
        key: `${i}-${j}`,
        depth,
        points: corners.map((point) => `${fmt(point.x)},${fmt(point.y)}`).join(" "),
        fill: `rgba(${tone}, ${tone + 13}, ${tone + 20}, ${alpha.toFixed(3)})`,
      });
    }
  }

  patches.sort((a, b) => a.depth - b.depth);

  const ribs = Array.from({ length: 18 }, (_, index) => {
    const u = (index / 18) * TAU;
    const samples = 10;

    return Array.from({ length: samples + 1 }, (_, ribIndex) => {
      const v = -halfWidth + (ribIndex / samples) * halfWidth * 2;
      const point = project(u, v);
      return `${ribIndex === 0 ? "M" : "L"}${fmt(point.x)} ${fmt(point.y)}`;
    }).join(" ");
  });

  return {
    patches,
    ribs,
    topEdge: pathFor(halfWidth),
    bottomEdge: pathFor(-halfWidth),
    centerPath: pathFor(0, 180),
    beadOuterPath: pathFor(halfWidth * 0.9, 240, 2),
    beadInnerPath: pathFor(halfWidth * 0.45, 240, 2),
    innerPath: pathFor(halfWidth * 0.34),
    outerPath: pathFor(-halfWidth * 0.34),
  };
}

function ArcCarousel({ artworks, navigate, onSelect }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchRef = useRef({ active: false, startX: 0, startY: 0 });
  const pointerRef = useRef({ active: false, startX: 0, startY: 0 });
  const suppressClick = useRef(0);
  const count = artworks.length;
  const reduceMotion = useReducedMotion();
  const mobileMobius = useMemo(() => createMobileMobiusVisual(), []);

  const advance = useCallback((direction) => {
    if (count === 0) return;
    setActiveIndex((index) => mod(index + direction, count));
  }, [count]);

  if (count === 0) return null;

  const visiblePositions = [-3, -2, -1, 0, 1, 2, 3];
  const activeArtwork = artworks[activeIndex];
  const dotWindow = Math.min(9, count);
  const dotStart = activeIndex - Math.floor(dotWindow / 2);
  const dotIndices = Array.from({ length: dotWindow }, (_, index) => mod(dotStart + index, count));
  const cardStyles = {
    "-3": { angle: 28, width: 78, height: 106, opacity: 0.24, zIndex: 2, x: -186, top: 292 },
    "-2": { angle: -24, width: 96, height: 130, opacity: 0.44, zIndex: 3, x: -146, top: 172 },
    "-1": { angle: 10, width: 122, height: 164, opacity: 0.76, zIndex: 4, x: -84, top: 66 },
    0: { angle: 0, width: 178, height: 238, opacity: 1, zIndex: 8, x: 0, top: 118 },
    1: { angle: -10, width: 122, height: 164, opacity: 0.76, zIndex: 4, x: 84, top: 66 },
    2: { angle: 24, width: 96, height: 130, opacity: 0.44, zIndex: 3, x: 146, top: 172 },
    3: { angle: -28, width: 78, height: 106, opacity: 0.24, zIndex: 2, x: 186, top: 292 },
  };

  return (
    <div
      className="relative min-h-[100dvh] overflow-x-clip bg-[#02040a] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(96px+env(safe-area-inset-top))] text-white outline-none"
      tabIndex={0}
      aria-label="Artwork carousel"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") advance(1);
        if (event.key === "ArrowLeft") advance(-1);
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touchRef.current = { active: true, startX: touch.clientX, startY: touch.clientY };
      }}
      onTouchEnd={(event) => {
        if (!touchRef.current.active) return;

        const touch = event.changedTouches[0];
        const dx = touch.clientX - touchRef.current.startX;
        const dy = touch.clientY - touchRef.current.startY;
        touchRef.current.active = false;

        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
          suppressClick.current = performance.now() + 250;
          advance(dx < 0 ? 1 : -1);
        }
      }}
      onPointerDown={(event) => {
        if (event.pointerType === "touch" || event.target.closest("button")) return;
        pointerRef.current = { active: true, startX: event.clientX, startY: event.clientY };
      }}
      onPointerUp={(event) => {
        if (!pointerRef.current.active) return;

        const dx = event.clientX - pointerRef.current.startX;
        const dy = event.clientY - pointerRef.current.startY;
        pointerRef.current.active = false;

        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
          suppressClick.current = performance.now() + 250;
          advance(dx < 0 ? 1 : -1);
        }
      }}
      onPointerLeave={() => {
        pointerRef.current.active = false;
      }}
    >
      <style>
        {`
          @keyframes mobile-card-float {
            0%, 100% { filter: brightness(0.98) drop-shadow(0 16px 28px rgba(56,189,248,0.08)); }
            50% { filter: brightness(1.1) drop-shadow(0 24px 42px rgba(125,211,252,0.18)); }
          }
        `}
      </style>

      <div className="pointer-events-none absolute right-5 top-[108px] z-20 font-mono text-xs text-white/30">
        {String(activeIndex + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
      </div>

      <div className="relative mx-auto h-[500px] w-full max-w-[450px] shrink-0">
        <div className="pointer-events-none absolute left-1/2 top-[112px] h-72 w-[124vw] max-w-[560px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(137,195,230,0.07),rgba(56,84,105,0.034)_38%,transparent_72%)] blur-2xl" />

        <svg
          className="pointer-events-none absolute inset-x-1/2 top-0 h-full w-[138vw] max-w-[590px] -translate-x-1/2 overflow-visible"
          viewBox="0 0 390 470"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="mobileMobiusRim" x1="42" y1="176" x2="356" y2="282" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="rgba(255,255,255,0.13)" />
              <stop offset="0.3" stopColor="rgba(255,255,255,0.62)" />
              <stop offset="0.58" stopColor="rgba(116,177,205,0.26)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.12)" />
            </linearGradient>
            <filter id="mobileMobiusGlow" x="-20%" y="-35%" width="140%" height="170%">
              <feGaussianBlur stdDeviation="4.1" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g opacity="0.92">
            <ellipse cx="195" cy="312" rx="164" ry="58" fill="none" stroke="rgba(170,214,236,0.035)" strokeWidth="0.8" />
            <ellipse cx="195" cy="321" rx="110" ry="38" fill="none" stroke="rgba(255,255,255,0.022)" strokeWidth="0.8" />

            {mobileMobius.patches.map((patch) => (
              <polygon key={patch.key} points={patch.points} fill={patch.fill} />
            ))}

            <path
              d={mobileMobius.bottomEdge}
              fill="none"
              filter="url(#mobileMobiusGlow)"
              stroke="url(#mobileMobiusRim)"
              strokeLinecap="round"
              strokeWidth="1.6"
            />
            <path
              d={mobileMobius.topEdge}
              fill="none"
              stroke="rgba(255,255,255,0.28)"
              strokeLinecap="round"
              strokeWidth="1.25"
            />
            <path
              d={mobileMobius.centerPath}
              fill="none"
              stroke="rgba(255,255,255,0.11)"
              strokeDasharray="1 12"
              strokeLinecap="round"
              strokeWidth="0.9"
            />
            <path
              d={mobileMobius.innerPath}
              fill="none"
              stroke="rgba(255,255,255,0.055)"
              strokeLinecap="round"
              strokeWidth="0.9"
            />
            <path
              d={mobileMobius.outerPath}
              fill="none"
              stroke="rgba(255,255,255,0.045)"
              strokeDasharray="5 10"
              strokeLinecap="round"
              strokeWidth="0.9"
            />

            {mobileMobius.ribs.map((rib, index) => (
              <path
                key={index}
                d={rib}
                fill="none"
                stroke="rgba(255,255,255,0.13)"
                strokeLinecap="round"
                strokeWidth="0.62"
              />
            ))}

            {!reduceMotion && [
              [mobileMobius.beadOuterPath, "21s", "0s", 3],
              [mobileMobius.beadOuterPath, "21s", "-10.5s", 2],
              [mobileMobius.beadInnerPath, "24s", "-5s", 2.4],
              [mobileMobius.beadInnerPath, "24s", "-17s", 1.6],
              [mobileMobius.centerPath, "13s", "-3s", 1.5],
            ].map(([path, duration, begin, radius]) => (
              <circle key={begin} r={radius} fill="#def7ff" filter="url(#mobileMobiusGlow)">
                <animateMotion dur={duration} begin={begin} repeatCount="indefinite" path={path} />
              </circle>
            ))}
          </g>
        </svg>

        <div className="absolute left-1/2 top-0 h-full w-0 -translate-x-1/2">
          {visiblePositions.map((position) => {
            const art = artworks[mod(activeIndex + position, count)];
            const style = cardStyles[position];

            return (
              <button
                type="button"
                key={`${art.title}-${position}`}
                aria-label={`Open ${art.title}`}
                onClick={() => {
                  if (performance.now() >= suppressClick.current) onSelect(art);
                }}
                className="absolute block overflow-hidden rounded-md bg-black p-0 shadow-[0_18px_42px_rgba(0,0,0,0.42)]"
                style={{
                  width: style.width,
                  height: style.height,
                  left: -style.width / 2,
                  top: style.top,
                  opacity: style.opacity,
                  zIndex: style.zIndex,
                  transformOrigin: "bottom center",
                  transform: `translateX(${style.x}px) rotate(${style.angle}deg)`,
                  transition:
                    "transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.35s ease, width 0.35s ease, height 0.35s ease, box-shadow 0.35s ease",
                  border: position === 0 ? "1px solid rgba(255,255,255,0.62)" : "1px solid rgba(255,255,255,0.08)",
                  boxShadow:
                    position === 0
                      ? "0 28px 72px rgba(0,0,0,0.72), 0 0 0 1px rgba(180,220,240,0.14), 0 0 52px rgba(125,211,252,0.18)"
                      : "0 18px 42px rgba(0,0,0,0.42)",
                  animation: position === 0 ? "mobile-card-float 3.8s ease-in-out infinite" : undefined,
                }}
              >
                <img
                  src={art.thumbnail}
                  alt={art.title}
                  draggable="false"
                  className="h-full w-full select-none bg-black object-contain"
                />
              </button>
            );
          })}
        </div>

      </div>

      <div className="relative z-20 -mt-3 text-center">
        <div className="mx-auto flex max-w-sm items-center justify-center gap-4">
          <button
            type="button"
            aria-label="Previous artwork"
            onClick={() => advance(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.035] text-3xl leading-none text-white/70 transition hover:border-white/28 hover:text-white"
          >
            ‹
          </button>

          <h2 className="min-w-0 flex-1 text-lg font-bold leading-tight text-white">{activeArtwork.title}</h2>

          <button
            type="button"
            aria-label="Next artwork"
            onClick={() => advance(1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.035] text-3xl leading-none text-white/70 transition hover:border-white/28 hover:text-white"
          >
            ›
          </button>
        </div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.12em] text-white/30">
          Möbius archive
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5" aria-label={`Artwork ${activeIndex + 1} of ${count}`}>
          {dotIndices.map((index) => (
            <span
              key={index}
              className="block transition-all duration-300"
              style={{
                width: index === activeIndex ? 16 : 4,
                height: 4,
                borderRadius: index === activeIndex ? 2 : "50%",
                background: index === activeIndex ? "#ffffff" : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-20 mt-5">
        <h1 className="max-w-sm text-[clamp(1.35rem,5.8vw,1.8rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-white">
          {landingTitle}
        </h1>
        <div className="mt-1 flex flex-wrap gap-x-5">
          <button
            type="button"
            onClick={() => navigate("/work")}
            className="landing-link"
          >
            Browse art
          </button>
          <button
            type="button"
            onClick={() => navigate("/commissions")}
            className="landing-link"
          >
            Commission a piece
          </button>
        </div>
      </div>
    </div>
  );
}

class GalleryBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function supportsWebGL() {
  try {
    const context = document.createElement("canvas").getContext("webgl2");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function DesktopGalleryPreview({ onSelect, loading }) {
  const featured = artworks[Math.floor(artworks.length / 2)];

  return (
    <div className="desktop-gallery-preview" aria-busy={loading}>
      <div className="desktop-gallery-orbit" aria-hidden="true" />
      <button type="button" className="desktop-gallery-art" onClick={() => onSelect(featured)} aria-label={`Open ${featured.title}`}>
        <img src={featured.thumbnail} alt="" decoding="async" />
      </button>
      <div className="absolute inset-x-0 bottom-0 px-5 pb-8 md:px-10 md:pb-10">
        <h1 className="max-w-3xl text-3xl font-semibold leading-[1.08] tracking-tight text-white md:text-5xl">{landingTitle}</h1>
        <div className="mt-2 flex w-fit flex-wrap gap-x-5">
          <a href="#/work" className="landing-link">Browse art</a>
          <a href={commissionLink()} className="landing-link">Commission a piece</a>
        </div>
      </div>
    </div>
  );
}

function HomePage({ onSelect }) {
  const isMobile = useIsMobile();
  const isVisible = useDocumentVisibility();
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(null);
  const [failed, setFailed] = useState(false);
  const [webGLAvailable] = useState(() => !isMobile && !reduceMotion ? supportsWebGL() : null);
  const canUseWebGL = useMemo(() => !isMobile && !reduceMotion && (webGLAvailable ?? supportsWebGL()), [isMobile, reduceMotion, webGLAvailable]);
  const motionRef = useRef({ progress: 0, velocity: 0 });
  const drag = useRef(null);

  const showFallback = useCallback(() => setFailed(true), []);
  const use3D = canUseWebGL && !failed;
  const ready = use3D && activeIndex !== null;

  function navigate(path) {
    window.location.assign(`#${path}`);
  }

  return (
    <section className="relative min-h-[100dvh] overflow-x-clip md:min-h-[max(100dvh,680px)]" aria-label="Möbius artwork gallery">
      {isMobile && <ArcCarousel artworks={artworks} onSelect={onSelect} navigate={navigate} />}
      {!isMobile && !ready && <DesktopGalleryPreview onSelect={onSelect} loading={use3D} />}

      {use3D && (
        <div
          data-gallery="3d"
          className={`absolute inset-0 transition-opacity duration-500 ${ready ? "opacity-100" : "pointer-events-none opacity-0"}`}
          onWheel={(event) => {
            motionRef.current.velocity = Math.min(1.15, Math.max(-1.15, motionRef.current.velocity + event.deltaY * 0.00128));
          }}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            motionRef.current.velocity = 0;
            drag.current = { startX: event.clientX, startY: event.clientY, lastX: event.clientX };
          }}
          onPointerMove={(event) => {
            const current = drag.current;
            if (!current || (event.buttons & 1) === 0) return;
            if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 8) return;
            const delta = event.clientX - current.lastX;
            motionRef.current.velocity = Math.min(1.15, Math.max(-1.15, motionRef.current.velocity - delta * 0.007));
            current.lastX = event.clientX;
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerLeave={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
        >
          <GalleryBoundary onFailure={showFallback}>
            <Suspense fallback={null}>
              <DesktopGallery artworks={artworks} isVisible={isVisible} motionRef={motionRef} onSelect={onSelect} onProgress={setActiveIndex} onFailure={showFallback} />
            </Suspense>
          </GalleryBoundary>
        </div>
      )}

      {ready && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-[55%] -translate-x-1/2 text-center">
            <div className="flex items-center gap-1.5" aria-label={`Artwork ${activeIndex + 1} of ${artworks.length}`}>
              {artworks.map((art, index) => (
                <span key={art.title} className={`h-1 rounded-full transition-all ${index === activeIndex ? "w-7 bg-sky-100/80" : "w-1.5 bg-sky-100/22"}`} />
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-5 pb-8 md:px-10 md:pb-10">
            <h1 className="max-w-3xl text-3xl font-semibold leading-[1.08] tracking-tight text-white md:text-5xl">{landingTitle}</h1>
            <div className="pointer-events-auto mt-2 flex w-fit flex-wrap gap-x-5">
              <a href="#/work" className="landing-link">Browse art</a>
              <a href={commissionLink()} className="landing-link">Commission a piece</a>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function WorkPage({ onSelect }) {
  return (
    <PageShell
      eyebrow="The Chinese Satellite Archive"
      title="The archive"
      intro="Explore the drawings, or ask about an original or a print."
      aside={
        <a href={commissionLink()} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-sky-100 underline underline-offset-4">Commission a piece</a>
      }
    >
      <GridGallery artworksToShow={artworks} onSelect={onSelect} />
    </PageShell>
  );
}

function ArchiveCollage({ pieces, onSelect }) {
  return (
    <div className="archive-collage">
      {pieces.map((piece) => (
        <button key={piece.title} type="button" onClick={() => onSelect(piece)} aria-label={`View ${piece.title}`}>
          <img src={piece.thumbnail} alt="" decoding="async" />
        </button>
      ))}
    </div>
  );
}

function AboutPage({ onSelect }) {
  return (
    <PageShell eyebrow="About the artist" title="Dion Nikila" intro="I draw characters, then build strange places for them to live.">
      <div className="archive-editorial">
        <ArchiveCollage pieces={[artworks[4], artworks[1], artworks[8]]} onSelect={onSelect} />
        <div className="archive-about-copy space-y-5 p-6 text-base leading-8 text-sky-100/85 sm:p-8">
          <h2 className="exhibit-title">A gallery with one side</h2>
          <p>I’m drawn to characters you can recognize from a silhouette or a single gesture. This archive brings those studies together in a gallery that folds back on itself.</p>
          <p>I also make portraits, original characters, covers, and posters. Tell me a little about the world you want the work to belong to.</p>
          <div className="flex flex-wrap gap-x-6">
            <a href="#/contact" className="inline-flex min-h-11 items-center underline underline-offset-4">Get in touch</a>
            <a href={INSTAGRAM_URL} className="inline-flex min-h-11 items-center underline underline-offset-4">@thechinese.satellite</a>
          </div>
        </div>
      </div>
      <div className="archive-route-links">
        <a href="#/work">Browse the archive</a>
        <a href="#/journal">Read the studio notes</a>
      </div>
    </PageShell>
  );
}

function JournalPage({ onSelect }) {
  return (
    <PageShell eyebrow="Journal" title="Studio notes" intro="Notes on the loop, character studies, and what goes into a commission.">
      <div className="journal-grid">
        {studioNotes.map((note, index) => {
          const piece = artworks[[3, 7, 10][index]];
          return (
            <article key={note.title} className="journal-entry">
              <button type="button" className="journal-image" onClick={() => onSelect(piece)} aria-label={`View ${piece.title}`}>
                <img src={piece.thumbnail} alt="" loading="lazy" decoding="async" />
              </button>
              <div className="p-5 sm:p-7">
                <p className="exhibit-index">{note.date}</p>
                <h2 className="exhibit-title mt-3">{note.title}</h2>
                <p className="mt-4 leading-7 text-sky-100/80">{note.summary}</p>
              </div>
            </article>
          );
        })}
      </div>
      <div className="archive-route-links">
        <a href="#/about">About the artist</a>
        <a href="#/contact">Get in touch</a>
      </div>
    </PageShell>
  );
}

export default function MobiusPortfolio() {
  const [location, setLocation] = useState(readLocation);
  const [modalArt, setModalArt] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const formRef = useRef(null);
  const activeRoute = routes.find((item) => item.path === location.path) ?? routes[0];
  const inquiryArt = artworks.find((art) => art.title === location.reference);

  useEffect(() => {
    function syncRoute() {
      setLocation(readLocation());
      setModalArt(null);
      setMenuOpen(false);
    }

    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  useEffect(() => {
    const pageTitle = location.isContact ? "Contact" : activeRoute.label;
    document.title = activeRoute.path === "/" ? "The Chinese Satellite Archive | Art by Dion Nikila" : `${pageTitle} | The Chinese Satellite Archive`;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [activeRoute, location.isContact]);

  const closeModal = useCallback(() => setModalArt(null), []);

  const navigateModal = useCallback((direction) => {
    setModalArt((currentArt) => {
      if (!currentArt) return currentArt;

      const currentIndex = artworks.findIndex((art) => art.title === currentArt.title);
      return artworks[mod(currentIndex + direction, artworks.length)];
    });
  }, []);

  return (
    <MotionConfig reducedMotion="user">
    <div className="relative min-h-screen overflow-x-clip bg-[#02040a] text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(5,10,18,0)_0%,rgba(5,10,18,0.36)_100%)]" />

      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.04] [background-image:linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-sky-200/10 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-28 bg-gradient-to-t from-sky-400/[0.045] to-transparent" />

      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[#02040a]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-[1600px] items-center justify-between gap-2 px-4 sm:gap-5 sm:px-6 md:px-8">
          <a className="min-w-0 py-2" href="#/" onClick={() => setMenuOpen(false)}>
            <div className="hidden text-[10px] uppercase tracking-[0.23em] text-sky-100/55 sm:block">Art by Dion Nikila</div>
            <div className="text-sm leading-tight font-semibold tracking-tight text-white sm:text-xl">The Chinese Satellite Archive</div>
          </a>

          <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm text-sky-100/72 md:flex">
            {routes.slice(1).map((item) => (
              <a
                key={item.path}
                href={`#${item.path}`}
                aria-current={activeRoute.path === item.path ? "page" : undefined}
                className="inline-flex min-h-11 items-center transition hover:text-white aria-[current=page]:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href="#/contact"
              onClick={() => setMenuOpen(false)}
              aria-current={location.isContact ? "page" : undefined}
              className="inline-flex min-h-11 items-center rounded-full bg-sky-50 px-3 text-xs font-semibold text-[#07111b] transition hover:bg-white sm:px-4 sm:text-sm"
            >
              Contact
            </a>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="min-h-11 rounded-full border border-white/18 px-3 text-xs font-semibold text-sky-100/80 md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className="fixed inset-x-0 top-[72px] z-30 border-b border-white/10 bg-[#02040a] px-5 py-4 shadow-2xl md:hidden"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="grid divide-y divide-white/10">
              {routes.map((item) => (
                <a
                  key={item.path}
                  href={`#${item.path}`}
                  onClick={() => setMenuOpen(false)}
                  aria-current={activeRoute.path === item.path ? "page" : undefined}
                  className="flex min-h-11 items-center py-3 text-lg font-semibold text-sky-100/70 hover:text-white aria-[current=page]:text-white"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      <main className="relative min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeRoute.path}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            {activeRoute.path === "/" && (
              <HomePage onSelect={setModalArt} />
            )}
            {activeRoute.path === "/work" && <WorkPage onSelect={setModalArt} />}
            {activeRoute.path === "/about" && <AboutPage onSelect={setModalArt} />}
            {activeRoute.path === "/journal" && <JournalPage onSelect={setModalArt} />}
            {activeRoute.path === "/commissions" && (
              <CommissionPage type={location.type} artwork={inquiryArt} formRef={formRef} isContact={location.isContact} visual={<ArchiveCollage pieces={[artworks[0], artworks[5], artworks[9]]} onSelect={setModalArt} />} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <ArtworkModal
        art={modalArt}
        onClose={closeModal}
        onInquire={closeModal}
        onNavigate={navigateModal}
      />
    </div>
    </MotionConfig>
  );
}
