
export interface ShipStats {
  speed: number;
  durability: number;
  handling: number;
}

export interface ShipConfig {
  chassis: 'scout' | 'interceptor' | 'heavy';
  engineColor: string;
  glowIntensity: number;
  stats: ShipStats;
}

export interface GameState {
  isPlaying: boolean;
  score: number;
  time: number;
  currentGate: number;
  totalGates: number;
  briefing: string;
  isGameOver: boolean;
}

export interface ControlState {
  throttle: number;
  yaw: number;
  pitch: number;
  roll: number;
}
