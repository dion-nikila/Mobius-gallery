import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Environment, Line, useCursor, useProgress } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";

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
  medium: "Original artwork",
}));

const studioNotes = [
  {
    title: "Building The Endless Archive",
    date: "May 2026",
    summary:
      "How the Möbius interface became a fitting structure for a portfolio about loops, memory, and recurring symbols.",
  },
  {
    title: "Texture Before Meaning",
    date: "April 2026",
    summary:
      "A process note on letting marks, scans, and accidental gradients decide where a piece wants to go.",
  },
  {
    title: "Commission Windows",
    date: "Spring 2026",
    summary:
      "Current availability for portraits, surreal album artwork, editorial images, and site-specific print sets.",
  },
];

const services = [
  "Original artwork and private sales",
  "Limited edition prints",
  "Portrait and editorial commissions",
  "Album, book, and campaign imagery",
];

const routes = [
  { path: "/", label: "home" },
  { path: "/work", label: "work" },
  { path: "/about", label: "about" },
  { path: "/journal", label: "journal" },
  { path: "/contact", label: "contact" },
];

const CONTACT_EMAIL = "dionnikila330@gmail.com";
const CONTACT_PHONE = "076702100";

function normalizePath(pathname) {
  if (pathname === "/" || pathname === "") return "/";
  const clean = pathname.replace(/\/+$/, "");
  return routes.some((route) => route.path === clean) ? clean : "/";
}

function mod(n, m) {
  return ((n % m) + m) % m;
}

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function expFollow(speed, delta) {
  return 1 - Math.exp(-speed * Math.min(delta, 0.033));
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

const TAU = Math.PI * 2;

const STRIP_RADIUS = 2.66;
const STRIP_HALF_WIDTH = 0.6;
const PANEL_DENSITY_BASE = 16;
const PANEL_ASPECT = 0.52 / 0.94;
const IDLE_LOOP_SPEED = 0.022;
const blockedRaycast = () => null;

function mobiusPoint(u, v, radius = STRIP_RADIUS) {
  const half = u / 2;
  const r = radius + v * Math.cos(half);

  return new THREE.Vector3(
    r * Math.cos(u),
    v * Math.sin(half),
    r * Math.sin(u)
  );
}

function mobiusFrame(u, v = 0, radius = STRIP_RADIUS) {
  const eps = 0.001;
  const p = mobiusPoint(u, v, radius);
  const pu1 = mobiusPoint(u + eps, v, radius);
  const pu0 = mobiusPoint(u - eps, v, radius);
  const pv1 = mobiusPoint(u, v + eps, radius);
  const pv0 = mobiusPoint(u, v - eps, radius);

  const tangent = pu1.sub(pu0).normalize();
  const across = pv1.sub(pv0).normalize();
  const normal = new THREE.Vector3().crossVectors(across, tangent).normalize();

  return { position: p, tangent, across, normal };
}

function createMobiusGeometry(
  radius = STRIP_RADIUS,
  halfWidth = STRIP_HALF_WIDTH,
  radialSegments = 420,
  widthSegments = 30
) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= radialSegments; i++) {
    const u = (i / radialSegments) * TAU;

    for (let j = 0; j <= widthSegments; j++) {
      const v = (j / widthSegments - 0.5) * halfWidth * 2;
      const p = mobiusPoint(u, v, radius);
      positions.push(p.x, p.y, p.z);
      uvs.push(i / radialSegments, j / widthSegments);
    }
  }

  const row = widthSegments + 1;

  for (let i = 0; i < radialSegments; i++) {
    for (let j = 0; j < widthSegments; j++) {
      const a = i * row + j;
      const b = (i + 1) * row + j;
      const c = (i + 1) * row + j + 1;
      const d = i * row + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function createLoopPoints(v, count = 480) {
  const points = [];

  for (let i = 0; i <= count; i++) {
    const u = (i / count) * TAU;
    const p = mobiusPoint(u, v, STRIP_RADIUS);
    points.push([p.x, p.y, p.z]);
  }

  return points;
}

function createRibs() {
  return Array.from({ length: 52 }, (_, i) => {
    const u = (i / 52) * TAU;

    return Array.from({ length: 18 }, (_, j) => {
      const v = THREE.MathUtils.lerp(-STRIP_HALF_WIDTH, STRIP_HALF_WIDTH, j / 17);
      const p = mobiusPoint(u, v, STRIP_RADIUS);
      return [p.x, p.y, p.z];
    });
  });
}

function useArtworkTexture(image) {
  const loadedTexture = useLoader(THREE.TextureLoader, image);
  const texture = useMemo(() => {
    const nextTexture = loadedTexture.clone();
    const imageAspect =
      loadedTexture.image?.width && loadedTexture.image?.height
        ? loadedTexture.image.width / loadedTexture.image.height
        : PANEL_ASPECT;

    if (imageAspect > PANEL_ASPECT) {
      nextTexture.repeat.set(PANEL_ASPECT / imageAspect, 1);
      nextTexture.offset.set((1 - nextTexture.repeat.x) / 2, 0);
    } else {
      nextTexture.repeat.set(1, imageAspect / PANEL_ASPECT);
      nextTexture.offset.set(0, (1 - nextTexture.repeat.y) / 2);
    }

    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.anisotropy = 12;
    nextTexture.wrapS = THREE.ClampToEdgeWrapping;
    nextTexture.wrapT = THREE.ClampToEdgeWrapping;
    nextTexture.needsUpdate = true;

    return nextTexture;
  }, [loadedTexture]);

  useEffect(() => () => texture.dispose(), [texture]);

  return texture;
}

function MobiusBand() {
  const geometry = useMemo(() => createMobiusGeometry(), []);
  const topEdge = useMemo(() => createLoopPoints(STRIP_HALF_WIDTH), []);
  const bottomEdge = useMemo(() => createLoopPoints(-STRIP_HALF_WIDTH), []);
  const centerLine = useMemo(() => createLoopPoints(0), []);
  const blueGuide = useMemo(() => createLoopPoints(-STRIP_HALF_WIDTH * 0.48), []);
  const paleGuide = useMemo(() => createLoopPoints(STRIP_HALF_WIDTH * 0.48), []);
  const ribs = useMemo(() => createRibs(), []);

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#081321"
          roughness={0.34}
          metalness={0.38}
          clearcoat={0.9}
          clearcoatRoughness={0.16}
          transparent
          opacity={0.74}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh geometry={geometry} scale={[1.012, 1.012, 1.012]}>
        <meshBasicMaterial
          color="#6fd6ff"
          transparent
          opacity={0.07}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      <Line points={topEdge} color="#f4fcff" lineWidth={1.82} transparent opacity={1} />
      <Line points={bottomEdge} color="#74ceff" lineWidth={1.38} transparent opacity={0.86} />
      <Line points={centerLine} color="#e4f8ff" lineWidth={0.92} transparent opacity={0.62} />
      <Line points={blueGuide} color="#83bdff" lineWidth={0.76} transparent opacity={0.46} />
      <Line points={paleGuide} color="#c6efff" lineWidth={0.74} transparent opacity={0.4} />

      {ribs.map((rib, i) => (
        <Line
          key={i}
          points={rib}
          color="#dff3ff"
          lineWidth={0.56}
          transparent
          opacity={i % 4 === 0 ? 0.32 : 0.1}
        />
      ))}
    </group>
  );
}

function TwistAccent({ motionRef }) {
  const tracer = useRef(null);
  const halo = useRef(null);

  const accentPath = useMemo(
    () => createLoopPoints(STRIP_HALF_WIDTH * 0.82),
    []
  );

  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.033);
    const intro = smoothstep(0.3, 2.2, state.clock.elapsedTime);

    const u = mod(
      motionRef.current.progress * 1.02 + state.clock.elapsedTime * 0.11,
      TAU
    );

    const frame = mobiusFrame(u, STRIP_HALF_WIDTH * 0.82, STRIP_RADIUS);
    const target = frame.position
      .clone()
      .add(frame.normal.clone().multiplyScalar(0.04));

    if (tracer.current) {
      tracer.current.position.lerp(target, 1 - Math.exp(-8 * safeDelta));
      tracer.current.material.opacity = THREE.MathUtils.damp(
        tracer.current.material.opacity,
        0.95 * intro,
        5,
        safeDelta
      );
    }

    if (halo.current) {
      halo.current.position.lerp(target, 1 - Math.exp(-6 * safeDelta));
      halo.current.scale.setScalar(
        THREE.MathUtils.damp(
          halo.current.scale.x || 0,
          1 + Math.sin(state.clock.elapsedTime * 2.4) * 0.08,
          5,
          safeDelta
        )
      );
      halo.current.material.opacity = THREE.MathUtils.damp(
        halo.current.material.opacity,
        0.18 * intro,
        4,
        safeDelta
      );
    }
  });

  return (
    <group>
      <Line
        points={accentPath}
        color="#9adfff"
        lineWidth={1.08}
        transparent
        opacity={0.2}
      />

      <mesh ref={halo}>
        <sphereGeometry args={[0.07, 18, 18]} />
        <meshBasicMaterial
          color="#7fd8ff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={tracer}>
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function FlowBeads({ motionRef }) {
  const beads = useRef([]);
  const beadData = useMemo(
    () => [
      { v: STRIP_HALF_WIDTH, offset: 0.0, size: 0.036, color: "#e9fbff", speed: 1.0 },
      { v: STRIP_HALF_WIDTH, offset: 2.1, size: 0.026, color: "#8fd6ff", speed: 0.9 },
      { v: -STRIP_HALF_WIDTH, offset: 0.85, size: 0.032, color: "#7fd0ff", speed: 1.0 },
      { v: -STRIP_HALF_WIDTH, offset: 3.15, size: 0.022, color: "#d4f3ff", speed: 0.85 },
      { v: 0, offset: 4.1, size: 0.018, color: "#ffffff", speed: 0.75 },
    ],
    []
  );

  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.033);

    beadData.forEach((bead, i) => {
      const mesh = beads.current[i];
      if (!mesh) return;

      const u = mod(
        motionRef.current.progress * bead.speed + bead.offset + state.clock.elapsedTime * 0.08,
        TAU
      );
      const frame = mobiusFrame(u, bead.v, STRIP_RADIUS);
      const intro = smoothstep(0.25, 2.3, state.clock.elapsedTime);
      const pulse = (0.8 + Math.sin(state.clock.elapsedTime * 2.2 + i) * 0.2) * intro;

      mesh.position.copy(frame.position.clone().add(frame.normal.clone().multiplyScalar(0.035)));
      mesh.scale.setScalar(THREE.MathUtils.damp(mesh.scale.x || 0, pulse, 8, safeDelta));
      mesh.material.opacity = THREE.MathUtils.damp(mesh.material.opacity, 0.86 * intro, 5, safeDelta);
    });
  });

  return (
    <group>
      {beadData.map((bead, i) => (
        <mesh key={i} ref={(el) => (beads.current[i] = el)}>
          <sphereGeometry args={[bead.size, 16, 16]} />
          <meshBasicMaterial color={bead.color} transparent opacity={0} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function FloatingPoetry() {
  const outerRing = useRef(null);
  const ring = useRef(null);
  const innerRing = useRef(null);

  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.033);
    const intro = smoothstep(0.45, 2.6, state.clock.elapsedTime);

    if (outerRing.current) {
      outerRing.current.rotation.z += safeDelta * 0.016;
      outerRing.current.material.opacity = THREE.MathUtils.damp(
        outerRing.current.material.opacity,
        0.05 * intro,
        3,
        safeDelta
      );
    }

    if (ring.current) {
      ring.current.rotation.z += safeDelta * 0.035;
      ring.current.material.opacity = THREE.MathUtils.damp(
        ring.current.material.opacity,
        0.14 * intro,
        3,
        safeDelta
      );
    }

    if (innerRing.current) {
      innerRing.current.rotation.z -= safeDelta * 0.025;
      innerRing.current.material.opacity = THREE.MathUtils.damp(
        innerRing.current.material.opacity,
        0.07 * intro,
        3,
        safeDelta
      );
    }
  });

  return (
    <group>
      <mesh ref={outerRing} position={[0, -0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.02, 0.0024, 8, 260]} />
        <meshBasicMaterial
          color="#67ccff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={ring} position={[0, -0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.28, 0.0038, 8, 220]} />
        <meshBasicMaterial
          color="#cbeeff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={innerRing} position={[0, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.72, 0.0026, 8, 180]} />
        <meshBasicMaterial
          color="#8ed8ff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function ArtworkPanel({ index, count, art, motionRef, onSelect }) {
  const frame = useRef(null);
  const panel = useRef(null);
  const ghost = useRef(null);
  const glow = useRef(null);
  const inlay = useRef(null);
  const [hovered, setHovered] = useState(false);

  useCursor(hovered);

  const texture = useArtworkTexture(art.thumbnail);

  useFrame((state, delta) => {
    if (!frame.current || !panel.current || !ghost.current) return;

    const safeDelta = Math.min(delta, 0.033);
    const motion = motionRef.current;
    const panelIsBlocked = performance.now() < (motion.interactionBlockedUntil ?? 0);

    panel.current.raycast = panelIsBlocked ? blockedRaycast : THREE.Mesh.prototype.raycast;
    if (panelIsBlocked && hovered) setHovered(false);

    const base = ((index + 0.5) / count) * TAU;
    const u = mod(base + motion.progress, TAU);
    const mobius = mobiusFrame(u, 0, STRIP_RADIUS);

    const localCamera = state.camera.position.clone();
    frame.current.parent?.worldToLocal(localCamera);

    const cameraDir = localCamera.clone().sub(mobius.position).normalize();

    let yAxis = mobius.across.clone().normalize();
    let zAxis = mobius.normal.clone().normalize();

    const dotToCamera = zAxis.dot(cameraDir);

    if (frame.current.userData.side == null) {
      frame.current.userData.side = dotToCamera >= 0 ? 1 : -1;
    }

    if (frame.current.userData.side === 1 && dotToCamera < -0.22) {
      frame.current.userData.side = -1;
    } else if (frame.current.userData.side === -1 && dotToCamera > 0.22) {
      frame.current.userData.side = 1;
    }

    if (frame.current.userData.side === -1) {
      yAxis.multiplyScalar(-1);
      zAxis.multiplyScalar(-1);
    }

    const radialDirection = mobius.position.clone();
    radialDirection.y = 0;
    radialDirection.normalize();

    const cameraRadial = localCamera.clone();
    cameraRadial.y = 0;
    cameraRadial.normalize();

    const facingArc = (radialDirection.dot(cameraRadial) + 1) / 2;
    const focus = smoothstep(0.12, 0.92, facingArc);
    const backness = 1 - focus;

    const cameraUp = new THREE.Vector3(0, 1, 0);
    const uprightStrength = smoothstep(0.5, 0.95, focus);

    if (uprightStrength > 0.001) {
      const readableUp = yAxis.clone().lerp(cameraUp, uprightStrength * 0.88).normalize();
      yAxis.copy(readableUp);
    }

    const faceAssist = focus * 0.08;
    zAxis.lerp(cameraDir, faceAssist).normalize();

    yAxis.sub(zAxis.clone().multiplyScalar(yAxis.dot(zAxis))).normalize();
    if (yAxis.lengthSq() < 0.001) yAxis.set(0, 1, 0);

    let xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
    yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

    if (focus > 0.55 && yAxis.dot(cameraUp) < 0) {
      xAxis.multiplyScalar(-1);
      yAxis.multiplyScalar(-1);
    }

    const lift = hovered ? 0.12 : 0.045 + focus * 0.04;
    const cardCenter = mobius.position.clone().add(zAxis.clone().multiplyScalar(lift));
    const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
    );

    const follow = expFollow(8, safeDelta);
    if (!frame.current.userData.ready) {
      frame.current.position.copy(cardCenter);
      frame.current.quaternion.copy(targetQuaternion);
      frame.current.userData.ready = true;
    } else {
      frame.current.position.lerp(cardCenter, follow);
      frame.current.quaternion.slerp(targetQuaternion, follow);
    }

    const intro = smoothstep(0.05, 2.1, state.clock.elapsedTime);
    const densityScale = Math.min(1, Math.sqrt(PANEL_DENSITY_BASE / count));
    const targetScale =
      (hovered ? 1.2 : 0.76 + focus * 0.44) * (0.82 + intro * 0.18) * densityScale;
    const targetOpacity = (hovered ? 1 : 0.42 + focus * 0.58) * intro;
    const ghostOpacity = (hovered ? 0.08 : 0.035 + backness * 0.26) * intro;
    const ghostScale = 0.92 + backness * 0.08;

    panel.current.scale.x = THREE.MathUtils.damp(panel.current.scale.x, targetScale, 6.4, safeDelta);
    panel.current.scale.y = THREE.MathUtils.damp(panel.current.scale.y, targetScale, 6.4, safeDelta);

    panel.current.material.opacity = THREE.MathUtils.damp(
      panel.current.material.opacity,
      targetOpacity,
      6,
      safeDelta
    );

    ghost.current.material.opacity = THREE.MathUtils.damp(
      ghost.current.material.opacity,
      ghostOpacity,
      5,
      safeDelta
    );
    ghost.current.scale.x = THREE.MathUtils.damp(ghost.current.scale.x, ghostScale, 5, safeDelta);
    ghost.current.scale.y = THREE.MathUtils.damp(ghost.current.scale.y, ghostScale, 5, safeDelta);

    if (glow.current) {
      glow.current.material.opacity = THREE.MathUtils.damp(
        glow.current.material.opacity,
        hovered ? 0.25 : 0.06 + focus * 0.16,
        5,
        safeDelta
      );
    }

    if (inlay.current) {
      inlay.current.material.opacity = THREE.MathUtils.damp(
        inlay.current.material.opacity,
        hovered ? 0.8 : 0.5 + focus * 0.24,
        5,
        safeDelta
      );
    }
  });

  return (
    <group ref={frame}>
      <mesh ref={glow} position={[0, 0, -0.012]}>
        <planeGeometry args={[0.74, 1.24]} />
        <meshBasicMaterial
          color="#9bc7ff"
          transparent
          opacity={0.06}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={inlay} position={[0, 0, -0.007]}>
        <planeGeometry args={[0.62, 1.06]} />
        <meshBasicMaterial
          color="#010309"
          transparent
          opacity={0.52}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={ghost} position={[0, 0, -0.016]} renderOrder={2}>
        <planeGeometry args={[0.54, 0.94, 1, 1]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={0.12}
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh
        ref={panel}
        position={[0, 0, 0.004]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          if (performance.now() < (motionRef.current.interactionBlockedUntil ?? 0)) return;
          onSelect(art);
        }}
      >
        <planeGeometry args={[0.52, 0.94, 1, 1]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={0.98}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

const MemoizedArtworkPanel = memo(ArtworkPanel);

function Scene({ motionRef, onSelect, onProgress }) {
  const group = useRef(null);
  const previousProgressIndex = useRef(-1);

  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.033);
    const motion = motionRef.current;

    motion.progress = mod(motion.progress + (IDLE_LOOP_SPEED + motion.velocity) * safeDelta, TAU);
    motion.velocity *= Math.pow(0.92, safeDelta * 60);
    if (Math.abs(motion.velocity) < 0.1) motion.velocity = 0;

    const progressIndex = mod(Math.round((-motion.progress / TAU) * artworks.length), artworks.length);
    if (progressIndex !== previousProgressIndex.current) {
      previousProgressIndex.current = progressIndex;
      onProgress(progressIndex);
    }

    if (group.current) {
      const intro = smoothstep(0.05, 2.2, state.clock.elapsedTime);
      const targetScale = 0.82 + intro * 0.05;
      const nextScale = THREE.MathUtils.damp(group.current.scale.x, targetScale, 3.2, safeDelta);
      group.current.scale.setScalar(nextScale);
      group.current.position.y = THREE.MathUtils.damp(
        group.current.position.y,
        0.06 + (1 - intro) * 0.18,
        3.2,
        safeDelta
      );

      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -0.5, 2, safeDelta);
      group.current.rotation.y = THREE.MathUtils.damp(
        group.current.rotation.y,
        -0.24 + Math.sin(state.clock.elapsedTime * 0.12) * 0.045,
        2,
        safeDelta
      );
      group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, 0.07, 2, safeDelta);
    }
  });

  return (
    <>
      <color attach="background" args={["#02040a"]} />
      <fog attach="fog" args={["#02040a", 5.9, 12.4]} />

      <ambientLight intensity={1.08} />
      <directionalLight position={[3.2, 4.7, 4.2]} intensity={2.75} castShadow />
      <pointLight position={[-3.2, -0.6, -2.5]} intensity={4.8} color="#79c9ff" />
      <pointLight position={[3.0, 1.2, 2.8]} intensity={3.8} color="#5fbfff" />
      <pointLight position={[0, 2.2, 4.5]} intensity={2.35} color="#ffffff" />

      <group ref={group} position={[0, 0.24, 0]} scale={[0.82, 0.82, 0.82]}>
        <MobiusBand />
        <FloatingPoetry />
        <TwistAccent motionRef={motionRef} />
        <FlowBeads motionRef={motionRef} />

        {artworks.map((art, i) => (
          <MemoizedArtworkPanel
            key={art.title}
            index={i}
            count={artworks.length}
            art={art}
            motionRef={motionRef}
            onSelect={onSelect}
          />
        ))}
      </group>

      <Environment preset="night" />
    </>
  );
}

const MemoizedScene = memo(Scene);

function ArtworkModal({ art, onClose, onInquire, onNavigate }) {
  useEffect(() => {
    if (!art) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onNavigate(-1);
      if (event.key === "ArrowRight") onNavigate(1);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [art, onClose, onNavigate]);

  return (
    <AnimatePresence>
      {art && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/72 p-5 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={onClose}
        >
          <motion.div
            className="relative grid max-h-[92vh] w-full max-w-6xl grid-cols-1 overflow-y-auto rounded-lg border border-sky-200/20 bg-[#071423]/97 shadow-[0_0_100px_rgba(56,189,248,0.18)] md:grid-cols-[1.35fr_0.65fr]"
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close artwork detail"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/55 text-xl leading-none text-white opacity-60 backdrop-blur-sm transition hover:opacity-100"
            >
              ×
            </button>

            <div className="relative min-h-[360px] overflow-hidden bg-black/65 md:min-h-[620px]">
              <img
                src={art.image}
                alt={art.title}
                decoding="async"
                className="absolute inset-0 h-full w-full object-contain object-center"
              />

              <div className="absolute inset-0 shadow-[inset_0_0_90px_rgba(125,211,252,0.10)]" />
            </div>

            <div className="relative flex flex-col justify-between bg-[linear-gradient(180deg,rgba(10,24,39,0.96),rgba(6,17,30,0.98))] p-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.10),transparent_32%)]" />

              <div className="relative">
                <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-sky-100/45">
                  <span className="h-px w-10 bg-sky-200/50" />
                  selected work
                </div>

                <h2 className="text-4xl font-semibold leading-[1.15] tracking-tight text-white md:text-6xl">
                  {art.title}
                </h2>

                <div className="mt-5 text-[13px] uppercase tracking-[0.1em] text-sky-100/50">
                  {art.year} · {art.medium}
                </div>

                <div className="mt-10 flex items-center gap-5 border-t border-white/10 pt-5 text-xs uppercase tracking-[0.16em] text-sky-100/52">
                  <button
                    type="button"
                    onClick={() => onNavigate(-1)}
                    className="cursor-pointer transition hover:text-white"
                  >
                    ← previous
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate(1)}
                    className="cursor-pointer transition hover:text-white"
                  >
                    next →
                  </button>
                </div>
              </div>

              <div className="relative mt-10 grid gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-fit cursor-pointer text-sm text-sky-100/68 transition hover:text-white"
                >
                  ← Back to archive
                </button>
                <button
                  type="button"
                  onClick={() => onInquire(art)}
                  className="w-fit cursor-pointer border-b border-sky-100/25 pb-1 text-sm text-sky-100/58 transition hover:border-sky-100/60 hover:text-white"
                >
                  Ask about this piece
                </button>
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
    <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
      {artworksToShow.map((art, i) => (
        <button
          key={art.title}
          onClick={() => onSelect(art)}
          className="group grid min-h-[220px] bg-[#060b14] text-left transition hover:bg-[#0b1422] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-100"
        >
          <div className="grid h-full grid-rows-[1fr_auto]">
            <img
              src={art.thumbnail}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full min-h-32 w-full object-cover object-center opacity-90 transition duration-500 group-hover:opacity-100"
            />
            <div className="p-5">
              <div className="text-[11px] uppercase tracking-[0.22em] text-sky-100/42">
                <span>{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-5 text-2xl font-semibold text-white">{art.title}</h3>
              <p className="mt-2 text-sm text-sky-100/58">{art.medium}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function PageShell({ eyebrow, title, intro, children, aside }) {
  return (
    <section className="relative min-h-screen px-5 pb-20 pt-28 md:pb-24 md:pt-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 border-b border-white/10 pb-9 lg:grid-cols-[0.95fr_0.75fr] lg:items-end">
          <div>
            <div className="text-xs uppercase tracking-[0.34em] text-sky-100/42">{eyebrow}</div>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.025em] text-white md:text-6xl">
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

function ArcCarousel({ artworks, navigate, onSelect }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchRef = useRef({ active: false, startX: 0, startY: 0 });
  const pointerRef = useRef({ active: false, startX: 0, startY: 0 });
  const intervalRef = useRef(null);
  const count = artworks.length;

  const advance = useCallback((direction) => {
    if (count === 0) return;
    setActiveIndex((index) => mod(index + direction, count));
  }, [count]);

  const startAutoRotate = useCallback(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (count <= 1) return;
    intervalRef.current = window.setInterval(() => advance(1), 3500);
  }, [advance, count]);

  const rotateBy = useCallback((direction, userTriggered = false) => {
    advance(direction);
    if (userTriggered) startAutoRotate();
  }, [advance, startAutoRotate]);

  useEffect(() => {
    startAutoRotate();
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [startAutoRotate]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        rotateBy(1, true);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        rotateBy(-1, true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rotateBy]);

  if (count === 0) return null;

  const visiblePositions = [-3, -2, -1, 0, 1, 2, 3];
  const activeArtwork = artworks[activeIndex];
  const dotWindow = Math.min(9, count);
  const dotStart = activeIndex - Math.floor(dotWindow / 2);
  const dotIndices = Array.from({ length: dotWindow }, (_, index) => mod(dotStart + index, count));
  const cardStyles = {
    "-3": { angle: 30, width: 70, height: 94, opacity: 0.2, zIndex: 2, x: -168, top: 278 },
    "-2": { angle: -28, width: 84, height: 114, opacity: 0.4, zIndex: 3, x: -128, top: 162 },
    "-1": { angle: 11, width: 108, height: 146, opacity: 0.72, zIndex: 4, x: -70, top: 72 },
    0: { angle: 0, width: 154, height: 206, opacity: 1, zIndex: 8, x: 0, top: 130 },
    1: { angle: -11, width: 108, height: 146, opacity: 0.72, zIndex: 4, x: 70, top: 72 },
    2: { angle: 28, width: 84, height: 114, opacity: 0.4, zIndex: 3, x: 128, top: 162 },
    3: { angle: -30, width: 70, height: 94, opacity: 0.2, zIndex: 2, x: 168, top: 278 },
  };

  return (
    <div
      className="relative h-[100dvh] min-h-[720px] overflow-y-auto overflow-x-hidden bg-[#02040a] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(96px+env(safe-area-inset-top))] text-white outline-none"
      tabIndex={0}
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
          rotateBy(dx < 0 ? 1 : -1, true);
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
          rotateBy(dx < 0 ? 1 : -1, true);
        }
      }}
      onPointerLeave={() => {
        pointerRef.current.active = false;
      }}
    >
      <style>
        {`
          @keyframes mobile-mobius-breathe {
            0%, 100% { transform: translateY(0) rotate(-1.2deg) scale(1); opacity: 0.9; }
            50% { transform: translateY(10px) rotate(1.6deg) scale(1.025); opacity: 1; }
          }

          @keyframes mobile-mobius-dash {
            to { stroke-dashoffset: -46; }
          }

          @keyframes mobile-card-float {
            0%, 100% { filter: brightness(0.98) drop-shadow(0 16px 28px rgba(56,189,248,0.08)); }
            50% { filter: brightness(1.1) drop-shadow(0 24px 42px rgba(125,211,252,0.18)); }
          }

          @keyframes mobile-stage-drift {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-7px) scale(1.01); }
          }
        `}
      </style>

      <div className="pointer-events-none absolute right-5 top-[108px] z-20 font-mono text-xs text-white/30">
        {String(activeIndex + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
      </div>

      <div
        className="relative mx-auto h-[470px] w-full max-w-[430px] shrink-0"
        style={{ animation: "mobile-stage-drift 7s ease-in-out infinite" }}
      >
        <div className="pointer-events-none absolute left-1/2 top-[96px] h-72 w-[128vw] max-w-[560px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.055),rgba(255,255,255,0.018)_36%,transparent_72%)] blur-xl" />

        <svg
          className="pointer-events-none absolute inset-x-1/2 top-0 h-full w-[128vw] max-w-[560px] -translate-x-1/2 overflow-visible"
          viewBox="0 0 390 470"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="mobileMobiusRibbon" x1="42" y1="132" x2="350" y2="336" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="rgba(255,255,255,0.05)" />
              <stop offset="0.18" stopColor="rgba(180,224,255,0.22)" />
              <stop offset="0.42" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="0.55" stopColor="rgba(2,4,10,0.62)" />
              <stop offset="0.72" stopColor="rgba(255,255,255,0.2)" />
              <stop offset="1" stopColor="rgba(106,189,255,0.07)" />
            </linearGradient>
            <linearGradient id="mobileMobiusBack" x1="342" y1="130" x2="46" y2="340" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="rgba(255,255,255,0.045)" />
              <stop offset="0.42" stopColor="rgba(255,255,255,0.13)" />
              <stop offset="0.6" stopColor="rgba(3,7,13,0.7)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.06)" />
            </linearGradient>
            <linearGradient id="mobileMobiusEdge" x1="35" y1="168" x2="360" y2="292" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="rgba(255,255,255,0.2)" />
              <stop offset="0.36" stopColor="rgba(255,255,255,0.72)" />
              <stop offset="0.64" stopColor="rgba(123,210,255,0.34)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.18)" />
            </linearGradient>
            <filter id="mobileMobiusGlow" x="-20%" y="-35%" width="140%" height="170%">
              <feGaussianBlur stdDeviation="2.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g style={{ animation: "mobile-mobius-breathe 6.5s ease-in-out infinite" }}>
            <ellipse cx="195" cy="305" rx="174" ry="76" fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
            <ellipse cx="195" cy="315" rx="124" ry="50" fill="none" stroke="rgba(255,255,255,0.032)" strokeWidth="1" />
            <path
              d="M37 251 C84 153 135 137 194 237 C256 343 314 335 354 244 C309 132 255 136 195 244 C134 354 82 335 37 251"
              fill="none"
              stroke="rgba(0,0,0,0.86)"
              strokeLinecap="round"
              strokeWidth="62"
            />
            <path
              d="M38 252 C82 147 135 133 195 238 C257 346 312 339 354 244"
              fill="none"
              stroke="url(#mobileMobiusRibbon)"
              strokeLinecap="round"
              strokeWidth="42"
            />
            <path
              d="M354 244 C310 139 255 133 195 244 C135 353 82 341 38 252"
              fill="none"
              stroke="url(#mobileMobiusBack)"
              strokeLinecap="round"
              strokeWidth="42"
            />
            <path
              d="M38 252 C82 147 135 133 195 238 C257 346 312 339 354 244"
              fill="none"
              filter="url(#mobileMobiusGlow)"
              stroke="url(#mobileMobiusEdge)"
              strokeLinecap="round"
              strokeWidth="2"
            />
            <path
              d="M354 244 C310 139 255 133 195 244 C135 353 82 341 38 252"
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeLinecap="round"
              strokeWidth="1.45"
            />
            <path
              d="M38 252 C82 147 135 133 195 238 C257 346 312 339 354 244 C310 139 255 133 195 244 C135 353 82 341 38 252"
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeDasharray="1 11"
              strokeLinecap="round"
              strokeWidth="1"
              style={{ animation: "mobile-mobius-dash 4.8s linear infinite" }}
            />
            <path
              d="M160 191 C175 217 187 236 195 238 C207 240 222 271 237 306"
              fill="none"
              stroke="rgba(0,0,0,0.88)"
              strokeLinecap="round"
              strokeWidth="28"
            />
            <path
              d="M160 191 C175 217 187 236 195 238 C207 240 222 271 237 306"
              fill="none"
              stroke="rgba(255,255,255,0.34)"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
            <path
              d="M58 248 C70 261 80 280 87 306 M82 178 C99 185 115 206 126 232 M137 137 C152 151 166 174 178 204 M222 272 C232 300 248 324 268 340 M274 340 C291 349 313 342 334 319 M309 151 C326 167 340 196 350 235"
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeLinecap="round"
              strokeWidth="0.85"
            />
            <path
              d="M57 251 C94 158 142 153 195 238 C250 331 302 326 336 245"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeLinecap="round"
              strokeWidth="0.9"
            />
            <path
              d="M336 245 C302 156 250 153 195 244 C142 336 94 328 57 251"
              fill="none"
              stroke="rgba(255,255,255,0.055)"
              strokeDasharray="4 8"
              strokeLinecap="round"
              strokeWidth="0.9"
            />
            <circle r="3.5" fill="rgba(255,255,255,0.86)">
              <animateMotion dur="5.4s" repeatCount="indefinite" path="M38 252 C82 147 135 133 195 238 C257 346 312 339 354 244 C310 139 255 133 195 244 C135 353 82 341 38 252" />
            </circle>
            <circle r="2.4" fill="rgba(190,230,255,0.7)">
              <animateMotion begin="-2.7s" dur="5.4s" repeatCount="indefinite" path="M38 252 C82 147 135 133 195 238 C257 346 312 339 354 244 C310 139 255 133 195 244 C135 353 82 341 38 252" />
            </circle>
            <circle r="1.7" fill="rgba(255,255,255,0.55)">
              <animateMotion begin="-1.3s" dur="7.2s" repeatCount="indefinite" path="M38 252 C82 147 135 133 195 238 C257 346 312 339 354 244 C310 139 255 133 195 244 C135 353 82 341 38 252" />
            </circle>
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
                aria-label={position === 0 ? `Open ${art.title}` : position > 0 ? "Next artwork" : "Previous artwork"}
                onClick={() => {
                  if (position === 0) {
                    onSelect(art);
                    startAutoRotate();
                  } else {
                    rotateBy(position, true);
                  }
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
                    "transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.35s ease, width 0.35s ease, height 0.35s ease",
                  border: position === 0 ? "1px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.08)",
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
            onClick={() => rotateBy(-1, true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.035] text-3xl leading-none text-white/70 transition hover:border-white/28 hover:text-white"
          >
            ‹
          </button>

          <h2 className="min-w-0 flex-1 text-lg font-bold leading-tight text-white">{activeArtwork.title}</h2>

          <button
            type="button"
            aria-label="Next artwork"
            onClick={() => rotateBy(1, true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.035] text-3xl leading-none text-white/70 transition hover:border-white/28 hover:text-white"
          >
            ›
          </button>
        </div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.12em] text-white/30">
          mobius archive
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
          A brief inquiry into online relationships.
        </h1>
        <p className="mt-3 max-w-sm text-xs leading-5 text-sky-100/52">
          Pirate King Fanpage traces intimacy, identity, distance, and devotion through an endless gallery of digital-age artifacts.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate("/work")}
            className="rounded-full bg-sky-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-black transition hover:bg-white"
          >
            view archive
          </button>
          <button
            type="button"
            onClick={() => navigate("/contact")}
            className="rounded-full border border-sky-100/20 bg-black/20 px-4 py-2.5 text-xs uppercase tracking-[0.16em] text-sky-100/72 transition hover:border-sky-100/40 hover:text-white"
          >
            contact
          </button>
        </div>
      </div>
    </div>
  );
}

function HomePage({ motionRef, onSelect, navigate }) {
  const isMobile = useIsMobile();
  const isDocumentVisible = useDocumentVisibility();
  const { active: assetsLoading, progress: assetsProgress, total: assetTotal } = useProgress();
  const [carouselReadyFallback, setCarouselReadyFallback] = useState(false);
  const [activeArtworkIndex, setActiveArtworkIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const syncProgress = useCallback((index) => setActiveArtworkIndex(index), []);
  const carouselReady =
    carouselReadyFallback || (assetTotal > 0 && !assetsLoading && assetsProgress >= 100);

  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => setCarouselReadyFallback(true), 2600);
    return () => window.clearTimeout(fallbackTimer);
  }, []);

  useEffect(() => {
    let showTimer;
    let hideTimer;

    try {
      if (window.localStorage.getItem("hint_seen")) return undefined;
      window.localStorage.setItem("hint_seen", "true");
    } catch {
      // The hint remains available when storage is disabled.
    }

    showTimer = window.setTimeout(() => setShowHint(true), 1500);
    hideTimer = window.setTimeout(() => setShowHint(false), 5000);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <section className="relative min-h-[100dvh] w-screen md:h-screen md:min-h-[680px]">
      <motion.div
        className="absolute inset-0 [will-change:transform]"
        initial={{ opacity: 0 }}
        animate={{ opacity: isMobile || carouselReady ? 1 : 0.16 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        {isMobile ? (
          <ArcCarousel artworks={artworks} navigate={navigate} onSelect={onSelect} />
        ) : (
          <Canvas
            camera={{ position: [0, 1.2, 7.6], fov: 39 }}
            dpr={[1, 2]}
            frameloop={isDocumentVisible ? "always" : "never"}
            shadows
            gl={{ antialias: true, alpha: false }}
          >
            <Suspense fallback={null}>
              <MemoizedScene motionRef={motionRef} onSelect={onSelect} onProgress={syncProgress} />
            </Suspense>
          </Canvas>
        )}
      </motion.div>

      <AnimatePresence>
        {!isMobile && !carouselReady && (
          <motion.div
            className="pointer-events-none absolute left-1/2 top-[31%] z-10 h-28 w-56 -translate-x-1/2 rounded-[50%] border border-sky-100/20 shadow-[0_0_54px_rgba(125,211,252,0.12)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.2, 0.62, 0.2] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      <div
        className="pointer-events-none absolute left-1/2 top-[55%] z-20 hidden -translate-x-1/2 items-center gap-1.5 md:flex"
        aria-label={`Artwork ${activeArtworkIndex + 1} of ${artworks.length}`}
      >
        {artworks.map((art, index) => (
          <span
            key={art.title}
            className={`h-1 rounded-full transition-all duration-300 ${
              index === activeArtworkIndex ? "w-7 bg-sky-100/80" : "w-1.5 bg-sky-100/22"
            }`}
          />
        ))}
      </div>

      <AnimatePresence>
        {!isMobile && showHint && (
          <motion.div
            className="pointer-events-none absolute left-1/2 top-[59%] z-20 -translate-x-1/2 text-center text-[11px] uppercase tracking-[0.24em] text-sky-100/52"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            wheel, drag, or click a panel
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 hidden px-5 pb-8 md:block md:px-10 md:pb-10">
        <div>
          <motion.h1
            className="max-w-3xl text-3xl font-semibold leading-[1.08] tracking-[-0.02em] text-white md:text-5xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          >
            A brief inquiry into online relationships.
          </motion.h1>

          <motion.p
            className="mt-4 max-w-xl text-sm leading-6 text-sky-100/58 md:text-base md:leading-7"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease: "easeOut" }}
          >
            Pirate King Fanpage traces intimacy, identity, distance, and devotion through an endless gallery of digital-age artifacts.
          </motion.p>

          <div className="pointer-events-auto mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/work")}
              className="rounded-full bg-sky-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-white"
            >
              view archive
            </button>
            <button
              onClick={() => navigate("/contact")}
              className="rounded-full border border-sky-100/20 bg-black/20 px-4 py-2.5 text-xs uppercase tracking-[0.16em] text-sky-100/72 transition hover:border-sky-100/40 hover:text-white"
            >
              contact
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkPage({ onSelect }) {
  return (
    <PageShell
      eyebrow="work"
      title="The archive."
      intro="Open a piece to spend more time with it."
    >
      <div className="mt-9 border-b border-white/10 pb-6 text-sm text-sky-100/52">
        {artworks.length} works
      </div>

      <GridGallery artworksToShow={artworks} onSelect={onSelect} />
    </PageShell>
  );
}

function AboutPage() {
  return (
    <PageShell
      eyebrow="about the studio"
      title="Images for the feelings that screens make difficult to name."
      intro="The work treats online relationships as emotional architecture: places people enter, decorate, haunt, misread, and sometimes genuinely inhabit."
    >
      <div className="mt-12 grid gap-10 lg:grid-cols-[0.95fr_0.75fr]">
        <div className="space-y-8">
          <p className="max-w-3xl text-2xl leading-10 text-white/86">
            Pirate King Fanpage is built for the half-real feelings that collect around avatars, usernames, private windows, fan pages, late-night messages, and images that become more intimate because they are mediated.
          </p>
          <p className="max-w-3xl leading-8 text-sky-100/62">
            The studio blends painting, drawing, digital collage, generated texture, and interface design. The result is part exhibition, part fan archive, part confession booth.
          </p>
        </div>

        <div className="border-l border-white/10 pl-6">
          <h2 className="text-xl font-semibold text-white">What is available</h2>
          <div className="mt-6 grid gap-4">
            {services.map((service) => (
              <div key={service} className="border-b border-white/10 pb-4 text-sky-100/68">
                {service}
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function JournalPage({ navigate }) {
  return (
    <PageShell
      eyebrow="journal"
      title="Studio notes, open windows, and process fragments."
      intro="Short entries give the work a little more room: why the interface loops, how the images are built, and where commissions fit into the practice."
      aside={
        <button
          onClick={() => navigate("/contact")}
          className="mt-6 rounded-full border border-sky-100/20 px-5 py-3 text-sm uppercase tracking-[0.18em] text-sky-100/75 transition hover:border-sky-100/45 hover:text-white"
        >
          pitch a project
        </button>
      }
    >
      <div className="mt-12 divide-y divide-white/10 border-y border-white/10">
        {studioNotes.map((note) => (
          <article key={note.title} className="grid gap-5 py-7 md:grid-cols-[0.28fr_1fr_auto] md:items-center">
            <div className="text-xs uppercase tracking-[0.25em] text-sky-100/42">{note.date}</div>
            <div>
              <h2 className="text-2xl font-semibold text-white">{note.title}</h2>
              <p className="mt-3 max-w-2xl leading-7 text-sky-100/62">{note.summary}</p>
            </div>
            <span className="w-fit text-sm uppercase tracking-[0.22em] text-sky-100/38">
              note
            </span>
          </article>
        ))}
      </div>
    </PageShell>
  );
}

function ContactPage({ selectedArt, onSelectArtwork, navigate }) {
  const firstArtworkTitle = artworks[0]?.title ?? "Custom commission";
  const [form, setForm] = useState({
    name: "",
    email: "",
    interest: selectedArt?.title ?? firstArtworkTitle,
    message: "",
  });
  const [sent, setSent] = useState(false);

  const interest = selectedArt?.title ?? form.interest;

  function updateField(field, value) {
    setSent(false);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nInterest: ${interest}\n\n${form.message}`
    );
    const subject = encodeURIComponent(`Portfolio inquiry: ${interest}`);

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <section className="relative min-h-screen px-5 pb-20 pt-28 md:pb-24 md:pt-32">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.82fr_1fr]">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.34em] text-sky-100/40">contact</div>
          <h1 className="mt-4 max-w-full break-words text-3xl font-semibold leading-[1.1] tracking-[-0.025em] text-white md:text-5xl">
            Let&apos;s talk about the work.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-sky-100/60">
            Reach out directly, or use the short form to open an email draft with the useful context already included.
          </p>

          {selectedArt && (
            <div className="mt-8 flex items-center gap-4 border-y border-white/10 py-4">
              <img
                src={selectedArt.thumbnail}
                alt=""
                className="h-16 w-12 object-cover object-center"
              />
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-sky-100/38">
                  selected work
                </div>
                <div className="mt-2 text-lg font-semibold text-white">{selectedArt.title}</div>
              </div>
            </div>
          )}

          <div className="mt-8 grid gap-5 text-sm">
            <a className="group w-fit transition hover:text-white" href={`mailto:${CONTACT_EMAIL}`}>
              <span className="block text-[11px] uppercase tracking-[0.2em] text-sky-100/38">
                email
              </span>
              <span className="mt-1 block text-sky-100/72 transition group-hover:text-white">
                {CONTACT_EMAIL}
              </span>
            </a>
            <a className="group w-fit transition hover:text-white" href={`tel:${CONTACT_PHONE}`}>
              <span className="block text-[11px] uppercase tracking-[0.2em] text-sky-100/38">
                phone
              </span>
              <span className="mt-1 block text-sky-100/72 transition group-hover:text-white">
                {CONTACT_PHONE}
              </span>
            </a>
            <button className="w-fit text-left transition hover:text-white" onClick={() => navigate("/work")}>
              View the archive →
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="min-w-0 rounded-md border border-white/12 bg-white/[0.035] p-5 md:p-7">
          <div className="mb-6 text-sm leading-6 text-sky-100/58">
            Send a note
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-sky-100/68">
              Name
              <input
                required
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="min-w-0 rounded-lg border border-sky-100/14 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-sky-100/45"
              />
            </label>

            <label className="grid gap-2 text-sm text-sky-100/68">
              Reply email
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="min-w-0 rounded-lg border border-sky-100/14 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-sky-100/45"
              />
            </label>
          </div>

          <label className="mt-4 grid gap-2 text-sm text-sky-100/68">
            About
            <select
              value={interest}
              onChange={(event) => {
                updateField("interest", event.target.value);
                onSelectArtwork(null);
              }}
              className="min-w-0 rounded-lg border border-sky-100/14 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-sky-100/45"
            >
              {artworks.map((art) => (
                <option key={art.title} value={art.title}>
                  {art.title}
                </option>
              ))}
              <option value="Custom commission">Custom commission</option>
              <option value="Licensing or collaboration">Licensing or collaboration</option>
            </select>
          </label>

          <label className="mt-4 grid gap-2 text-sm text-sky-100/68">
            Message
            <textarea
              required
              rows="5"
              value={form.message}
              onChange={(event) => updateField("message", event.target.value)}
              className="min-w-0 resize-none rounded-lg border border-sky-100/14 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-sky-100/45"
              placeholder="Write a quick note about the piece or idea you have in mind."
            />
          </label>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="submit"
              className="rounded-full bg-sky-50 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-white"
            >
              open email draft
            </button>
            {sent && <span className="text-sm text-sky-100/60">Your email app should be ready.</span>}
          </div>
        </form>
      </div>
    </section>
  );
}

export default function MobiusPortfolio() {
  const motionRef = useRef({ progress: 0, velocity: 0, interactionBlockedUntil: 0 });
  const dragRef = useRef({ active: false, x: 0, y: 0 });
  const wheelThrottleRef = useRef(0);

  const [route, setRoute] = useState(() => normalizePath(window.location.pathname));
  const [modalArt, setModalArt] = useState(null);
  const [inquiryArt, setInquiryArt] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeRoute = routes.find((item) => item.path === route) ?? routes[0];

  useEffect(() => {
    function syncRoute() {
      setRoute(normalizePath(window.location.pathname));
      window.scrollTo({ top: 0, left: 0 });
    }

    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  useEffect(() => {
    const label = activeRoute.path === "/" ? "Home" : activeRoute.label[0].toUpperCase() + activeRoute.label.slice(1);
    document.title = `${label} | Pirate King Fanpage`;
  }, [activeRoute]);

  function pushVelocity(amount) {
    motionRef.current.velocity = THREE.MathUtils.clamp(
      motionRef.current.velocity + amount,
      -1.15,
      1.15
    );
    motionRef.current.interactionBlockedUntil = performance.now() + 140;
  }

  function navigate(path) {
    const nextPath = normalizePath(path);
    if (nextPath !== route) {
      window.history.pushState({}, "", nextPath);
      setRoute(nextPath);
    }
    setMenuOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }

  function startInquiry(art) {
    setInquiryArt(art);
    setModalArt(null);
    navigate("/contact");
  }

  const closeModal = useCallback(() => setModalArt(null), []);

  const navigateModal = useCallback((direction) => {
    setModalArt((currentArt) => {
      if (!currentArt) return currentArt;

      const currentIndex = artworks.findIndex((art) => art.title === currentArt.title);
      return artworks[mod(currentIndex + direction, artworks.length)];
    });
  }, []);

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[#02040a] text-white"
      onWheel={(e) => {
        const now = performance.now();
        if (now - wheelThrottleRef.current < 16) return;
        wheelThrottleRef.current = now;
        pushVelocity(e.deltaY * 0.00128);
      }}
      onPointerDown={(e) => {
        dragRef.current = { active: true, x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!dragRef.current.active) return;

        const dx = e.clientX - dragRef.current.x;
        const dy = e.clientY - dragRef.current.y;

        pushVelocity((-dx + dy * 0.4) * 0.0068);

        dragRef.current.x = e.clientX;
        dragRef.current.y = e.clientY;
      }}
      onPointerUp={() => {
        dragRef.current.active = false;
      }}
      onPointerLeave={() => {
        dragRef.current.active = false;
      }}
    >
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(5,10,18,0)_0%,rgba(5,10,18,0.36)_100%)]" />

      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.04] [background-image:linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-sky-200/10 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-28 bg-gradient-to-t from-sky-400/[0.045] to-transparent" />

      <header className="fixed left-0 right-0 top-0 z-30 flex items-center justify-between gap-4 border-b border-white/[0.08] bg-[#02040a]/86 px-5 py-4 backdrop-blur-xl md:px-8">
        <button className="text-left" onClick={() => navigate("/")}>
          <div className="text-[11px] uppercase tracking-[0.34em] text-sky-100/42">
            endless archive
          </div>
          <div className="mt-1 text-xl font-semibold tracking-tight text-white">
            Pirate King Fanpage
          </div>
        </button>

        <nav className="hidden items-center gap-8 text-sm text-sky-100/56 md:flex">
          {routes.slice(1).map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`transition ${
                activeRoute.path === item.path
                  ? "text-white"
                  : "hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button
          onClick={() => navigate("/contact")}
          className="hidden rounded-full border border-sky-100/20 px-4 py-2 text-xs uppercase tracking-[0.18em] text-sky-100/76 transition hover:border-sky-100/45 hover:text-white sm:block"
        >
          contact
        </button>

        <button
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-full border border-white/12 px-4 py-2 text-xs uppercase tracking-[0.18em] text-sky-100/76 md:hidden"
          aria-expanded={menuOpen}
        >
          {menuOpen ? "close" : "menu"}
        </button>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            className="fixed inset-x-0 bottom-0 top-[73px] z-20 bg-[#02040a]/98 px-5 py-8 shadow-2xl backdrop-blur-xl md:hidden"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="mb-8 text-xs uppercase tracking-[0.32em] text-sky-100/34">navigation</div>
            <div className="grid divide-y divide-white/10 border-y border-white/10">
              {routes.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`py-5 text-left text-3xl font-semibold tracking-[-0.02em] ${
                    activeRoute.path === item.path ? "text-white" : "text-sky-100/58"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate("/contact")}
              className="mt-8 rounded-full bg-sky-50 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-black"
            >
              contact
            </button>
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
              <HomePage motionRef={motionRef} onSelect={setModalArt} navigate={navigate} />
            )}
            {activeRoute.path === "/work" && <WorkPage onSelect={setModalArt} />}
            {activeRoute.path === "/about" && <AboutPage />}
            {activeRoute.path === "/journal" && <JournalPage navigate={navigate} />}
            {activeRoute.path === "/contact" && (
              <ContactPage
                selectedArt={inquiryArt}
                onSelectArtwork={setInquiryArt}
                navigate={navigate}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <ArtworkModal
        art={modalArt}
        onClose={closeModal}
        onInquire={startInquiry}
        onNavigate={navigateModal}
      />
    </div>
  );
}
