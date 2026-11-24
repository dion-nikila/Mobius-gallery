import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from "framer-motion";
import CommissionPage from "./CommissionPage";
import { artworks, aboutArtworks } from "./artworks.js";
import { resolveArtworkReference } from "./catalog.js";
import { commissionLink, CONTACT_EMAIL, INSTAGRAM_URL, WHATSAPP_NUMBER, WHATSAPP_URL } from "./commissions";

const TAU = Math.PI * 2;
const landingArtworks = artworks.slice(0, 16);
const landingTitle = "sycophantic, prophetic, socratic junkie wannabe";
const DesktopGallery = lazy(() => import("./DesktopGallery"));
const StudioPage = lazy(() => import("./StudioPage"));

const routes = [
  { path: "/", label: "Home" },
  { path: "/work", label: "Browse art" },
  { path: "/about", label: "About" },
  { path: "/commissions", label: "Get a quote" },
];

function readLocation() {
  const [hashPath, search = ""] = window.location.hash.slice(1).split("?");
  const legacyPath = "/" + (window.location.pathname.split("/").filter(Boolean).at(-1) ?? "");
  const requestedPath = hashPath.startsWith("/") ? hashPath.replace(/\/+$/, "") || "/" : legacyPath;
  const path = requestedPath === "/journal" ? "/about" : requestedPath;
  const params = new URLSearchParams(search);
  const isContact = path === "/contact";

  return {
    path: path === "/studio" ? "/studio" : isContact ? "/commissions" : routes.find((route) => route.path === path)?.path ?? "/",
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

const mobileViewport = window.matchMedia("(width < 48rem)");

function subscribeToViewport(onChange) {
  mobileViewport.addEventListener("change", onChange);
  return () => mobileViewport.removeEventListener("change", onChange);
}

function getIsMobile() {
  return mobileViewport.matches;
}

function ArtworkImage({ art }) {
  const [imageState, setImageState] = useState("loading");

  return (
    <div className="artwork-image">
      {imageState !== "ready" && (
        <img src={art.thumbnail} alt={art.alt || art.title} className="absolute inset-0 h-full w-full object-contain" />
      )}
      <img
        src={art.image}
        alt={imageState === "ready" ? art.alt || art.title : ""}
        aria-hidden={imageState !== "ready"}
        decoding="async"
        data-artwork-image
        className={`absolute inset-0 h-full w-full object-contain ${imageState === "ready" ? "" : "opacity-0"}`}
        onLoad={() => setImageState("ready")}
        onError={() => setImageState("unavailable")}
      />
      {imageState === "unavailable" && (
        <p role="status" className="viewer-image-status">Showing the artwork preview.</p>
      )}
    </div>
  );
}

function ArtworkModal({ art, onClose, onInquire, onNavigate }) {
  const index = artworks.indexOf(art);
  const nearby = [-1, 1].map((direction) => ({ piece: artworks[mod(index + direction, artworks.length)], direction }));
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
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        onNavigate(event.key === "ArrowLeft" ? -1 : 1);
      }
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
          className="viewer-backdrop"
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
            className="artwork-viewer"
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" aria-label="Close artwork detail" onClick={onClose} className="icon-button viewer-control">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>

            <div className="viewer-scroll">
              <div className="viewer-image-panel">
                <img className="viewer-image-glow" src={art.thumbnail} alt="" aria-hidden="true" />
                <ArtworkImage key={art.image} art={art} />
              </div>

              <div className="viewer-details">
                <div className="viewer-content">
                  <h2 id="artwork-title" aria-live="polite">{art.title}</h2>
                  <dl className="artwork-facts">
                    {art.year && <div><dt className="label">Year</dt><dd>{art.year}</dd></div>}
                    {art.medium && <div><dt className="label">Medium</dt><dd>{art.medium}</dd></div>}
                    {art.availability === "available" && <div><dt className="label">Availability</dt><dd>Available</dd></div>}
                    {art.availability === "unavailable" && <div><dt className="label">Availability</dt><dd>Unavailable</dd></div>}
                  </dl>
                  {art.description && <p className="viewer-description">{art.description}</p>}
                  <a href={art.image} target="_blank" rel="noopener noreferrer" className="text-link text-small">Open full-resolution image</a>
                  <div className="viewer-actions">
                    <a href={commissionLink("portrait", art.id)}
                      onClick={(event) => {
                        if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onInquire();
                      }} className="btn btn--primary">
                      Commission in this style
                    </a>
                    {art.availability !== "unavailable" && <a href={commissionLink("artwork", art.id)}
                      onClick={(event) => {
                        if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onInquire();
                      }} className="btn btn--secondary">
                      Ask to buy
                    </a>}
                  </div>
                </div>

                <div className="viewer-film" role="group" aria-label="Browse nearby artwork">
                  {nearby.map(({ piece, direction }) => (
                    <button key={direction} type="button" onClick={() => onNavigate(direction)}>
                      <img src={piece.thumbnail} alt="" />
                      <span>
                        <span className="label">{direction < 0 ? "Previous" : "Next"}</span>
                        <span className="viewer-film-title">{piece.title}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const siteIcons = {
  expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M20.8 11.8A8.8 8.8 0 0 1 8 19.7L3 21l1.3-4.8a8.8 8.8 0 1 1 16.5-4.4Z" />
      <path d="m9.5 7.7 1.2 2.5-1 1.1a6.8 6.8 0 0 0 3 3l1.1-1 2.5 1.2v1.3c-3.5 1.6-9.7-4.6-8.1-8.1h1.3Z" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  phone: <path d="M7 3H4.5C3.7 3 3 3.7 3 4.5A16.5 16.5 0 0 0 19.5 21c.8 0 1.5-.7 1.5-1.5V17l-5-2-1.6 2a13 13 0 0 1-7.4-7.4L9 8 7 3Z" />,
};

function SiteIcon({ name, className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {siteIcons[name]}
    </svg>
  );
}

/** @type {import("framer-motion").MotionProps} */
const artworkReveal = {
  initial: "waiting",
  whileInView: "visible",
  viewport: { once: true, amount: 0.16 },
  variants: {
    waiting: { opacity: 0.78, y: 12 },
    visible: (index) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, delay: index * 0.055, ease: [0.22, 1, 0.36, 1] },
    }),
  },
};

function GridGallery({ artworksToShow, onSelect }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="archive-grid">
      {artworksToShow.map((art, index) => (
        <motion.article key={art.id} className="archive-tile" custom={index % 4} {...(reduceMotion ? {} : artworkReveal)}>
          <button type="button" onClick={() => onSelect(art)} className="archive-tile-button">
            <span className="archive-tile-media">
              <img src={art.thumbnail} alt="" loading="lazy" decoding="async" />
            </span>
            <span className="archive-tile-caption">
              <span className="archive-tile-title">{art.title}</span>
              <SiteIcon name="expand" className="tile-action-icon" />
            </span>
          </button>
          <div className="archive-tile-meta">
            {art.year && <p className="text-small">{art.year}</p>}
            {art.availability !== "unavailable" && (
              <a href={commissionLink("artwork", art.id)} aria-label={`Ask to buy ${art.title}`} className="archive-tile-link text-link text-small">
                Ask to buy
              </a>
            )}
          </div>
        </motion.article>
      ))}
    </div>
  );
}

function PageShell({ eyebrow, title, intro, children, aside }) {
  return (
    <section className="archive-page page-section">
      <div className="container">
        <div className="archive-heading">
          <div>
            <div className="label">{eyebrow}</div>
            <h1 className="archive-title">
              {title}
            </h1>
          </div>
          <div className="archive-intro">
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
  const stageRef = useRef(null);
  const [stageScale, setStageScale] = useState(1);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const resize = () => setStageScale(stage.clientHeight / 500);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
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
      className="mobile-gallery relative overflow-x-clip bg-[#02040a] px-5 text-white"
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

      <div ref={stageRef} className="mobile-gallery-stage">
        <div className="mobile-gallery-scene" style={{ "--scene-scale": stageScale }}>
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
                key={`${art.id}-${position}`}
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
      </div>

      <div className="relative z-20 text-center">
        <div className="mx-auto flex max-w-sm items-center justify-center gap-4">
          <button
            type="button"
            aria-label="Previous artwork"
            onClick={() => advance(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.035] text-3xl leading-none text-white/70 transition hover:border-white/28 hover:text-white"
          >
            ‹
          </button>

          <h2 className="mobile-gallery-title min-w-0 flex-1 text-base font-bold leading-tight text-white">{activeArtwork.title}</h2>

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

        <div className="mt-4 flex items-center justify-center gap-1.5" aria-hidden="true">
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

function DesktopGalleryPreview({ onSelect }) {
  const featured = landingArtworks[Math.floor(landingArtworks.length / 2)];

  return (
    <div className="desktop-gallery-preview">
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
  const isMobile = useSyncExternalStore(subscribeToViewport, getIsMobile);
  const isVisible = useDocumentVisibility();
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(null);
  const [failed, setFailed] = useState(false);
  const canUseWebGL = useMemo(() => !isMobile && !reduceMotion && supportsWebGL(), [isMobile, reduceMotion]);
  const motionRef = useRef({ progress: 0, velocity: 0 });
  const drag = useRef(null);

  const showFallback = useCallback(() => setFailed(true), []);
  const use3D = canUseWebGL && !failed;
  const ready = use3D && activeIndex !== null;

  function navigate(path) {
    window.location.assign(`#${path}`);
  }

  return (
    <section className="landing-page relative min-h-svh overflow-x-clip md:min-h-[max(100svh,680px)]" aria-label="Möbius artwork gallery">
      {isMobile && <ArcCarousel artworks={landingArtworks} onSelect={onSelect} navigate={navigate} />}
      {!isMobile && !use3D && <DesktopGalleryPreview onSelect={onSelect} />}
      {use3D && !ready && (
        <div className="desktop-gallery-loading" role="status" aria-label="Loading gallery">
          <MobiusMark animated />
        </div>
      )}

      {use3D && (
        <div
          data-gallery="3d"
          className={`desktop-gallery-canvas absolute inset-0 transition-opacity duration-500 ${ready ? "opacity-100" : "pointer-events-none opacity-0"}`}
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
              <DesktopGallery artworks={landingArtworks} isVisible={isVisible} motionRef={motionRef} onSelect={onSelect} onProgress={setActiveIndex} onFailure={showFallback} />
            </Suspense>
          </GalleryBoundary>
        </div>
      )}

      {ready && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-[55%] -translate-x-1/2 text-center">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {landingArtworks.map((art, index) => (
                <span key={art.id} className={`h-1 rounded-full transition-all ${index === activeIndex ? "w-7 bg-sky-100/80" : "w-1.5 bg-sky-100/22"}`} />
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
        <a href={commissionLink()} className="archive-intro-link text-link text-small">Commission a piece</a>
      }
    >
      <GridGallery artworksToShow={artworks} onSelect={onSelect} />
    </PageShell>
  );
}

function AboutArtwork({ art, onSelect, index = 0 }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button type="button" className="about-art" onClick={() => onSelect(art)} aria-label={`View ${art.title}`}
      custom={index} {...(reduceMotion ? {} : artworkReveal)}>
      <img src={art.thumbnail} alt="" decoding="async" />
      <span className="about-art-caption text-small">
        {art.title}
        <SiteIcon name="expand" className="tile-action-icon" />
      </span>
    </motion.button>
  );
}

function AboutPage({ onSelect }) {
  return (
    <section className="about-page page-section">
      <div className="container">
        <div className="about-hero">
          <div className="about-essay">
            <h1>I’m Dion,<br /> I draw things</h1>
            <div className="about-copy text-lead">
              <p>I’m drawn to the details that make a pose recognizable, like the angle of a shoulder or the space between an arm and the torso. I work in acrylic on canvas and in watercolor and fineliner in my sketchbooks.</p>
              <p>I built the gallery around a Möbius strip so the drawings have no obvious first or last. Follow one of the off-center lights and it takes two laps to get back where it started.</p>
            </div>
          </div>
          <div className="about-feature">
            <AboutArtwork art={aboutArtworks[0]} onSelect={onSelect} />
          </div>
        </div>

        {aboutArtworks.length > 1 && (
          <div className="about-studies">
            {aboutArtworks.slice(1).map((art, index) => (
              <AboutArtwork key={art.id} art={art} onSelect={onSelect} index={index} />
            ))}
          </div>
        )}

        <div className="about-invitation">
          <h2>Don’t be a stranger.</h2>
          <p>I make portraits, character art, covers, and posters. If you have a piece in mind, <a href="#/contact" className="text-link">send me a note</a>.</p>
        </div>
      </div>
    </section>
  );
}

// Trace the single edge through two turns of a projected Möbius strip.
const markEdge = Array.from({ length: 129 }, (_, index) => {
  const u = index / 128 * TAU * 2;
  const radius = 45 + 10 * Math.cos(u / 2);
  const x = 66 + radius * Math.cos(u);
  const y = 35 + radius * Math.sin(u) * .35 - 10 * Math.sin(u / 2) + (x - 66) * .1;
  return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
}).join(" ");

function MobiusMark({ animated = false }) {
  return (
    <svg className="mobius-mark" viewBox="0 0 132 70" fill="none" aria-hidden="true">
      <path d={markEdge} className="mobius-edge" pathLength="100" />
      {animated && <path d={markEdge} className="mobius-trace" pathLength="100" />}
    </svg>
  );
}

const footerContacts = [
  { label: "Instagram", href: INSTAGRAM_URL, icon: "instagram" },
  { label: "WhatsApp", href: WHATSAPP_URL, icon: "whatsapp" },
  { label: "Email", href: `mailto:${CONTACT_EMAIL}`, icon: "email" },
  { label: "Call +94 76 770 2100", href: `tel:+${WHATSAPP_NUMBER}`, icon: "phone" },
];

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-bar">
        <div className="footer-brand">
          <a href="#/" className="footer-signature">
            <MobiusMark />
            <span className="footer-wordmark text-small">The Chinese Satellite Archive</span>
          </a>
          <p className="footer-credit text-small">© {new Date().getFullYear()} Dion · Sri Lanka</p>
        </div>
        <nav className="footer-contact" aria-label="Contact and socials">
          <ul>
            {footerContacts.map(({ href, label, icon }) => (
              <li key={href}>
                <a href={href} className="footer-icon-link" aria-label={label} title={label}>
                  <SiteIcon name={icon} className="footer-icon" />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

export default function MobiusPortfolio() {
  const [location, setLocation] = useState(readLocation);
  const [modalArt, setModalArt] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const isStudio = location.path === "/studio";
  const activeRoute = routes.find((item) => item.path === location.path) ?? routes[0];
  const inquiryArt = resolveArtworkReference(artworks, location.reference);

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
    const pageTitle = isStudio ? "Studio" : location.isContact ? "Contact" : activeRoute.label;
    document.title = !isStudio && activeRoute.path === "/" ? "The Chinese Satellite Archive | Art by Dion" : `${pageTitle} | The Chinese Satellite Archive`;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [activeRoute, isStudio, location.isContact]);

  const closeModal = useCallback(() => setModalArt(null), []);

  const navigateModal = useCallback((direction) => {
    setModalArt((currentArt) => {
      if (!currentArt) return currentArt;

      const currentIndex = artworks.findIndex((art) => art.id === currentArt.id);
      return artworks[mod(currentIndex + direction, artworks.length)];
    });
  }, []);

  if (isStudio) {
    return <Suspense fallback={<div className="desktop-gallery-loading" role="status" aria-label="Loading studio"><MobiusMark animated /></div>}><StudioPage /></Suspense>;
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="portfolio relative min-h-screen overflow-x-clip">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(5,10,18,0)_0%,rgba(5,10,18,0.36)_100%)]" />

      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.04] [background-image:linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-sky-200/10 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-28 bg-gradient-to-t from-sky-400/[0.045] to-transparent" />

      <header className="site-header">
        <div className="container site-header-inner">
          <a className="site-brand" href="#/" onClick={() => setMenuOpen(false)}>
            <div className="label">Art by Dion</div>
            <div className="site-wordmark">The Chinese Satellite Archive</div>
          </a>

          <nav aria-label="Main navigation" className="site-nav desktop-nav">
            {routes.slice(1).map((item) => (
              <a
                key={item.path}
                href={`#${item.path}`}
                aria-current={!location.isContact && activeRoute.path === item.path ? "page" : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="header-actions">
            <a
              href="#/contact"
              onClick={() => setMenuOpen(false)}
              aria-current={location.isContact ? "page" : undefined}
              className="btn btn--primary"
            >
              Contact
            </a>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="btn btn--secondary menu-toggle"
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
            className="site-nav mobile-nav"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="container">
              {routes.map((item) => (
                <a
                  key={item.path}
                  href={`#${item.path}`}
                  onClick={() => setMenuOpen(false)}
                  aria-current={!location.isContact && activeRoute.path === item.path ? "page" : undefined}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      <main className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.isContact ? "/contact" : activeRoute.path}
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
            {activeRoute.path === "/commissions" && (
              <CommissionPage type={location.type} artwork={inquiryArt} isContact={location.isContact} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {activeRoute.path !== "/" && <SiteFooter />}

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
