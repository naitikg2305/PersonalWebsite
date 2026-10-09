'use client';

import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Bounds } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { Suspense, useMemo, useRef, type RefObject } from 'react';
import { BufferGeometry, Group } from 'three';

function FitOnLoad({ children }: { children: React.ReactNode }) {
  return (
    <Bounds fit clip observe margin={1.2}>
      {children}
    </Bounds>
  );
}


function Model({ url }: { url: string }) {
  const loaded = useLoader(STLLoader, url) as BufferGeometry;
  // center on the origin so spinning/tilting turns the model in place instead of swinging it
  const geometry = useMemo(() => loaded.clone().center(), [loaded]);
  const mat = useMemo(
    () => ({ color: '#00ff00', roughness: 0.6, metalness: 0.1 }),
    []
  );
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial {...mat} />
    </mesh>
  );
}

/** Pointer position over the surrounding card, normalized to -1..1 (null when the pointer is away). */
export type PointerRef = RefObject<{ x: number; y: number } | null>;

function RotatingModel({
  url,
  hover,
  spin,
  pointer,
}: {
  url: string;
  hover: boolean;
  spin: boolean;
  pointer?: PointerRef;
}) {
  const groupRef = useRef<Group>(null);
  const base = useRef<number | null>(null); // spin angle when the pointer arrived

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const p = pointer?.current;
    if (p) {
      // follow the pointer like a click-drag: left/right turns, up/down tilts (eased)
      if (base.current === null) base.current = g.rotation.y;
      const k = 1 - Math.exp(-delta * 6);
      g.rotation.y += (base.current + p.x * Math.PI * 0.75 - g.rotation.y) * k;
      g.rotation.x += (p.y * 0.5 - g.rotation.x) * k;
      return;
    }
    base.current = null;
    g.rotation.x += (0 - g.rotation.x) * (1 - Math.exp(-delta * 3));
    if (spin || hover) g.rotation.y += delta * 0.6;
  });

  return (
    <group ref={groupRef}>
      <FitOnLoad>
        <Model url={url} />
      </FitOnLoad>
    </group>
  );
}

export default function STLViewer({
  url,
  height = '80vh',
  hover = false,
  controls = true,
  zoom = true,
  spin = false,
  pointer,
}: {
  url: string;
  height?: number | string;
  hover?: boolean;
  controls?: boolean;
  zoom?: boolean;
  /** rotate continuously (otherwise only while `hover`) */
  spin?: boolean;
  pointer?: PointerRef;
}) {
  return (
    <div style={{ width: '100%', height }}>
      <Canvas camera={{ position: [4, 3, 5], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[8, 10, 6]} intensity={0.9} />
        <Suspense fallback={null}>
          <RotatingModel url={url} hover={hover} spin={spin} pointer={pointer} />
        </Suspense>
        {controls && <OrbitControls enableZoom={zoom} />}
      </Canvas>
    </div>
  );
}
