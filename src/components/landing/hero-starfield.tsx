"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Points, type ShaderMaterial } from "three";

export type HeroMotion = { mx: number; my: number; sp: number };

const vertex = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float speed = 0.35 + aPhase * 1.4;
    float tw = 0.5 + 0.5 * sin(uTime * speed + aPhase * 62.0);
    vAlpha = mix(0.35, 1.0, tw * tw);
    vColor = aColor;
    gl_PointSize = aSize * uPixelRatio * (16.0 / -mv.z);
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = pow(smoothstep(0.5, 0.0, d), 2.4);
    float cross = max(0.0, 1.0 - abs(c.x) * 14.0) * max(0.0, 1.0 - abs(c.y) * 2.2)
                + max(0.0, 1.0 - abs(c.y) * 14.0) * max(0.0, 1.0 - abs(c.x) * 2.2);
    float a = (core + cross * 0.18) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

function makeGeometry(count: number): BufferGeometry {
  let s = 1337;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const color = new Float32Array(count * 3);
  const palette: [number, number, number][] = [
    [1, 1, 1],
    [0.86, 0.84, 1],
    [0.8, 0.76, 1],
    [0.72, 0.98, 0.92],
  ];
  for (let i = 0; i < count; i++) {
    const z = -4 - rnd() * 34;
    const depth = -z;
    pos[i * 3] = (rnd() * 2 - 1) * depth * 1.25;
    pos[i * 3 + 1] = (rnd() * 2 - 1) * depth * 0.8;
    pos[i * 3 + 2] = z;
    size[i] = 0.7 + Math.pow(rnd(), 7) * 4.2;
    phase[i] = rnd();
    const p = palette[rnd() < 0.7 ? 0 : rnd() < 0.5 ? 1 : rnd() < 0.6 ? 2 : 3]!;
    color.set(p, i * 3);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aSize", new BufferAttribute(size, 1));
  g.setAttribute("aPhase", new BufferAttribute(phase, 1));
  g.setAttribute("aColor", new BufferAttribute(color, 3));
  return g;
}

function Stars({ count, motion, onReady }: { count: number; motion: MutableRefObject<HeroMotion>; onReady: () => void }) {
  const points = useRef<Points>(null);
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => makeGeometry(count), [count]);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.75) } }),
    [],
  );
  const readyFired = useRef(false);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, delta) => {
    const p = points.current;
    if (!p || !material.current) return;
    material.current.uniforms.uTime!.value = state.clock.elapsedTime;
    const m = motion.current;
    // Gentle drift + pointer parallax (near stars move more by perspective) + rise on scroll.
    p.rotation.z += delta * 0.004;
    state.camera.position.x += (m.mx * 0.9 - state.camera.position.x) * 0.05;
    state.camera.position.y += (-m.my * 0.6 + m.sp * 2.2 - state.camera.position.y) * 0.05;
    state.camera.lookAt(0, m.sp * 2.2, -20);
    if (!readyFired.current) {
      readyFired.current = true;
      onReady();
    }
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

export default function HeroStarfield({
  motion,
  active,
  compact,
  onReady,
}: {
  motion: MutableRefObject<HeroMotion>;
  active: boolean;
  compact: boolean;
  onReady: () => void;
}) {
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
      camera={{ fov: 60, near: 0.1, far: 100, position: [0, 0, 0] }}
      aria-hidden="true"
    >
      <Stars count={compact ? 900 : 2200} motion={motion} onReady={onReady} />
    </Canvas>
  );
}
