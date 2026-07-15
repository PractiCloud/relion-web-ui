// Particle Picker Types

export interface Particle {
  id: string;
  x: number;
  y: number;
  fom: number;  // Figure of Merit (0-1)
  source: 'autopick' | 'manual' | 'ai';
  selected?: boolean;
}

export interface Micrograph {
  id: string;
  name: string;
  path: string;
  width: number;
  height: number;
  pixelSize: number;  // Angstroms per pixel
  metrics: MicrographMetrics;
}

export interface MicrographMetrics {
  defocusU: number;      // Angstroms
  defocusV: number;      // Angstroms
  defocusAngle: number;  // Degrees
  maxResolution: number; // Angstroms
  ctfFom: number;        // CTF Figure of Merit
  particleCount: number;
  motionTotal: number;   // Total motion in pixels
  motionEarly: number;
  motionLate: number;
  iceThickness?: number;
  foilArea?: number;     // Percentage
}

export interface CTFData {
  defocusU: number;
  defocusV: number;
  astigmatism: number;
  maxResolution: number;
  phaseShift: number;
  powerSpectrumPath?: string;
}

export interface PickerParams {
  boxSize: number;       // Particle box size in pixels
  minDiameter: number;   // Min particle diameter in Angstroms
  maxDiameter: number;   // Max particle diameter in Angstroms
  threshold: number;     // Picking threshold (0-1)
}

export interface LogPickerParams extends PickerParams {
  minLoGDiameter: number;
  maxLoGDiameter: number;
  adjustStddev: number;
  upperThreshold: number;
}

export interface TopazParams extends PickerParams {
  model: string;
  scale: number;
  numWorkers: number;
}

export type ViewMode = 'downscaled' | 'denoised' | 'preprocessed';

export type EditMode = 'view' | 'add' | 'delete' | 'select';

export interface ViewerSettings {
  viewMode: ViewMode;
  showParticles: boolean;
  showMasks: boolean;
  showCTF: boolean;
  particleShape: 'circle' | 'square';
  particleOpacity: number;
  zoom: number;
  panX: number;
  panY: number;
}

export interface FilterCriteria {
  defocusMin?: number;
  defocusMax?: number;
  resolutionMin?: number;
  resolutionMax?: number;
  particleCountMin?: number;
  particleCountMax?: number;
  motionMax?: number;
  ctfFomMin?: number;
}

export interface Project {
  name: string;
  path: string;
  micrographCount: number;
  particleCount: number;
  ctfJobId?: string;
  autopickJobId?: string;
  motioncorrJobId?: string;
}

export interface ExportOptions {
  format: 'star' | 'box' | 'json';
  includeRejected: boolean;
  createManualPickJob: boolean;
  jobAlias?: string;
}

// API Response Types
export interface MicrographListResponse {
  micrographs: Micrograph[];
  total: number;
  ctfJob?: string;
  autopickJob?: string;
  motioncorrJob?: string;
}

export interface ParticleListResponse {
  particles: Particle[];
  boxSize: number;
  source: string;
  micrographId: string;
}

export interface MetricsDataPoint {
  micrographId: string;
  micrographName: string;
  value: number;
  selected?: boolean;
}

export interface ChartData {
  metric: string;
  data: MetricsDataPoint[];
  min: number;
  max: number;
  mean: number;
  std: number;
}

// Color coding for FOM
export const FOM_COLORS = {
  high: '#4caf50',    // Green - FOM > 0.6
  medium: '#ffeb3b',  // Yellow - FOM 0.3-0.6
  low: '#ff9800',     // Orange - FOM < 0.3
  rejected: '#f44336' // Red - manually rejected
} as const;

export const getFOMColor = (fom: number): string => {
  if (fom > 0.6) return FOM_COLORS.high;
  if (fom > 0.3) return FOM_COLORS.medium;
  return FOM_COLORS.low;
};
