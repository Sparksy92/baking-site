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

  // Dynamic tabletop material morphing
  const [targetColor] = useState(() => new THREE.Color('#5c4033'));
  const [targetRoughness, setTargetRoughness] = useState(0.7);
  const [targetMetalness, setTargetMetalness] = useState(0.1);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useEffect(() => {
    switch (selectedId) {
      case 'baked-fresh':
        targetColor.set('#f5f4ef'); // White marble pastry board
        setTargetRoughness(0.15);
        setTargetMetalness(0.2);
        break;
      case 'pantry':
        targetColor.set('#3d2518'); // Rustic dark mahogany
        setTargetRoughness(0.85);
        setTargetMetalness(0.05);
        break;
      case 'home-body':
        targetColor.set('#2a3336'); // Slate stone slab
        setTargetRoughness(0.9);
        setTargetMetalness(0.1);
        break;
      case 'oven-fund':
        targetColor.set('#914b30'); // Terracotta stone/brick
        setTargetRoughness(0.95);
        setTargetMetalness(0.0);
        break;
      default:
        targetColor.set('#5c4033'); // Default cedar wood
        setTargetRoughness(0.7);
        setTargetMetalness(0.1);
    }
  }, [selectedId, targetColor]);

  // Auto-rotate the board slowly if not interacting and not prefers reduced motion
  // Also morph the tabletop material dynamically in the animation frame
  useFrame(() => {
    if (boardRef.current) {
      // Check if user is actively dragging OrbitControls
      if (controlsRef.current && controlsRef.current.state !== -1) {
        setUserInteracting(true);
      }

      if (!prefersReducedMotion && !userInteracting && !selectedId) {
        boardRef.current.rotation.y += 0.003;
      }
    }

    if (matRef.current) {
      matRef.current.color.lerp(targetColor, 0.1);
      matRef.current.roughness = THREE.MathUtils.lerp(matRef.current.roughness, targetRoughness, 0.1);
      matRef.current.metalness = THREE.MathUtils.lerp(matRef.current.metalness, targetMetalness, 0.1);
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
      <ambientLight intensity={0.5} color="#f0ebdd" />
      <directionalLight
        position={[8, 12, 6]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0005}
        color="#fffaf0"
      />
      <pointLight position={[-8, 6, -6]} intensity={0.5} color="#ffe5cc" />

      {/* Main Board Group */}
      <group ref={boardRef}>
        {/* Countertop/Rotating Board */}
        <mesh receiveShadow position={[0, -0.15, 0]}>
          <cylinderGeometry args={[3.2, 3.3, 0.3, 40]} />
          <meshStandardMaterial ref={matRef} color="#5c4033" roughness={0.7} metalness={0.1} />
        </mesh>
        
        {/* Inner decorative board ring */}
        <mesh position={[0, -0.01, 0]}>
          <cylinderGeometry args={[2.9, 2.9, 0.05, 40]} />
          <meshStandardMaterial color="#22140c" roughness={0.9} />
        </mesh>

        {/* 1. Baked Fresh */}
        <InteractiveObject position={[2.0, 0.02, 0]} id="baked-fresh" selectedId={selectedId} onSelect={onSelect}>
          {/* Cutting Board */}
          <mesh castShadow position={[0, 0.02, 0]}>
            <boxGeometry args={[1.0, 0.04, 0.7]} />
            <meshStandardMaterial color="#d8b589" roughness={0.8} />
          </mesh>
          {/* Sourdough Bread Loaf (Capsule) */}
          <mesh castShadow position={[0, 0.13, -0.05]} rotation={[0, 0.2, Math.PI / 2]}>
            <capsuleGeometry args={[0.12, 0.35, 8, 16]} />
            <meshStandardMaterial color="#b36e33" roughness={0.95} />
          </mesh>
          {/* Scored Bread Crust Mark */}
          <mesh position={[0.02, 0.23, -0.05]} rotation={[0, 0.2, Math.PI / 2]}>
            <capsuleGeometry args={[0.015, 0.3, 4, 8]} />
            <meshStandardMaterial color="#ecc69e" roughness={0.95} />
          </mesh>
          {/* Cinnamon Roll 1 */}
          <mesh castShadow position={[0.2, 0.07, 0.18]}>
            <cylinderGeometry args={[0.12, 0.12, 0.06, 16]} />
            <meshStandardMaterial color="#cca16a" roughness={0.9} />
          </mesh>
          {/* Roll 1 Icing */}
          <mesh position={[0.2, 0.1, 0.18]}>
            <cylinderGeometry args={[0.1, 0.1, 0.01, 16]} />
            <meshStandardMaterial color="#fdfdfb" roughness={0.25} />
          </mesh>
          {/* Cinnamon Roll 2 */}
          <mesh castShadow position={[-0.1, 0.07, 0.18]}>
            <cylinderGeometry args={[0.1, 0.1, 0.06, 16]} />
            <meshStandardMaterial color="#cca16a" roughness={0.9} />
          </mesh>
          {/* Roll 2 Icing */}
          <mesh position={[-0.1, 0.1, 0.18]}>
            <cylinderGeometry args={[0.08, 0.08, 0.01, 16]} />
            <meshStandardMaterial color="#fdfdfb" roughness={0.25} />
          </mesh>
        </InteractiveObject>

        {/* 2. Pantry */}
        <InteractiveObject position={[0, 0.02, 2.0]} id="pantry" selectedId={selectedId} onSelect={onSelect}>
          {/* Crate/Tray */}
          <mesh castShadow position={[0, 0.03, 0]}>
            <boxGeometry args={[0.8, 0.06, 0.8]} />
            <meshStandardMaterial color="#4a4e4d" roughness={0.9} />
          </mesh>
          
          {/* Jam Jar 1 (Glass Outer) */}
          <mesh castShadow position={[-0.18, 0.18, -0.15]}>
            <cylinderGeometry args={[0.11, 0.11, 0.28, 16]} />
            <meshStandardMaterial color="#ffffff" roughness={0.05} metalness={0.9} transparent opacity={0.3} />
          </mesh>
          {/* Jam Content Inner */}
          <mesh position={[-0.18, 0.16, -0.15]}>
            <cylinderGeometry args={[0.1, 0.1, 0.23, 16]} />
            <meshStandardMaterial color="#8b0000" roughness={0.7} />
          </mesh>
          {/* Lid */}
          <mesh position={[-0.18, 0.33, -0.15]}>
            <cylinderGeometry args={[0.12, 0.12, 0.03, 16]} />
            <meshStandardMaterial color="#b5b5b5" roughness={0.4} metalness={0.7} />
          </mesh>
          
          {/* Mason Jar 2 (Glass Outer) */}
          <mesh castShadow position={[0.18, 0.2, -0.1]}>
            <cylinderGeometry args={[0.11, 0.11, 0.32, 16]} />
            <meshStandardMaterial color="#ffffff" roughness={0.05} metalness={0.9} transparent opacity={0.3} />
          </mesh>
          {/* Preserves Content Inner */}
          <mesh position={[0.18, 0.18, -0.1]}>
            <cylinderGeometry args={[0.1, 0.1, 0.27, 16]} />
            <meshStandardMaterial color="#cc9f18" roughness={0.7} />
          </mesh>
          {/* Lid */}
          <mesh position={[0.18, 0.37, -0.1]}>
            <cylinderGeometry args={[0.12, 0.12, 0.03, 16]} />
            <meshStandardMaterial color="#875629" roughness={0.5} />
          </mesh>

          {/* Dried Mix Jar 3 (Glass Outer) */}
          <mesh castShadow position={[0, 0.16, 0.18]}>
            <cylinderGeometry args={[0.09, 0.09, 0.24, 16]} />
            <meshStandardMaterial color="#ffffff" roughness={0.05} metalness={0.9} transparent opacity={0.3} />
          </mesh>
          {/* Herbs Content Inner */}
          <mesh position={[0, 0.14, 0.18]}>
            <cylinderGeometry args={[0.08, 0.08, 0.19, 16]} />
            <meshStandardMaterial color="#4f6627" roughness={0.9} />
          </mesh>
          {/* Lid */}
          <mesh position={[0, 0.29, 0.18]}>
            <cylinderGeometry args={[0.1, 0.1, 0.03, 16]} />
            <meshStandardMaterial color="#b5b5b5" roughness={0.4} metalness={0.7} />
          </mesh>
        </InteractiveObject>

        {/* 3. Home & Body */}
        <InteractiveObject position={[-2.0, 0.02, 0]} id="home-body" selectedId={selectedId} onSelect={onSelect}>
          {/* Slate Tray */}
          <mesh castShadow position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.48, 0.5, 0.04, 24]} />
            <meshStandardMaterial color="#536872" roughness={0.9} />
          </mesh>
          
          {/* Amber Glass Dropper Bottle 1 */}
          <mesh castShadow position={[-0.16, 0.18, -0.1]}>
            <cylinderGeometry args={[0.08, 0.08, 0.26, 16]} />
            <meshStandardMaterial color="#4e301e" roughness={0.1} metalness={0.8} transparent opacity={0.65} />
          </mesh>
          {/* Dropper Cap */}
          <mesh position={[-0.16, 0.32, -0.1]}>
            <cylinderGeometry args={[0.05, 0.05, 0.04, 12]} />
            <meshStandardMaterial color="#1f1f1f" roughness={0.8} />
          </mesh>
          {/* Dropper Rubber Bulb */}
          <mesh position={[-0.16, 0.36, -0.1]}>
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshStandardMaterial color="#111111" roughness={0.9} />
          </mesh>

          {/* Amber Glass Dropper Bottle 2 */}
          <mesh castShadow position={[0.18, 0.15, -0.15]}>
            <cylinderGeometry args={[0.07, 0.07, 0.2, 16]} />
            <meshStandardMaterial color="#4e301e" roughness={0.1} metalness={0.8} transparent opacity={0.65} />
          </mesh>
          {/* Dropper Cap */}
          <mesh position={[0.18, 0.26, -0.15]}>
            <cylinderGeometry args={[0.045, 0.045, 0.03, 12]} />
            <meshStandardMaterial color="#1f1f1f" roughness={0.8} />
          </mesh>
          {/* Dropper Rubber Bulb */}
          <mesh position={[0.18, 0.29, -0.15]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshStandardMaterial color="#111111" roughness={0.9} />
          </mesh>

          {/* Salve Tin */}
          <mesh castShadow position={[0.02, 0.05, 0.18]}>
            <cylinderGeometry args={[0.16, 0.16, 0.08, 20]} />
            <meshStandardMaterial color="#d8d8d8" roughness={0.2} metalness={0.95} />
          </mesh>
        </InteractiveObject>

        {/* 4. Oven Fund */}
        <InteractiveObject position={[0, 0.02, -2.0]} id="oven-fund" selectedId={selectedId} onSelect={onSelect}>
          {/* Brick Stone base */}
          <mesh castShadow position={[0, 0.15, 0]}>
            <boxGeometry args={[0.9, 0.3, 0.9]} />
            <meshStandardMaterial color="#6e6b66" roughness={0.9} />
          </mesh>
          {/* Oven Dome */}
          <mesh castShadow position={[0, 0.45, 0]}>
            <sphereGeometry args={[0.42, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#a74e37" roughness={0.9} />
          </mesh>
          {/* Fire Glow Light inside the oven mouth */}
          <pointLight position={[0, 0.35, 0.3]} color="#ff7700" intensity={1.5} distance={1.8} decay={2} />
          {/* Oven Arch Mouth */}
          <mesh position={[0, 0.35, 0.4]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.26, 0.18, 0.05]} />
            <meshStandardMaterial color="#1c1a19" roughness={0.95} />
          </mesh>
          {/* Fire Embers Mesh */}
          <mesh position={[0, 0.33, 0.32]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color="#ff5500" />
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
        gl={{ antialias: true, alpha: true }}
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
