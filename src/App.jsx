import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Line, useCursor } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";

const artworks = [
  {
    title: "Fragile Dreamer",
    year: "2026",
    medium: "Oil, charcoal, digital glaze",
    mood: "soft distortion / almost human",
    palette: ["#201c1d", "#c9a47d", "#6d2b24", "#ece2d1"],
    size: "36 x 48 in",
    status: "Available",
    price: "$2,400",
    story:
      "A portrait caught between sleep and signal, built from rubbed charcoal, thin oil glazes, and digital light passes.",
    process:
      "The figure was blocked in with loose graphite, then rebuilt through translucent color until the face felt almost remembered instead of observed.",
    collection: "Dream States",
  },
  {
    title: "Knuckle Velvet",
    year: "2026",
    medium: "Ink and acrylic",
    mood: "tender but dangerous",
    palette: ["#06080d", "#7c1320", "#d8b88a", "#171d2a"],
    size: "24 x 36 in",
    status: "Reserved",
    price: "Private sale",
    story:
      "A study of softness under pressure, using clenched silhouettes, velvet reds, and scraped highlights.",
    process:
      "Ink was allowed to pool and bruise before acrylic marks were pulled across the surface with a dry brush.",
    collection: "Body Weather",
  },
  {
    title: "Room Without Edges",
    year: "2025",
    medium: "Graphite study",
    mood: "memory loop",
    palette: ["#111111", "#d9d3c8", "#76706b", "#2b2b2f"],
    size: "18 x 24 in",
    status: "Available",
    price: "$900",
    story:
      "An interior drawing where the walls refuse to end, made for anyone who has felt a room become a memory.",
    process:
      "Layered graphite was erased back into soft seams, then tightened with architectural linework near the center.",
    collection: "Quiet Rooms",
  },
  {
    title: "Blue Hour Saint",
    year: "2025",
    medium: "Digital painting",
    mood: "devotional / unreal",
    palette: ["#091521", "#153e5c", "#d6c2a2", "#7d2f26"],
    size: "Edition of 25",
    status: "Prints open",
    price: "From $180",
    story:
      "A luminous figure held inside dusk, designed as a devotional image for uncertain futures.",
    process:
      "Painted digitally from a monochrome value sketch, then finished with hand-built texture overlays.",
    collection: "Blue Lit",
  },
  {
    title: "Eclipse Animal",
    year: "2026",
    medium: "Mixed media",
    mood: "wild silhouette",
    palette: ["#0a0b0d", "#f0dcc2", "#a6602d", "#2a3139"],
    size: "40 x 40 in",
    status: "Available",
    price: "$3,100",
    story:
      "A shadow creature crossing a bright field, halfway between omen, petroglyph, and stage light.",
    process:
      "The silhouette was cut from painted paper, scanned, enlarged, and worked back into with matte acrylic.",
    collection: "Field Notes",
  },
  {
    title: "Salt Cathedral",
    year: "2024",
    medium: "Watercolour + pencil",
    mood: "quiet ritual",
    palette: ["#17202a", "#c5d3d9", "#9a6a4d", "#f4efe6"],
    size: "22 x 30 in",
    status: "Sold",
    price: "Commission similar",
    story:
      "A pale architectural dream about grief, tide marks, and the small ceremonies people make for themselves.",
    process:
      "Watercolour washes were built slowly and allowed to bloom, with pencil structure added only after drying.",
    collection: "Quiet Rooms",
  },
  {
    title: "Moth Logic",
    year: "2025",
    medium: "Ink wash",
    mood: "drawn toward damage",
    palette: ["#050608", "#b08e62", "#e8d7b2", "#3e2c23"],
    size: "16 x 20 in",
    status: "Available",
    price: "$760",
    story:
      "A small nocturne about attraction, risk, and the strange intelligence of moving toward heat.",
    process:
      "Ink was diluted into five tonal families, then lifted with cloth to make the wings feel smoke-soft.",
    collection: "Field Notes",
  },
  {
    title: "Black Milk Hotel",
    year: "2026",
    medium: "Digital collage",
    mood: "nostalgic surrealism",
    palette: ["#0d1016", "#efdfbd", "#536c77", "#953e36"],
    size: "Edition of 40",
    status: "Prints open",
    price: "From $140",
    story:
      "A fictional lobby where childhood color, old signage, and dream logic check in under the same name.",
    process:
      "Analog textures, painted signage, and generated fragments were composited into a single cinematic plate.",
    collection: "Dream States",
  },
  {
    title: "Little Apocalypse",
    year: "2025",
    medium: "Acrylic study",
    mood: "small ending / bright wound",
    palette: ["#15120f", "#e17833", "#38251f", "#f5c78d"],
    size: "20 x 20 in",
    status: "Available",
    price: "$1,150",
    story:
      "A compact painting about endings that arrive quietly, with orange light doing most of the talking.",
    process:
      "Fast acrylic underpainting was sanded back, then glazed with warmer passages until the center pulsed.",
    collection: "Body Weather",
  },
  {
    title: "Tender Static",
    year: "2024",
    medium: "Pencil and digital colour",
    mood: "half signal / half ghost",
    palette: ["#0b0d12", "#bcc7c9", "#384659", "#e4d5c1"],
    size: "Edition of 30",
    status: "Prints open",
    price: "From $120",
    story:
      "A quiet signal portrait about presence, absence, and how digital noise can still feel intimate.",
    process:
      "A pencil drawing was scanned at high resolution, colored in restrained layers, and left visibly imperfect.",
    collection: "Blue Lit",
  },
];

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

const collections = ["All", ...new Set(artworks.map((art) => art.collection))];
const availabilityFilters = ["All", "Available", "Prints open", "Reserved", "Sold"];

const routes = [
  { path: "/", label: "home" },
  { path: "/work", label: "work" },
  { path: "/about", label: "about" },
  { path: "/journal", label: "journal" },
  { path: "/contact", label: "contact" },
];

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

const TAU = Math.PI * 2;

const STRIP_RADIUS = 2.66;
const STRIP_HALF_WIDTH = 0.6;
const PANEL_COUNT = 16;
const IDLE_LOOP_SPEED = 0.022;

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

function createArtworkTexture(art, index) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1400;

  const ctx = canvas.getContext("2d");
  const [a, b, c, d] = art.palette;

  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, d);
  bg.addColorStop(0.32, b);
  bg.addColorStop(0.68, c);
  bg.addColorStop(1, a);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.42;
  for (let i = 0; i < 30; i++) {
    ctx.beginPath();
    const x = Math.sin(i * 13.7 + index) * 330 + 450;
    const y = Math.cos(i * 8.9 + index * 2) * 560 + 700;
    const r = 56 + ((i * 37 + index * 21) % 235);
    ctx.fillStyle = i % 2 ? a : d;
    ctx.ellipse(x, y, r * 0.78, r * 1.68, i * 0.7, 0, TAU);
    ctx.fill();
  }

  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  for (let i = 0; i < 42; i++) {
    ctx.beginPath();
    ctx.moveTo((i * 77 + index * 33) % canvas.width, 0);
    ctx.bezierCurveTo(
      120 + ((i * 17) % 640),
      330 + ((i * 31) % 780),
      780 - ((i * 19) % 640),
      520 + ((i * 29) % 800),
      (i * 117 + index * 71) % canvas.width,
      canvas.height
    );
    ctx.stroke();
  }

  const light = ctx.createRadialGradient(430, 500, 80, 450, 700, 780);
  light.addColorStop(0, "rgba(255,255,255,0.22)");
  light.addColorStop(0.45, "rgba(255,255,255,0.03)");
  light.addColorStop(1, "rgba(0,0,0,0.46)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(72, 1130, 756, 150);
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2;
  ctx.strokeRect(72, 1130, 756, 150);

  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.font = "700 46px Inter, Arial, sans-serif";
  ctx.fillText(art.title.toUpperCase(), 98, 1186, 700);

  ctx.font = "400 26px Inter, Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.fillText(`${art.medium} · ${art.year}`, 100, 1230, 690);

  ctx.font = "italic 26px Georgia, serif";
  ctx.fillStyle = "rgba(255,255,255,0.68)";
  ctx.fillText(art.mood, 100, 1268, 690);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 12;
  texture.needsUpdate = true;

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

  const texture = useMemo(() => createArtworkTexture(art, index), [art, index]);

  useFrame((state, delta) => {
    if (!frame.current || !panel.current || !ghost.current) return;

    const safeDelta = Math.min(delta, 0.033);
    const motion = motionRef.current;
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
    const targetScale = (hovered ? 1.2 : 0.76 + focus * 0.44) * (0.82 + intro * 0.18);
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

function Scene({ motionRef, onSelect }) {
  const group = useRef(null);

  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.033);
    const motion = motionRef.current;

    motion.progress = mod(motion.progress + (IDLE_LOOP_SPEED + motion.velocity) * safeDelta, TAU);
    motion.velocity = THREE.MathUtils.damp(motion.velocity, 0, 4.0, safeDelta);

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

        {Array.from({ length: PANEL_COUNT }).map((_, i) => {
          const art = artworks[mod(i, artworks.length)];

          return (
            <ArtworkPanel
              key={`art-${i}`}
              index={i}
              count={PANEL_COUNT}
              art={art}
              motionRef={motionRef}
              onSelect={onSelect}
            />
          );
        })}
      </group>

      <Environment preset="night" />
    </>
  );
}

function ArtworkModal({ art, onClose, onInquire }) {
  return (
    <AnimatePresence>
      {art && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/72 p-5 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="grid max-h-[92vh] w-full max-w-5xl grid-cols-1 overflow-y-auto rounded-lg border border-sky-200/25 bg-[#071423]/97 shadow-[0_0_100px_rgba(56,189,248,0.22)] md:grid-cols-[0.9fr_1.1fr]"
            initial={{ y: 30, scale: 0.965, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.985, opacity: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative min-h-[430px] overflow-hidden">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${art.palette.join(", ")})`,
                }}
              />

              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(125,211,252,0.16),rgba(56,189,248,0.06),transparent_58%)]" />
              <div className="absolute inset-0 shadow-[inset_0_0_90px_rgba(125,211,252,0.18)]" />
              <div className="absolute left-8 top-8 rounded-lg border border-white/20 bg-black/30 px-4 py-3 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.28em] text-sky-100/60">
                  {art.collection}
                </div>
                <div className="mt-2 text-sm text-white/80">{art.size}</div>
              </div>
            </div>

            <div className="relative flex flex-col justify-between bg-[linear-gradient(180deg,rgba(10,24,39,0.96),rgba(6,17,30,0.98))] p-8 md:p-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.10),transparent_32%)]" />

              <div className="relative">
                <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-[0.45em] text-sky-100/60">
                  <span className="h-px w-10 bg-sky-200/50" />
                  selected work
                </div>

                <h2 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
                  {art.title}
                </h2>

                <div className="mt-5 text-sm uppercase tracking-[0.28em] text-sky-100/48">
                  {art.year} · {art.medium}
                </div>

                <p className="mt-8 max-w-xl text-lg leading-8 text-sky-50/72">
                  {art.story}
                </p>

                <p className="mt-5 max-w-xl text-sm leading-7 text-sky-100/58">
                  {art.process}
                </p>

                <p className="mt-5 font-serif text-xl italic text-sky-100/58">
                  {art.mood}
                </p>

                <div className="mt-8 grid gap-3 text-sm text-sky-50/76 sm:grid-cols-3">
                  <div className="rounded-lg border border-sky-100/12 bg-white/[0.035] p-4">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-sky-100/42">status</div>
                    <div className="mt-2">{art.status}</div>
                  </div>
                  <div className="rounded-lg border border-sky-100/12 bg-white/[0.035] p-4">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-sky-100/42">size</div>
                    <div className="mt-2">{art.size}</div>
                  </div>
                  <div className="rounded-lg border border-sky-100/12 bg-white/[0.035] p-4">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-sky-100/42">price</div>
                    <div className="mt-2">{art.price}</div>
                  </div>
                </div>

                <div className="mt-6 flex gap-2">
                  {art.palette.map((color) => (
                    <span
                      key={color}
                      className="h-7 w-7 rounded-full border border-white/20"
                      style={{ background: color }}
                      aria-label={`Palette color ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div className="relative mt-10 flex flex-wrap gap-3">
                <button
                  onClick={() => onInquire(art)}
                  className="rounded-full bg-sky-50 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-white"
                >
                  inquire
                </button>
                <button
                  onClick={onClose}
                  className="rounded-full border border-sky-100/25 bg-sky-200/[0.05] px-5 py-3 text-sm uppercase tracking-[0.18em] text-sky-100/80 shadow-[0_0_34px_rgba(125,211,252,0.10)] transition hover:border-sky-100/45 hover:bg-sky-200/[0.09] hover:text-white"
                >
                  return
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
            <div
              className="min-h-32 opacity-90 transition duration-500 group-hover:opacity-100"
              style={{ backgroundImage: `linear-gradient(135deg, ${art.palette.join(", ")})` }}
            />
            <div className="p-5">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-sky-100/42">
                <span>{String(i + 1).padStart(2, "0")}</span>
                <span>{art.collection}</span>
              </div>
              <h3 className="mt-5 text-2xl font-semibold text-white">{art.title}</h3>
              <p className="mt-2 text-sm text-sky-100/58">{art.medium}</p>
              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-sky-100/58">
                <span>{art.status}</span>
                <span>{art.price}</span>
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function FilterButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition ${
        active
          ? "border-sky-100/70 bg-sky-50 text-black"
          : "border-white/10 text-sky-100/62 hover:border-white/25 hover:text-white"
      }`}
    >
      {children}
    </button>
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

function HomePage({ motionRef, onSelect, navigate }) {
  return (
    <section className="relative h-screen min-h-[680px] w-screen">
      <Canvas
        camera={{ position: [0, 1.2, 7.6], fov: 39 }}
        dpr={[1, 2]}
        shadows
        gl={{ antialias: true, alpha: false }}
      >
        <Scene motionRef={motionRef} onSelect={onSelect} />
      </Canvas>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 px-5 pb-8 md:px-10 md:pb-10">
        <div className="grid gap-5 lg:grid-cols-[1fr_420px] lg:items-end">
          <div>
            <motion.h1
              className="max-w-5xl text-4xl font-semibold tracking-[-0.02em] text-white md:text-7xl"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            >
              A brief inquiry into online relationships.
            </motion.h1>

            <motion.p
              className="mt-5 max-w-2xl text-base leading-7 text-sky-100/62 md:text-lg"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.15, ease: "easeOut" }}
            >
              Pirate King Fanpage traces intimacy, identity, distance, and devotion through an endless gallery of digital-age artifacts.
            </motion.p>

            <div className="pointer-events-auto mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/work")}
                className="rounded-full bg-sky-50 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-white"
              >
                browse work
              </button>
              <button
                onClick={() => navigate("/contact")}
                className="rounded-full border border-sky-100/25 bg-black/25 px-5 py-3 text-sm uppercase tracking-[0.18em] text-sky-100/80 transition hover:border-sky-100/45 hover:text-white"
              >
                commission
              </button>
            </div>
          </div>

          <div className="pointer-events-auto hidden rounded-lg border border-white/10 bg-black/32 p-4 backdrop-blur-xl lg:block">
            <div className="grid gap-px overflow-hidden rounded-md border border-white/10 bg-white/10">
              {[
                ["Browse the archive", "View every available work", "/work"],
                ["Read the premise", "Understand the online-relationship thread", "/about"],
                ["Start an inquiry", "Commission, purchase, or collaborate", "/contact"],
              ].map(([title, detail, path]) => (
                <button
                  key={title}
                  onClick={() => navigate(path)}
                  className="bg-[#050912]/92 p-4 text-left transition hover:bg-[#0b1320]"
                >
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="mt-1 text-sm text-sky-100/50">{detail}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 text-xs uppercase tracking-[0.24em] text-sky-100/35">
              wheel, drag, or click a panel
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkPage({ onSelect }) {
  const [collection, setCollection] = useState("All");
  const [availability, setAvailability] = useState("All");

  const filteredArtworks = artworks.filter((art) => {
    const collectionMatch = collection === "All" || art.collection === collection;
    const availabilityMatch = availability === "All" || art.status === availability;
    return collectionMatch && availabilityMatch;
  });

  return (
    <PageShell
      eyebrow="work"
      title="A calmer archive of mediated intimacy."
      intro="A restrained archive with enough metadata to browse quickly, compare formats, and open only the pieces you want to inspect."
    >
      <div className="mt-9 grid gap-5 border-b border-white/10 pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="text-sm text-sky-100/52">
            Showing {filteredArtworks.length} of {artworks.length} works
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {collections.map((item) => (
              <FilterButton key={item} active={collection === item} onClick={() => setCollection(item)}>
                {item}
              </FilterButton>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {availabilityFilters.map((item) => (
            <FilterButton key={item} active={availability === item} onClick={() => setAvailability(item)}>
              {item}
            </FilterButton>
          ))}
        </div>
      </div>

      {filteredArtworks.length ? (
        <GridGallery artworksToShow={filteredArtworks} onSelect={onSelect} />
      ) : (
        <div className="mt-10 rounded-lg border border-white/10 p-8 text-sky-100/62">
          No works match those filters. Try a broader collection or availability state.
        </div>
      )}
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
  const [form, setForm] = useState({
    name: "",
    email: "",
    interest: selectedArt?.title ?? artworks[0].title,
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

    window.location.href = `mailto:studio@pirateking.art?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <section className="relative min-h-screen px-5 pb-20 pt-28 md:pb-24 md:pt-32">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.78fr_1fr]">
        <div>
          <div className="text-xs uppercase tracking-[0.34em] text-sky-100/40">contact</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.025em] text-white md:text-6xl">
            Inquire without starting from scratch.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-sky-100/60">
            Choose a work, add the useful details, and the site prepares a clean email with the context already included.
          </p>

          {selectedArt && (
            <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.035] p-5">
              <div className="text-xs uppercase tracking-[0.25em] text-sky-100/38">selected work</div>
              <div className="mt-3 text-xl font-semibold text-white">{selectedArt.title}</div>
              <div className="mt-2 text-sm text-sky-100/56">
                {selectedArt.status} · {selectedArt.price}
              </div>
            </div>
          )}

          <div className="mt-8 grid gap-3 text-sm text-sky-100/64">
            <a className="transition hover:text-white" href="mailto:studio@pirateking.art">
              studio@pirateking.art
            </a>
            <a className="transition hover:text-white" href="https://instagram.com/" target="_blank" rel="noreferrer">
              Instagram / process archive
            </a>
            <button className="w-fit text-left transition hover:text-white" onClick={() => navigate("/work")}>
              View available work
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border border-white/12 bg-white/[0.035] p-5 md:p-7">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-sky-100/68">
              Name
              <input
                required
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="rounded-lg border border-sky-100/14 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-sky-100/45"
              />
            </label>

            <label className="grid gap-2 text-sm text-sky-100/68">
              Email
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="rounded-lg border border-sky-100/14 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-sky-100/45"
              />
            </label>
          </div>

          <label className="mt-4 grid gap-2 text-sm text-sky-100/68">
            Interest
            <select
              value={interest}
              onChange={(event) => {
                updateField("interest", event.target.value);
                onSelectArtwork(null);
              }}
              className="rounded-lg border border-sky-100/14 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-sky-100/45"
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
              rows="6"
              value={form.message}
              onChange={(event) => updateField("message", event.target.value)}
              className="resize-none rounded-lg border border-sky-100/14 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-sky-100/45"
              placeholder="Tell me what caught your eye, your timeline, dimensions, budget range, or where the work will live."
            />
          </label>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="submit"
              className="rounded-full bg-sky-50 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-white"
            >
              prepare email
            </button>
            {sent && <span className="text-sm text-sky-100/60">Your email app should be ready with the inquiry.</span>}
          </div>
        </form>
      </div>
    </section>
  );
}

export default function MobiusPortfolio() {
  const motionRef = useRef({ progress: 0, velocity: 0 });
  const dragRef = useRef({ active: false, x: 0, y: 0 });

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

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[#02040a] text-white"
      onWheel={(e) => pushVelocity(e.deltaY * 0.00128)}
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
          inquire
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
              start an inquiry
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
        onClose={() => setModalArt(null)}
        onInquire={startInquiry}
      />
    </div>
  );
}
