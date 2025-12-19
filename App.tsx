
import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, Stars, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { Play, Settings, Info, Zap, Target, RotateCcw, Camera, Maximize } from 'lucide-react';
import { ShipConfig, GameState, ControlState } from './types';
import KitbashShip from './components/KitbashShip';
import Gate from './components/Gate';
import { generateBriefing } from './services/geminiService';

// --- Physics & Logic Constants ---
const DRAG = 0.94;
const ROTATION_SPEED = 0.04;
const THRUST_POWER = 0.03;
const GATE_DETECTION_RADIUS = 1.2;

// --- Interactive Joystick Logic ---
const ControlStick = ({ 
  label, 
  icon: Icon, 
  onMove, 
  values 
}: { 
  label: string, 
  icon: any, 
  onMove: (x: number, y: number) => void,
  values: { x: number, y: number }
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointer = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let x = (e.clientX - centerX) / (rect.width / 2);
    let y = (centerY - e.clientY) / (rect.height / 2);
    
    x = Math.max(-1, Math.min(1, x));
    y = Math.max(-1, Math.min(1, y));
    
    onMove(x, y);
  };

  return (
    <div className="flex flex-col items-center">
      <div 
        ref={containerRef}
        className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-white/20 bg-black/60 relative touch-none pointer-events-auto shadow-2xl"
        onPointerDown={(e) => { setIsDragging(true); handlePointer(e); e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (isDragging) handlePointer(e); }}
        onPointerUp={() => { setIsDragging(false); onMove(0, 0); }}
        onPointerCancel={() => { setIsDragging(false); onMove(0, 0); }}
      >
         <div 
           className="absolute w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center border-2 border-white/40 shadow-xl transition-transform duration-75 pointer-events-none"
           style={{ transform: `translate(${values.x * 35}px, ${-values.y * 35}px)` }}
         >
           <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
         </div>
      </div>
      <p className="mt-2 text-[9px] text-white/40 uppercase tracking-widest font-bold">{label}</p>
    </div>
  );
};

// --- Game Loop Component ---

const GameLoop: React.FC<{
  gameState: GameState;
  controls: ControlState;
  shipConfig: ShipConfig;
  shipScale: number;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  gates: [number, number, number][];
  arEnabled: boolean;
}> = ({ gameState, controls, shipConfig, shipScale, setGameState, gates, arEnabled }) => {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const position = useRef(new THREE.Vector3(0, 1.5, -8));
  const rotation = useRef(new THREE.Euler(0, Math.PI, 0)); 

  useFrame(() => {
    if (!gameState.isPlaying || gameState.isGameOver) return;

    // Movement Vectors relative to current rotation
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(rotation.current);
    
    // Apply Thrust
    const thrust = forward.clone().multiplyScalar(controls.throttle * THRUST_POWER * (shipConfig.stats.speed / 5));
    velocity.current.add(thrust);

    // Apply Rotation based on stick input
    rotation.current.y -= controls.yaw * ROTATION_SPEED * (shipConfig.stats.handling / 5);
    rotation.current.x += controls.pitch * ROTATION_SPEED * (shipConfig.stats.handling / 5);
    rotation.current.z -= controls.roll * ROTATION_SPEED * (shipConfig.stats.handling / 5);

    // Physics Update
    velocity.current.multiplyScalar(DRAG);
    position.current.add(velocity.current);

    // --- Boundary Enforcement ---
    // Keep ship in the "Frontal Viable Area" when in AR
    if (arEnabled) {
      // Constraints for Z (Distance from camera), X (Side to side), Y (Height)
      position.current.z = Math.min(-2, Math.max(-40, position.current.z));
      position.current.x = Math.min(15, Math.max(-15, position.current.x));
      position.current.y = Math.min(10, Math.max(0.2, position.current.y));
    } else {
      // In VR mode, wider boundaries
      if (position.current.length() > 150) {
        position.current.set(0, 1.5, -8);
        velocity.current.set(0, 0, 0);
      }
    }

    // Gate Detection
    const currentTarget = gates[gameState.currentGate];
    if (currentTarget) {
      const gateVec = new THREE.Vector3(...currentTarget);
      const dist = position.current.distanceTo(gateVec);
      if (dist < GATE_DETECTION_RADIUS * (shipScale + 0.5)) {
        if (gameState.currentGate === gates.length - 1) {
          setGameState(prev => ({ ...prev, isGameOver: true, isPlaying: false }));
        } else {
          setGameState(prev => ({ ...prev, currentGate: prev.currentGate + 1, score: prev.score + 100 }));
        }
      }
    }

    // --- Camera Handling ---
    if (arEnabled) {
      // The user is the camera. Position stays fixed, looking at the drone.
      camera.position.set(0, 1.6, 0); 
      // Ensure we don't look at our own position to prevent black screens (NaNs)
      const lookTarget = position.current.clone();
      if (lookTarget.distanceTo(camera.position) > 0.1) {
        camera.lookAt(lookTarget);
      }
    } else {
      // Standard 3rd person follow
      const camOffset = new THREE.Vector3(0, 1.5, 6).applyEuler(rotation.current);
      camera.position.lerp(position.current.clone().add(camOffset), 0.12);
      camera.lookAt(position.current);
    }
  });

  return (
    <group scale={shipScale}>
      <KitbashShip 
        config={shipConfig} 
        controls={controls} 
        position={position.current.clone().divideScalar(shipScale)} 
        rotation={rotation.current} 
      />
      {gates.map((pos, idx) => (
        <Gate 
          key={idx} 
          position={[pos[0]/shipScale, pos[1]/shipScale, pos[2]/shipScale]} 
          active={idx === gameState.currentGate} 
        />
      ))}
    </group>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  const [showConfig, setShowConfig] = useState(true);
  const [arEnabled, setArEnabled] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [shipScale, setShipScale] = useState(1.0);
  
  const [shipConfig, setShipConfig] = useState<ShipConfig>({
    chassis: 'interceptor',
    engineColor: '#00ffff',
    glowIntensity: 1.0,
    stats: { speed: 7, durability: 4, handling: 8 }
  });

  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    score: 0,
    time: 0,
    currentGate: 0,
    totalGates: 5,
    briefing: "System Check: Green. Awaiting Ignition.",
    isGameOver: false
  });

  const [controls, setControls] = useState<ControlState>({
    throttle: 0, yaw: 0, pitch: 0, roll: 0
  });

  // Racing Course Layout
  const gates: [number, number, number][] = [
    [0, 1.8, -12],
    [10, 3, -25],
    [-8, 1.5, -40],
    [5, 5, -55],
    [0, 2, -75]
  ];

  const handleStart = async () => {
    setShowConfig(false);
    setGameState(prev => ({ ...prev, briefing: "Requesting Flight Clearance..." }));
    const briefing = await generateBriefing(shipConfig.chassis);
    setGameState(prev => ({ ...prev, isPlaying: true, briefing, currentGate: 0, score: 0, time: 0, isGameOver: false }));
  };

  const toggleAR = async () => {
    if (!arEnabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
        });
        setVideoStream(stream);
        setArEnabled(true);
      } catch (err) {
        alert("Camera access failed. Check your browser permissions.");
      }
    } else {
      videoStream?.getTracks().forEach(track => track.stop());
      setVideoStream(null);
      setArEnabled(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden text-white bg-black select-none font-sans">
      {/* AR Layer: Camera Feed */}
      {arEnabled && videoStream && (
        <video 
          autoPlay 
          muted 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover z-0 grayscale contrast-125 opacity-80"
          ref={(video) => { if(video) video.srcObject = videoStream; }}
        />
      )}

      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <Canvas shadows dpr={[1, 2]} gl={{ alpha: true }}>
          <PerspectiveCamera makeDefault position={[0, 1.6, 5]} />
          <ambientLight intensity={0.8} />
          <pointLight position={[10, 10, 10]} intensity={1.5} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} color={shipConfig.engineColor} />
          
          {!arEnabled && (
            <>
              <Sky distance={450000} sunPosition={[0, 1, 0]} inclination={0} azimut={0.25} />
              <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
            </>
          )}

          <GameLoop 
            gameState={gameState} 
            controls={controls} 
            shipConfig={shipConfig} 
            shipScale={shipScale}
            setGameState={setGameState}
            gates={gates}
            arEnabled={arEnabled}
          />
        </Canvas>
      </div>

      {/* HUD: In-Game UI */}
      {gameState.isPlaying && (
        <>
          <div className="absolute top-6 left-6 z-20 pointer-events-none max-w-xs">
            <div className="bg-black/70 border-l-4 border-cyan-500 p-3 rounded-r-lg backdrop-blur-md">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400">Tactical Comms</span>
              </div>
              <p className="text-[11px] leading-snug text-gray-200 font-mono italic">
                {gameState.briefing}
              </p>
            </div>
          </div>

          <div className="absolute top-6 right-6 z-20 pointer-events-none flex gap-3">
             <div className="bg-black/70 border border-white/10 px-4 py-2 rounded-lg backdrop-blur-md text-center">
                <p className="text-[8px] text-gray-400 uppercase tracking-widest">Gate</p>
                <p className="text-lg font-bold orbitron">{gameState.currentGate + 1}/{gates.length}</p>
             </div>
             <div className="bg-black/70 border border-white/10 px-4 py-2 rounded-lg backdrop-blur-md text-center">
                <p className="text-[8px] text-gray-400 uppercase tracking-widest">Credits</p>
                <p className="text-lg font-bold orbitron">{gameState.score}</p>
             </div>
          </div>

          {/* Controls: Stick Overlays */}
          <div className="absolute bottom-10 w-full px-6 md:px-12 flex justify-between items-end z-30 pointer-events-none">
            <ControlStick 
              label="Thrust / Yaw" 
              icon={Zap} 
              values={{ x: controls.yaw, y: controls.throttle }}
              onMove={(x, y) => setControls(prev => ({ ...prev, yaw: -x, throttle: y }))} 
            />
            <ControlStick 
              label="Pitch / Roll" 
              icon={Target} 
              values={{ x: controls.roll, y: controls.pitch }}
              onMove={(x, y) => setControls(prev => ({ ...prev, roll: -x, pitch: y }))} 
            />
          </div>
        </>
      )}

      {/* Hangar Menu */}
      {showConfig && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 overflow-y-auto">
          <div className="max-w-4xl w-full bg-[#050505] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-8 md:p-12">
              <header className="mb-10 flex justify-between items-end">
                <div>
                  <h1 className="text-5xl md:text-6xl font-black orbitron tracking-tighter text-white">X-RACER</h1>
                  <p className="text-cyan-500 text-xs font-bold tracking-[0.4em] uppercase mt-2 opacity-80">Kitbash Commander Interface</p>
                </div>
                <div className="hidden md:block text-right">
                  <p className="text-[10px] text-gray-600 uppercase font-mono tracking-widest">v2.1 Experimental XR</p>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <div>
                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Settings className="w-3 h-3 text-cyan-400" /> Chassis Selection
                    </h2>
                    <div className="grid grid-cols-3 gap-2">
                      {(['scout', 'interceptor', 'heavy'] as const).map(type => (
                        <button
                          key={type}
                          onClick={() => setShipConfig(prev => ({ ...prev, chassis: type }))}
                          className={`py-3 rounded-lg text-[10px] font-bold uppercase transition-all ${
                            shipConfig.chassis === type ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Maximize className="w-3 h-3 text-cyan-400" /> Scale Adjustment
                    </h2>
                    <input 
                      type="range" min="0.5" max="4.0" step="0.1" 
                      value={shipScale} 
                      onChange={(e) => setShipScale(parseFloat(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <div className="flex justify-between text-[8px] text-gray-500 mt-2 uppercase font-bold">
                      <span>Desktop Toy</span>
                      <span>Full Scale ({shipScale.toFixed(1)}x)</span>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Plasma Trail Core</h2>
                    <div className="flex gap-3">
                      {['#00ffff', '#ff0055', '#33ff00', '#ffaa00'].map(color => (
                        <button
                          key={color}
                          onClick={() => setShipConfig(prev => ({ ...prev, engineColor: color }))}
                          className={`w-9 h-9 rounded-full border-2 transition-all ${
                            shipConfig.engineColor === color ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'border-transparent opacity-50'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between space-y-8">
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                    <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-4">Pilot Briefing</h3>
                    <p className="text-sm text-gray-400 leading-relaxed font-mono">
                      Experimental RC drone racing via neural-link. Use the touch-sticks to navigate the vector field. XR Mode projects the ship into your local environment using camera passthrough.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <button 
                      onClick={toggleAR}
                      className={`w-full py-4 rounded-xl font-bold orbitron text-xs tracking-widest transition-all flex items-center justify-center gap-3 ${
                        arEnabled ? 'bg-amber-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      <Camera className="w-4 h-4" />
                      {arEnabled ? 'XR MODE: ACTIVE' : 'ENABLE CAMERA PASSTHROUGH'}
                    </button>
                    <button 
                      onClick={handleStart}
                      className="w-full py-5 bg-cyan-500 text-black rounded-xl font-black orbitron text-sm tracking-widest hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-900/40 uppercase"
                    >
                      Ignition Start
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Screen */}
      {gameState.isGameOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 p-6 text-center backdrop-blur-3xl">
           <div className="max-w-md w-full animate-in zoom-in-95 duration-300">
             <div className="mb-2 text-cyan-400 font-black tracking-[1em] text-[10px] uppercase">Race Complete</div>
             <h2 className="text-5xl font-black orbitron mb-10 text-white tracking-tighter">VICTORY</h2>
             
             <div className="grid grid-cols-2 gap-4 mb-10">
               <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                 <p className="text-[9px] text-gray-500 uppercase font-black mb-1">Credits Earned</p>
                 <p className="text-3xl font-bold orbitron text-white">{gameState.score}</p>
               </div>
               <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                 <p className="text-[9px] text-gray-500 uppercase font-black mb-1">Gates Cleared</p>
                 <p className="text-3xl font-bold orbitron text-white">{gameState.currentGate + 1}</p>
               </div>
             </div>

             <div className="flex flex-col gap-3">
               <button 
                 onClick={handleStart}
                 className="w-full py-4 bg-cyan-500 text-black font-black orbitron rounded-xl flex items-center justify-center gap-2 hover:bg-cyan-400 text-xs"
               >
                 <RotateCcw className="w-4 h-4" /> RELAUNCH
               </button>
               <button 
                 onClick={() => setShowConfig(true)}
                 className="w-full py-4 bg-white/5 text-white font-bold orbitron rounded-xl border border-white/10 hover:bg-white/10 text-xs"
               >
                  HANGAR DECK
               </button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
