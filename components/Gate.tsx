
import React from 'react';
import * as THREE from 'three';

interface GateProps {
  position: [number, number, number];
  active: boolean;
  onPassed?: () => void;
}

const Gate: React.FC<GateProps> = ({ position, active }) => {
  return (
    <group position={position}>
      {/* Ring Frame */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.05, 16, 32]} />
        <meshStandardMaterial 
          color={active ? "#00ffcc" : "#333"} 
          emissive={active ? "#00ffcc" : "#000"}
          emissiveIntensity={active ? 2 : 0}
        />
      </mesh>
      
      {/* Inner Portal Light Effect */}
      {active && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1, 32]} />
          <meshBasicMaterial color="#00ffcc" transparent opacity={0.1} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Floor Support (Optional) */}
      <mesh position={[0, -1, 0]}>
        <boxGeometry args={[0.2, 1, 0.2]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  );
};

export default Gate;
