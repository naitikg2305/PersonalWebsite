'use client';

import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { Suspense } from 'react';
import { BufferGeometry } from 'three';

function Model({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url) as BufferGeometry;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#00ff00" />
    </mesh>
  );
}

export default function STLViewer({ url }: { url: string }) {
  return (
    <div style={{ height: '80vh', width: '100%' }}>
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[10, 10, 10]} />
        <Suspense fallback={null}>
          <Model url={url} />
        </Suspense>
        <OrbitControls />
      </Canvas>
    </div>
  );
}
