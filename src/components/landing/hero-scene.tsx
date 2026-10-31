"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Float, Html, Lightformer, MeshTransmissionMaterial, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { CONTRADICTION_PAIR, HERO_KIND_META, HERO_PANELS, type HeroPanel } from "./hero-scene-data";

export type HeroSceneProps = {
  /** Pause rendering entirely (hero scrolled offscreen). */
  active: boolean;
  reducedMotion: boolean;
  compact: boolean;
  /** Pointer position over the hero, normalised to -1..1. */
  pointer: MutableRefObject<{ x: number; y: number }>;
  onReady: () => void;
};

const PANEL_W = 0.92;
const PANEL_H = 1.2;
/** Gap region in panel-local units (centre + size), matches the texture layout below. */
const GAP_RECT = { x: -0.04, y: -0.06, w: 0.66, h: 0.3 };
const LENS_RADIUS = 0.95;

// ---------- textures (client only) ----------

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Faint "document" texture: a title bar and lines of text, with an optional missing block or broken lines. */
function makePanelTexture(panel: HeroPanel): THREE.CanvasTexture {
  const W = 384;
  const H = 500;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const rand = mulberry32(panel.seed);

  // Frame
  roundRect(ctx, 3, 3, W - 6, H - 6, 26);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "rgba(190,205,255,0.16)");
  g.addColorStop(1, "rgba(120,140,220,0.05)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(210,220,255,0.45)";
  ctx.stroke();

  // Header
  ctx.fillStyle = "rgba(230,236,255,0.75)";
  roundRect(ctx, 34, 40, 150, 14, 7);
  ctx.fill();
  ctx.fillStyle = "rgba(230,236,255,0.3)";
  roundRect(ctx, 34, 66, 90, 9, 4.5);
  ctx.fill();

  // Gap block occupies these rows (mapped from GAP_RECT)
  const gapTop = H / 2 - ((GAP_RECT.y + GAP_RECT.h / 2) / PANEL_H) * H;
  const gapBottom = H / 2 - ((GAP_RECT.y - GAP_RECT.h / 2) / PANEL_H) * H;
  const gapLeft = W / 2 + ((GAP_RECT.x - GAP_RECT.w / 2) / PANEL_W) * W;
  const gapRight = W / 2 + ((GAP_RECT.x + GAP_RECT.w / 2) / PANEL_W) * W;
  const broken = panel.kind === "outdated" || panel.kind === "contradiction";

  for (let y = 108; y < H - 40; y += 24) {
    const inGapRows = panel.hasGap && y > gapTop - 8 && y < gapBottom + 8;
    const len = 0.55 + rand() * 0.4;
    const x0 = 34;
    const x1 = x0 + (W - 68) * len;
    ctx.fillStyle = `rgba(220,228,255,${0.22 + rand() * 0.16})`;
    if (inGapRows) {
      // Text resumes only outside the missing block.
      if (gapLeft - 10 > x0) {
        roundRect(ctx, x0, y, gapLeft - 10 - x0, 8, 4);
        ctx.fill();
      }
      if (x1 > gapRight + 10) {
        roundRect(ctx, gapRight + 10, y, x1 - gapRight - 10, 8, 4);
        ctx.fill();
      }
      continue;
    }
    if (broken && rand() < 0.35) {
      const cut = x0 + (x1 - x0) * (0.3 + rand() * 0.4);
      roundRect(ctx, x0, y, cut - x0 - 18, 8, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(220,228,255,0.12)";
      roundRect(ctx, cut + 10, y, Math.max(12, x1 - cut - 10), 8, 4);
      ctx.fill();
      continue;
    }
    roundRect(ctx, x0, y, x1 - x0, 8, 4);
    ctx.fill();
  }

  if (panel.hasGap) {
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(253,186,116,0.7)";
    roundRect(ctx, gapLeft, gapTop, gapRight - gapLeft, gapBottom - gapTop, 12);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Soft rounded glow used for gap highlights. */
function makeGlowRectTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.shadowColor = "rgba(255,255,255,1)";
  ctx.shadowBlur = 28;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  roundRect(ctx, 40, 34, 176, 60, 14);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Radial falloff for node halos. */
function makeDotGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- scene ----------

type SceneInnerProps = Omit<HeroSceneProps, "active" | "onReady">;

function Lens({ reducedMotion, compact, pointer, lensWorld }: SceneInnerProps & { lensWorld: MutableRefObject<THREE.Vector3> }) {
  const follow = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const bg = useMemo(() => new THREE.Color("#0b1124"), []);

  useFrame((state, delta) => {
    const f = follow.current;
    const s = spin.current;
    if (!f || !s) return;
    if (!reducedMotion) {
      const k = 1 - Math.exp(-delta * 2.2);
      f.position.x += (pointer.current.x * 0.7 - f.position.x) * k;
      f.position.y += (pointer.current.y * 0.4 - f.position.y) * k;
      s.rotation.y += delta * 0.25;
      s.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.25;
    }
    f.getWorldPosition(lensWorld.current);
  });

  return (
    <group ref={follow}>
      <Float speed={reducedMotion ? 0 : 1.1} rotationIntensity={0.25} floatIntensity={0.35} floatingRange={[-0.08, 0.08]}>
        <group ref={spin} rotation={[0.25, 0.6, 0]}>
          <mesh scale={[1, 1, 0.3]}>
            <sphereGeometry args={[LENS_RADIUS, compact ? 40 : 64, compact ? 24 : 40]} />
            <MeshTransmissionMaterial
              background={bg}
              resolution={compact ? 256 : 512}
              samples={compact ? 3 : 6}
              thickness={0.9}
              roughness={0.04}
              transmission={1}
              ior={1.32}
              chromaticAberration={0.05}
              anisotropicBlur={0.08}
              distortion={0.12}
              distortionScale={0.35}
              temporalDistortion={reducedMotion ? 0 : 0.04}
              clearcoat={1}
              attenuationDistance={2.5}
              attenuationColor="#c7d2fe"
              color="#eef2ff"
            />
          </mesh>
          {/* Thin metallic rim */}
          <mesh>
            <torusGeometry args={[LENS_RADIUS * 1.005, 0.022, 12, compact ? 64 : 96]} />
            <meshStandardMaterial color="#c7d2fe" metalness={1} roughness={0.22} />
          </mesh>
        </group>
      </Float>
    </group>
  );
}

type PanelRefs = {
  group: THREE.Group | null;
  node: THREE.Object3D | null;
  gap: THREE.Mesh | null;
};

function Panel({
  panel,
  refs,
  hovered,
  onHover,
  glowTex,
  dotTex,
}: {
  panel: HeroPanel;
  refs: PanelRefs;
  hovered: boolean;
  onHover: (on: boolean) => void;
  glowTex: THREE.Texture;
  dotTex: THREE.Texture;
}) {
  const tex = useMemo(() => makePanelTexture(panel), [panel]);
  useEffect(() => () => tex.dispose(), [tex]);
  const meta = HERO_KIND_META[panel.kind];
  const showNode = panel.kind !== "gap";
  const faceMat = useRef<THREE.MeshBasicMaterial>(null);
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 8);
    const g = refs.group;
    if (g) {
      const target = hovered ? 1.08 : 1;
      g.scale.setScalar(g.scale.x + (target - g.scale.x) * k);
    }
    if (faceMat.current) faceMat.current.opacity += ((hovered ? 1 : 0.78) - faceMat.current.opacity) * k;
    if (bodyMat.current) bodyMat.current.emissiveIntensity += ((hovered ? 0.35 : 0.06) - bodyMat.current.emissiveIntensity) * k;
  });

  return (
    <group ref={(g) => void (refs.group = g)}>
      <RoundedBox
        args={[PANEL_W, PANEL_H, 0.025]}
        radius={0.06}
        smoothness={2}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(true);
        }}
        onPointerOut={() => onHover(false)}
      >
        <meshStandardMaterial
          ref={bodyMat}
          color="#1e2a55"
          emissive={meta.color}
          emissiveIntensity={0.06}
          transparent
          opacity={0.38}
          roughness={0.35}
          metalness={0.1}
          depthWrite={false}
        />
      </RoundedBox>
      <mesh position={[0, 0, 0.016]}>
        <planeGeometry args={[PANEL_W, PANEL_H]} />
        <meshBasicMaterial ref={faceMat} map={tex} transparent opacity={0.78} depthWrite={false} toneMapped={false} />
      </mesh>
      {panel.hasGap && (
        <mesh ref={(m) => void (refs.gap = m)} position={[GAP_RECT.x, GAP_RECT.y, 0.02]}>
          <planeGeometry args={[GAP_RECT.w * 1.45, GAP_RECT.h * 1.7]} />
          <meshBasicMaterial
            map={glowTex}
            color={meta.color}
            transparent
            opacity={0.1}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
      {showNode && (
        <group ref={(n) => void (refs.node = n)} position={[PANEL_W / 2 - 0.12, PANEL_H / 2 - 0.12, 0.04]}>
          <mesh>
            <sphereGeometry args={[0.045, 16, 12]} />
            <meshBasicMaterial color={meta.color} toneMapped={false} />
          </mesh>
          <sprite scale={0.38}>
            <spriteMaterial map={dotTex} color={meta.color} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
          </sprite>
        </group>
      )}
      {hovered && (
        <Html position={[0, PANEL_H / 2 + 0.2, 0]} center zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-[#0b1124]/90 px-3 py-1.5 text-[12px] whitespace-nowrap text-slate-100 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.6)] backdrop-blur">
            <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
            <span className="font-medium">{meta.label}</span>
            <span className="text-slate-400">· {panel.topic}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

function Orbit({ reducedMotion, compact, pointer, lensWorld }: SceneInnerProps & { lensWorld: MutableRefObject<THREE.Vector3> }) {
  const panels = useMemo(() => (compact ? HERO_PANELS.slice(0, 5) : HERO_PANELS), [compact]);
  const refs = useMemo<PanelRefs[]>(() => panels.map(() => ({ group: null, node: null, gap: null })), [panels]);
  const [hovered, setHovered] = useState<number | null>(null);
  const glowTex = useMemo(() => makeGlowRectTexture(), []);
  const dotTex = useMemo(() => makeDotGlowTexture(), []);
  useEffect(
    () => () => {
      glowTex.dispose();
      dotTex.dispose();
    },
    [glowTex, dotTex],
  );

  const tilt = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const angle = useRef(0.35);

  // Contradiction line between the two red nodes.
  const line = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const mat = new THREE.LineDashedMaterial({ color: "#f87171", dashSize: 0.09, gapSize: 0.07, transparent: true, opacity: 0.55, toneMapped: false });
    const l = new THREE.Line(geom, mat);
    l.frustumCulled = false;
    return l;
  }, []);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );

  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);
  const radius = compact ? 2.05 : 2.35;

  useFrame((state, delta) => {
    if (!reducedMotion && hovered === null) angle.current += delta * 0.11;
    const t = reducedMotion ? 0 : state.clock.elapsedTime;

    if (tilt.current) {
      const k = 1 - Math.exp(-delta * 2);
      const tx = reducedMotion ? 0 : -pointer.current.y * 0.12;
      const ty = reducedMotion ? 0 : pointer.current.x * 0.18;
      tilt.current.rotation.x += (tx - tilt.current.rotation.x) * k;
      tilt.current.rotation.y += (ty - tilt.current.rotation.y) * k;
    }

    panels.forEach((p, i) => {
      const r = refs[i];
      const g = r?.group;
      if (!r || !g) return;
      const a = angle.current + (i / panels.length) * Math.PI * 2;
      g.position.set(Math.cos(a) * radius, p.y + Math.sin(t * 0.5 + i * 1.7) * 0.07, Math.sin(a) * radius * 0.7 - 0.2);
      g.lookAt(camera.position.x * 0.6, camera.position.y, camera.position.z);
      g.rotateZ(p.roll);

      // Gaps light up as the lens passes near them.
      const gap = r.gap;
      if (gap) {
        gap.getWorldPosition(tmpA);
        const d = tmpA.distanceTo(lensWorld.current);
        const near = THREE.MathUtils.clamp(1 - (d - 0.9) / 1.6, 0, 1);
        const mat = gap.material as THREE.MeshBasicMaterial;
        const target = 0.12 + near * 0.95 + (hovered === i ? 0.4 : 0);
        mat.opacity += (target - mat.opacity) * (1 - Math.exp(-delta * 6));
      }
    });

    const [ia, ib] = CONTRADICTION_PAIR;
    const na = refs[ia]?.node;
    const nb = refs[ib]?.node;
    if (na && nb) {
      na.getWorldPosition(tmpA);
      nb.getWorldPosition(tmpB);
      const pos = line.geometry.attributes.position as THREE.BufferAttribute;
      pos.setXYZ(0, tmpA.x, tmpA.y, tmpA.z);
      pos.setXYZ(1, tmpB.x, tmpB.y, tmpB.z);
      pos.needsUpdate = true;
      line.computeLineDistances();
      line.visible = true;
    } else {
      line.visible = false;
    }
  });

  return (
    <>
      <group ref={tilt}>
        {panels.map((p, i) => (
          <Panel
            key={i}
            panel={p}
            refs={refs[i]!}
            hovered={hovered === i}
            onHover={(on) => setHovered((cur) => (on ? i : cur === i ? null : cur))}
            glowTex={glowTex}
            dotTex={dotTex}
          />
        ))}
      </group>
      <primitive object={line} />
    </>
  );
}

function Scene(props: SceneInnerProps) {
  const lensWorld = useRef(new THREE.Vector3());
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} color="#e0e7ff" />
      <pointLight position={[-3, -1, 2]} intensity={6} color="#8b5cf6" distance={8} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#c7d2fe" position={[0, 4, -4]} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#a78bfa" position={[-5, 0, 1]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#7dd3fc" position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
        <Lightformer form="ring" intensity={2.5} color="#ffffff" position={[0, 0, 6]} scale={2.5} />
      </Environment>
      <Orbit {...props} lensWorld={lensWorld} />
      <Lens {...props} lensWorld={lensWorld} />
    </>
  );
}

export default function HeroScene({ active, reducedMotion, compact, pointer, onReady }: HeroSceneProps) {
  const frameloop = !active ? "never" : reducedMotion ? "demand" : "always";
  return (
    <Canvas
      aria-hidden="true"
      frameloop={frameloop}
      dpr={compact ? [1, 1.5] : [1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.35, compact ? 8.2 : 7.2], fov: 38 }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        // Give the transmission buffer a frame before revealing the canvas.
        requestAnimationFrame(() => requestAnimationFrame(onReady));
      }}
      style={{ touchAction: "pan-y" }}
    >
      <Scene reducedMotion={reducedMotion} compact={compact} pointer={pointer} />
      {!compact && (
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.5}
          minPolarAngle={Math.PI / 2 - 0.35}
          maxPolarAngle={Math.PI / 2 + 0.25}
          minAzimuthAngle={-0.6}
          maxAzimuthAngle={0.6}
        />
      )}
    </Canvas>
  );
}
