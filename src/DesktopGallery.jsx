import { memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Line, useCursor } from "@react-three/drei";
import * as THREE from "three";

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
const PANEL_DENSITY_BASE = 16;
const PANEL_ASPECT = 0.52 / 0.94;
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
          opacity={0.11}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      <Line points={topEdge} color="#42baff" lineWidth={5} transparent opacity={0.115} depthWrite={false} />
      <Line points={bottomEdge} color="#42baff" lineWidth={4} transparent opacity={0.09} depthWrite={false} />
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

function FlowBeads() {
  const beads = useRef([]);
  const beadData = useMemo(
    () => [
      { v: STRIP_HALF_WIDTH, offset: 0.0, size: 0.036, color: "#e9fbff", speed: 1.0 },
      { v: STRIP_HALF_WIDTH, offset: 2.1, size: 0.026, color: "#8fd6ff", speed: 0.9 },
      { v: -STRIP_HALF_WIDTH, offset: 0.85, size: 0.032, color: "#7fd0ff", speed: 1.0 },
      { v: -STRIP_HALF_WIDTH, offset: 3.15, size: 0.022, color: "#d4f3ff", speed: 0.85 },
      { v: 0, offset: 4.1, size: 0.018, color: "#ffffff", speed: 0.75 },
      { v: STRIP_HALF_WIDTH * 0.45, offset: 7.6, size: 0.026, color: "#d4f3ff", speed: 0.88 },
      { v: STRIP_HALF_WIDTH * -0.72, offset: 10.2, size: 0.022, color: "#8fd6ff", speed: 0.95 },
    ],
    []
  );

  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.033);

    beadData.forEach((bead, i) => {
      const mesh = beads.current[i];
      if (!mesh) return;

      const u = mod(
        bead.offset + state.clock.elapsedTime * 0.34 * bead.speed,
        bead.v === 0 ? TAU : 2 * TAU
      );
      // Off-center lanes switch sides after one turn and close after two.
      const point = mobiusPoint(u, bead.v);
      const intro = smoothstep(0.25, 2.3, state.clock.elapsedTime);
      const pulse = (0.8 + Math.sin(state.clock.elapsedTime * 2.2 + i) * 0.2) * intro;

      mesh.position.copy(point);
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
          if (e.delta >= 8) return;
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

function Scene({ artworks, motionRef, onSelect, onProgress }) {
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
      const targetScale = 0.82 + intro * 0.095 * THREE.MathUtils.smoothstep(state.size.width / state.size.height, 1, 1.55);
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
        <FlowBeads />

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

    </>
  );
}

const MemoizedScene = memo(Scene);

function ContextGuard({ onFailure }) {
  const canvas = useThree((state) => state.gl.domElement);

  useEffect(() => {
    canvas.addEventListener("webglcontextlost", onFailure);
    return () => canvas.removeEventListener("webglcontextlost", onFailure);
  }, [canvas, onFailure]);

  return null;
}

export default function DesktopGallery({ artworks, isVisible, motionRef, onSelect, onProgress, onFailure }) {
  return (
    <Canvas
      fallback={null}
      camera={{ position: [0, 1.2, 7.6], fov: 39 }}
      dpr={[1, 1.5]}
      frameloop={isVisible ? "always" : "never"}
      shadows
      gl={{ antialias: true, alpha: false }}
    >
      <ContextGuard onFailure={onFailure} />
      <Suspense fallback={null}>
        <MemoizedScene artworks={artworks} motionRef={motionRef} onSelect={onSelect} onProgress={onProgress} />
      </Suspense>
    </Canvas>
  );
}
