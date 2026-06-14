'use client';

import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface HomesteadDioramaSceneProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  prefersReducedMotion: boolean;
}

// ── 3D Interactive Group ──────────────────────────────────────────
function InteractiveObject({
  position,
  id,
  selectedId,
  onSelect,
  children,
}: {
  position: [number, number, number];
  id: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const isSelected = selectedId === id;
  const groupRef = useRef<THREE.Group>(null);

  // Animate hover/selection scales
  useFrame(() => {
    if (!groupRef.current) return;
    const targetScale = isSelected ? 1.25 : hovered ? 1.12 : 1.0;
    const currentScale = groupRef.current.scale.x;
    const nextScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.15);
    groupRef.current.scale.set(nextScale, nextScale, nextScale);

    // Subtle floating animation for selected item
    if (isSelected) {
      groupRef.current.position.y = position[1] + Math.sin(Date.now() * 0.005) * 0.05 + 0.1;
    } else {
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, position[1], 0.15);
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      {children}
      {/* Selected Indicator Ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
          <ringGeometry args={[0.9, 1.0, 32]} />
          <meshBasicMaterial color="#C8A2A8" side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Hover Highlight Ring */}
      {hovered && !isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
          <ringGeometry args={[0.85, 0.9, 32]} />
          <meshBasicMaterial color="#6F7D5C" opacity={0.6} transparent side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// ── Scene Content ──────────────────────────────────────────────────
function SceneContent({ selectedId, onSelect, prefersReducedMotion }: HomesteadDioramaSceneProps) {
  const boardRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<any>(null);
  const [userInteracting, setUserInteracting] = useState(false);

  // Auto-rotate the board slowly if not interacting and not prefers reduced motion
  useFrame(() => {
    if (!boardRef.current) return;
    
    // Check if user is actively dragging OrbitControls
    if (controlsRef.current && controlsRef.current.state !== -1) {
      setUserInteracting(true);
    }

    if (!prefersReducedMotion && !userInteracting && !selectedId) {
      boardRef.current.rotation.y += 0.003;
    }
  });

  // Reset auto-rotate delay when interaction stops
  useEffect(() => {
    if (userInteracting) {
      const timer = setTimeout(() => {
        setUserInteracting(false);
      }, 8000); // Resume auto-rotate after 8 seconds of idle
      return () => clearTimeout(timer);
    }
  }, [userInteracting]);

  return (
    <>
      {/* Background Lighting */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 5]} intensity={1.0} castShadow />
      <pointLight position={[-5, 5, -5]} intensity={0.4} />

      {/* Main Board Group */}
      <group ref={boardRef}>
        {/* Countertop/Rotating Board */}
        <mesh receiveShadow position={[0, -0.15, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[3.2, 3.3, 0.3, 40]} />
          <meshStandardMaterial color="#4A3728" roughness={0.7} metalness={0.1} />
        </mesh>
        
        {/* Inner decorative board ring */}
        <mesh position={[0, -0.01, 0]}>
          <cylinderGeometry args={[2.9, 2.9, 0.05, 40]} />
          <meshStandardMaterial color="#36251A" roughness={0.9} />
        </mesh>

        {/* 1. Baked Fresh */}
        <InteractiveObject position={[2.0, 0.02, 0]} id="baked-fresh" selectedId={selectedId} onSelect={onSelect}>
          {/* Cutting Board */}
          <mesh castShadow position={[0, 0.02, 0]}>
            <boxGeometry args={[1.0, 0.04, 0.7]} />
            <meshStandardMaterial color="#D8B589" roughness={0.8} />
          </mesh>
          {/* Bread Loaf */}
          <mesh castShadow position={[0, 0.16, -0.05]} rotation={[0, 0.2, 0]}>
            <boxGeometry args={[0.5, 0.24, 0.28]} />
            <meshStandardMaterial color="#B0703C" roughness={0.9} />
          </mesh>
          {/* Slices decoration */}
          <mesh position={[-0.32, 0.16, -0.05]}>
            <boxGeometry args={[0.08, 0.2, 0.24]} />
            <meshStandardMaterial color="#ECC79E" roughness={0.9} />
          </mesh>
          {/* Cinnamon Roll 1 */}
          <mesh castShadow position={[0.2, 0.07, 0.18]}>
            <cylinderGeometry args={[0.12, 0.12, 0.06, 16]} />
            <meshStandardMaterial color="#DFBA8A" roughness={0.9} />
          </mesh>
          {/* Cinnamon Roll 2 */}
          <mesh castShadow position={[-0.1, 0.07, 0.18]}>
            <cylinderGeometry args={[0.1, 0.1, 0.06, 16]} />
            <meshStandardMaterial color="#DFBA8A" roughness={0.9} />
          </mesh>
        </InteractiveObject>

        {/* 2. Pantry */}
        <InteractiveObject position={[0, 0.02, 2.0]} id="pantry" selectedId={selectedId} onSelect={onSelect}>
          {/* Crate/Tray */}
          <mesh castShadow position={[0, 0.03, 0]}>
            <boxGeometry args={[0.8, 0.06, 0.8]} />
            <meshStandardMaterial color="#4A4E4D" roughness={0.9} />
          </mesh>
          {/* Jam Jar 1 (Red) */}
          <mesh castShadow position={[-0.18, 0.2, -0.15]}>
            <cylinderGeometry args={[0.12, 0.12, 0.28, 16]} />
            <meshStandardMaterial color="#8B0000" roughness={0.3} metalness={0.2} opacity={0.9} transparent />
          </mesh>
          {/* Jam Jar Lid */}
          <mesh position={[-0.18, 0.35, -0.15]}>
            <cylinderGeometry args={[0.13, 0.13, 0.04, 16]} />
            <meshStandardMaterial color="#D3D3D3" roughness={0.5} />
          </mesh>
          
          {/* Mason Jar 2 (Yellow Preserves) */}
          <mesh castShadow position={[0.18, 0.22, -0.1]}>
            <cylinderGeometry args={[0.12, 0.12, 0.32, 16]} />
            <meshStandardMaterial color="#DAA520" roughness={0.3} metalness={0.2} opacity={0.9} transparent />
          </mesh>
          {/* Lid */}
          <mesh position={[0.18, 0.39, -0.1]}>
            <cylinderGeometry args={[0.13, 0.13, 0.04, 16]} />
            <meshStandardMaterial color="#8B5A2B" roughness={0.6} />
          </mesh>

          {/* Dried Mix Jar 3 (Green) */}
          <mesh castShadow position={[0, 0.18, 0.18]}>
            <cylinderGeometry args={[0.1, 0.1, 0.24, 16]} />
            <meshStandardMaterial color="#6B8E23" roughness={0.3} metalness={0.2} opacity={0.9} transparent />
          </mesh>
          {/* Lid */}
          <mesh position={[0, 0.31, 0.18]}>
            <cylinderGeometry args={[0.11, 0.11, 0.04, 16]} />
            <meshStandardMaterial color="#D3D3D3" roughness={0.5} />
          </mesh>
        </InteractiveObject>

        {/* 3. Home & Body */}
        <InteractiveObject position={[-2.0, 0.02, 0]} id="home-body" selectedId={selectedId} onSelect={onSelect}>
          {/* Slate Tray */}
          <mesh castShadow position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.48, 0.5, 0.04, 24]} />
            <meshStandardMaterial color="#536872" roughness={0.9} />
          </mesh>
          {/* Amber Dropper Bottle 1 */}
          <mesh castShadow position={[-0.16, 0.2, -0.1]}>
            <cylinderGeometry args={[0.09, 0.09, 0.28, 16]} />
            <meshStandardMaterial color="#5C4033" roughness={0.2} metalness={0.4} />
          </mesh>
          {/* Bottle Top */}
          <mesh position={[-0.16, 0.36, -0.1]}>
            <cylinderGeometry args={[0.04, 0.04, 0.06, 12]} />
            <meshStandardMaterial color="#2B2B2B" roughness={0.9} />
          </mesh>

          {/* Dropper Bottle 2 */}
          <mesh castShadow position={[0.18, 0.16, -0.15]}>
            <cylinderGeometry args={[0.08, 0.08, 0.22, 16]} />
            <meshStandardMaterial color="#5C4033" roughness={0.2} metalness={0.4} />
          </mesh>
          <mesh position={[0.18, 0.29, -0.15]}>
            <cylinderGeometry args={[0.04, 0.04, 0.05, 12]} />
            <meshStandardMaterial color="#2B2B2B" roughness={0.9} />
          </mesh>

          {/* Salve Tin */}
          <mesh castShadow position={[0.02, 0.07, 0.18]}>
            <cylinderGeometry args={[0.16, 0.16, 0.08, 20]} />
            <meshStandardMaterial color="#C0C0C0" roughness={0.3} metalness={0.8} />
          </mesh>
        </InteractiveObject>

        {/* 4. Oven Fund */}
        <InteractiveObject position={[0, 0.02, -2.0]} id="oven-fund" selectedId={selectedId} onSelect={onSelect}>
          {/* Brick Stone base */}
          <mesh castShadow position={[0, 0.15, 0]}>
            <boxGeometry args={[0.9, 0.3, 0.9]} />
            <meshStandardMaterial color="#7F7F7F" roughness={0.9} />
          </mesh>
          {/* Oven Dome */}
          <mesh castShadow position={[0, 0.45, 0]}>
            <sphereGeometry args={[0.42, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#A52A2A" roughness={0.8} />
          </mesh>
          {/* Oven Arch Mouth */}
          <mesh position={[0, 0.4, 0.4]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.26, 0.18, 0.05]} />
            <meshStandardMaterial color="#1A1A1A" roughness={0.9} />
          </mesh>
          {/* Chimney */}
          <mesh castShadow position={[0.2, 0.62, -0.15]}>
            <cylinderGeometry args={[0.08, 0.08, 0.24, 12]} />
            <meshStandardMaterial color="#333333" roughness={0.9} />
          </mesh>
        </InteractiveObject>
      </group>

      {/* Camera / User Controls */}
      <OrbitControls
        ref={controlsRef}
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 4} // Don't allow look directly from top
        maxPolarAngle={Math.PI / 2.3} // Don't allow look from underneath the table
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

export default function HomesteadDioramaScene({ selectedId, onSelect, prefersReducedMotion }: HomesteadDioramaSceneProps) {
  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        camera={{ position: [0, 5, 7.5], fov: 45 }}
        gl={{ antialias: true }}
      >
        <SceneContent
          selectedId={selectedId}
          onSelect={onSelect}
          prefersReducedMotion={prefersReducedMotion}
        />
      </Canvas>
    </div>
  );
}
