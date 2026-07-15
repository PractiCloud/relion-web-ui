import axios from 'axios';
import {
  Particle,
  MicrographListResponse,
  ParticleListResponse,
  ChartData,
  CTFData,
  ExportOptions,
  LogPickerParams,
  TopazParams,
} from '../types';

// Determine the correct API base URL for OOD deployment
function getApiBaseUrl(): string {
  const pathname = window.location.pathname;

  // Check if running under OOD (e.g., /pun/sys/relion_passenger/particle-picker/)
  const oodMatch = pathname.match(/^(\/pun\/sys\/[^/]+)/);
  if (oodMatch) {
    // Running under OOD - use absolute path with app name
    return `${oodMatch[1]}/api/particle-picker`;
  }

  // Default: absolute path for local development
  return '/api/particle-picker';
}

const API_BASE = getApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const api = {
  // Micrograph endpoints
  async getMicrographs(
    projectPath: string,
    ctfJob?: string,
    autopickJob?: string,
    manualpickJob?: string
  ): Promise<MicrographListResponse> {
    const params = new URLSearchParams({ project: projectPath });
    if (ctfJob) params.append('ctf_job', ctfJob);
    if (autopickJob) params.append('autopick_job', autopickJob);
    if (manualpickJob) params.append('manualpick_job', manualpickJob);

    const response = await apiClient.get(`/micrographs?${params}`);
    return response.data;
  },

  async getMicrographImage(
    projectPath: string,
    micrographId: string,
    options?: {
      scale?: number;
      mode?: 'raw' | 'denoised' | 'preprocessed';
      format?: 'png' | 'jpg';
    }
  ): Promise<string> {
    const params = new URLSearchParams({
      project: projectPath,
      mic_id: micrographId,
    });
    if (options?.scale) params.append('scale', options.scale.toString());
    if (options?.mode) params.append('mode', options.mode);
    if (options?.format) params.append('format', options.format);

    // Return full URL for image src
    return `${API_BASE}/micrograph-image?${params}`;
  },

  async getCTFImage(projectPath: string, micrographId: string): Promise<string> {
    const params = new URLSearchParams({
      project: projectPath,
      mic_id: micrographId,
    });
    return `${API_BASE}/ctf-image?${params}`;
  },

  // Particle endpoints
  async getParticles(
    projectPath: string,
    micrographId: string,
    source?: string
  ): Promise<ParticleListResponse> {
    const params = new URLSearchParams({
      project: projectPath,
      mic_id: micrographId,
    });
    if (source) params.append('source', source);

    const response = await apiClient.get(`/particles?${params}`);
    return response.data;
  },

  async saveParticles(
    projectPath: string,
    micrographId: string,
    particles: Particle[],
    boxSize: number
  ): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/particles', {
      project: projectPath,
      mic_id: micrographId,
      particles,
      box_size: boxSize,
    });
    return response.data;
  },

  // Metrics endpoints
  async getMetricsData(
    projectPath: string,
    metric: string
  ): Promise<ChartData> {
    const params = new URLSearchParams({
      project: projectPath,
      metric,
    });
    const response = await apiClient.get(`/metrics?${params}`);
    return response.data;
  },

  async getCTFData(projectPath: string, micrographId: string): Promise<CTFData> {
    const params = new URLSearchParams({
      project: projectPath,
      mic_id: micrographId,
    });
    const response = await apiClient.get(`/ctf-data?${params}`);
    return response.data;
  },

  // AI Picker endpoints
  async runLogPicker(
    projectPath: string,
    micrographIds: string[],
    params: LogPickerParams
  ): Promise<{ jobId: string; status: string }> {
    const response = await apiClient.post('/run-picker', {
      project: projectPath,
      picker: 'log',
      micrograph_ids: micrographIds,
      params,
    });
    return response.data;
  },

  async runTopazPicker(
    projectPath: string,
    micrographIds: string[],
    params: TopazParams
  ): Promise<{ jobId: string; status: string }> {
    const response = await apiClient.post('/run-picker', {
      project: projectPath,
      picker: 'topaz',
      micrograph_ids: micrographIds,
      params,
    });
    return response.data;
  },

  async getPickerStatus(jobId: string): Promise<{
    status: 'running' | 'completed' | 'failed';
    progress: number;
    message?: string;
  }> {
    const response = await apiClient.get(`/picker-status/${jobId}`);
    return response.data;
  },

  // Export endpoints
  async exportToSTAR(
    projectPath: string,
    options: ExportOptions
  ): Promise<{ success: boolean; outputPath: string; jobAlias?: string }> {
    const response = await apiClient.post('/export', {
      project: projectPath,
      ...options,
    });
    return response.data;
  },

  async createManualPickJob(
    projectPath: string,
    jobAlias?: string
  ): Promise<{ success: boolean; jobPath: string; jobId: string }> {
    const response = await apiClient.post('/create-manualpick-job', {
      project: projectPath,
      job_alias: jobAlias,
    });
    return response.data;
  },
};

export default api;
