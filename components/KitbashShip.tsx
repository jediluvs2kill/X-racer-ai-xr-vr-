
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ShipConfig, ControlState } from '../types';

interface KitbashShipProps {
  config: ShipConfig;
  controls: ControlState;
  position: THREE.Vector3;
  rotation: THREE.Euler;
}

const KitbashShip: React.FC<KitbashShipProps> = ({ config, controls, position, rotation }) => {
  const groupRef = useRef<THREE.Group>(null);
  const thrusterRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    
    // Smoothly apply position and rotation from physics state
    groupRef.current.position.lerp(position, 0.2);
    groupRef.current.rotation.set(rotation.x, rotation.y, rotation.z);

    // Engine flicker effect
    if (thrusterRef.current) {
      thrusterRef.current.intensity = (config.glowIntensity * 2) + Math.random() * (controls.throttle * 5);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main Hull */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.4, 0.2, 0.8]} />
        <meshStandardMaterial color="#333" roughness={0.8} metalness={0.9} />
      </mesh>

      {/* Cockpit */}
      <mesh position={[0, 0.15, 0.1]}>
        <boxGeometry args={[0.2, 0.1, 0.3]} />
        <meshStandardMaterial color="#111" roughness={0.2} metalness={1} transparent opacity={0.6} />
      </mesh>

      {/* Wings / Engines */}
      <group position={[0, 0, -0.2]}>
        {/* Left Wing */}
        <mesh position={[-0.4, 0, 0]}>
          <boxGeometry args={[0.5, 0.05, 0.4]} />
          <meshStandardMaterial color="#444" />
        </mesh>
        {/* Left Engine */}
        <mesh position={[-0.5, 0, -0.3]}>
          <cylinderGeometry args={[0.1, 0.12, 0.4]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#222" />
        </mesh>

        {/* Right Wing */}
        <mesh position={[0.4, 0, 0]}>
          <boxGeometry args={[0.5, 0.05, 0.4]} />
          <meshStandardMaterial color="#444" />
        </mesh>
        {/* Right Engine */}
        <mesh position={[0.5, 0, -0.3]}>
          <cylinderGeometry args={[0.1, 0.12, 0.4]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      </group>

      {/* Engine Glow */}
      <group position={[0, 0, -0.5]}>
        <pointLight
          ref={thrusterRef}
          color={config.engineColor}
          distance={2}
          decay={2}
        />
        <mesh position={[-0.5, 0, 0]}>
          <circleGeometry args={[0.08, 16]} />
          <meshBasicMaterial color={config.engineColor} />
        </mesh>
        <mesh position={[0.5, 0, 0]}>
          <circleGeometry args={[0.08, 16]} />
          <meshBasicMaterial color={config.engineColor} />
        </mesh>
      </group>

      {/* Exposed Wires (Visual Detail) */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.3, 0.05, 0.6]} />
        <meshStandardMaterial color="#553311" />
      </mesh>
    </group>
  );
};

export default KitbashShip;
