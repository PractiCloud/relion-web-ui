import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Divider,
  TextField,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  LinearProgress,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Snackbar,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Particle, LogPickerParams, ExportOptions } from '../types';
import { api } from '../services/api';

interface ParticleEditorProps {
  particles: Particle[];
  boxSize: number;
  projectPath: string;
  micrographId: string;
  onParticlesChange: (particles: Particle[]) => void;
}

export const ParticleEditor: React.FC<ParticleEditorProps> = ({
  particles,
  boxSize,
  projectPath,
  micrographId,
  onParticlesChange,
}) => {
  // LoG Picker state
  const [logParams, setLogParams] = useState<LogPickerParams>({
    boxSize: 200,
    minDiameter: 100,
    maxDiameter: 300,
    threshold: 0.5,
    minLoGDiameter: 100,
    maxLoGDiameter: 300,
    adjustStddev: 1.0,
    upperThreshold: 0.8,
  });
  const [pickerRunning, setPickerRunning] = useState(false);
  const [pickerProgress, setPickerProgress] = useState(0);
  const [pickerError, setPickerError] = useState<string | null>(null);

  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'star',
    includeRejected: false,
    createManualPickJob: true,
    jobAlias: '',
  });
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  // Ref for polling interval to enable cleanup
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingStartTimeRef = useRef<number | null>(null);
  const MAX_POLLING_DURATION_MS = 30 * 60 * 1000; // 30 minutes timeout

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // Particle statistics
  const manualCount = particles.filter((p) => p.source === 'manual').length;
  const autopickCount = particles.filter((p) => p.source === 'autopick').length;
  const aiCount = particles.filter((p) => p.source === 'ai').length;

  const handleRunLogPicker = async () => {
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    setPickerRunning(true);
    setPickerProgress(0);
    setPickerError(null);
    pollingStartTimeRef.current = Date.now();

    try {
      const result = await api.runLogPicker(projectPath, [micrographId], logParams);

      // Poll for status with timeout and error handling
      pollingIntervalRef.current = setInterval(async () => {
        // Check for timeout
        if (pollingStartTimeRef.current &&
            Date.now() - pollingStartTimeRef.current > MAX_POLLING_DURATION_MS) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setPickerRunning(false);
          setPickerError('Picker timed out after 30 minutes');
          return;
        }

        try {
          const status = await api.getPickerStatus(result.jobId);
          setPickerProgress(status.progress);

          if (status.status === 'completed') {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setPickerRunning(false);

            // Reload particles
            const response = await api.getParticles(projectPath, micrographId);
            onParticlesChange(response.particles);
          } else if (status.status === 'failed') {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setPickerRunning(false);
            setPickerError(status.message || 'Picker failed');
          }
        } catch (pollErr) {
          // Network error during polling - don't stop immediately, just log
          console.warn('Polling error:', pollErr);
        }
      }, 1000);
    } catch (err) {
      setPickerRunning(false);
      setPickerError(`Failed to start picker: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSaveParticles = async () => {
    if (!micrographId) {
      setSaveMessage('No micrograph selected');
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const result = await api.saveParticles(projectPath, micrographId, particles, boxSize);
      setSaveMessage(result.message || `Saved ${particles.length} particles`);
    } catch (err) {
      setSaveMessage(`Save failed: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClearManual = () => {
    const filtered = particles.filter((p) => p.source !== 'manual');
    onParticlesChange(filtered);
  };

  const handleClearAll = () => {
    onParticlesChange([]);
  };

  const handleAcceptAI = () => {
    // Convert AI suggestions to confirmed picks
    const updated = particles.map((p) =>
      p.source === 'ai' ? { ...p, source: 'manual' as const } : p
    );
    onParticlesChange(updated);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      if (exportOptions.createManualPickJob) {
        const result = await api.createManualPickJob(projectPath, exportOptions.jobAlias);
        setSnackbar({ open: true, message: `ManualPick job created: ${result.jobPath}`, severity: 'success' });
      } else {
        const result = await api.exportToSTAR(projectPath, exportOptions);
        setSnackbar({ open: true, message: `Exported to: ${result.outputPath}`, severity: 'success' });
      }
      setExportDialogOpen(false);
    } catch (err) {
      setSnackbar({ open: true, message: `Export failed: ${err}`, severity: 'error' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box sx={{ p: 2, overflow: 'auto' }}>
      <Typography variant="subtitle2" gutterBottom>
        Particle Editor
      </Typography>

      {/* Statistics */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
        <Chip
          label={`Total: ${particles.length}`}
          size="small"
          color="primary"
        />
        <Chip
          label={`Manual: ${manualCount}`}
          size="small"
          sx={{ bgcolor: 'success.main', color: 'white' }}
        />
        <Chip
          label={`AutoPick: ${autopickCount}`}
          size="small"
          sx={{ bgcolor: 'warning.main', color: 'white' }}
        />
        {aiCount > 0 && (
          <Chip
            label={`AI: ${aiCount}`}
            size="small"
            sx={{ bgcolor: 'info.main', color: 'white' }}
          />
        )}
      </Stack>

      {/* Save Button */}
      <Button
        variant="contained"
        color="success"
        fullWidth
        startIcon={<SaveIcon />}
        onClick={handleSaveParticles}
        disabled={saving || particles.length === 0 || !micrographId}
        sx={{ mb: 2 }}
      >
        {saving ? 'Saving...' : `Save Particles (${particles.length})`}
      </Button>

      {saveMessage && (
        <Alert
          severity={saveMessage.includes('failed') ? 'error' : 'success'}
          sx={{ mb: 2 }}
          onClose={() => setSaveMessage(null)}
        >
          {saveMessage}
        </Alert>
      )}

      {/* Quick Actions */}
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DeleteSweepIcon />}
          onClick={handleClearManual}
          disabled={manualCount === 0}
        >
          Clear Manual ({manualCount})
        </Button>
        <Button
          variant="outlined"
          size="small"
          color="error"
          startIcon={<DeleteSweepIcon />}
          onClick={handleClearAll}
          disabled={particles.length === 0}
        >
          Clear All
        </Button>
        {aiCount > 0 && (
          <Button
            variant="contained"
            size="small"
            color="success"
            startIcon={<AutoFixHighIcon />}
            onClick={handleAcceptAI}
          >
            Accept AI Suggestions ({aiCount})
          </Button>
        )}
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* LoG Picker */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2">LoG Picker (AI)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {pickerError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPickerError(null)}>
              {pickerError}
            </Alert>
          )}

          <Stack spacing={2}>
            <Box>
              <Typography variant="caption">
                Min Diameter (Å): {logParams.minLoGDiameter}
              </Typography>
              <Slider
                value={logParams.minLoGDiameter}
                onChange={(e, v) =>
                  setLogParams({ ...logParams, minLoGDiameter: v as number })
                }
                min={50}
                max={500}
                size="small"
              />
            </Box>

            <Box>
              <Typography variant="caption">
                Max Diameter (Å): {logParams.maxLoGDiameter}
              </Typography>
              <Slider
                value={logParams.maxLoGDiameter}
                onChange={(e, v) =>
                  setLogParams({ ...logParams, maxLoGDiameter: v as number })
                }
                min={50}
                max={500}
                size="small"
              />
            </Box>

            <Box>
              <Typography variant="caption">
                Threshold: {logParams.threshold.toFixed(2)}
              </Typography>
              <Slider
                value={logParams.threshold}
                onChange={(e, v) =>
                  setLogParams({ ...logParams, threshold: v as number })
                }
                min={0}
                max={1}
                step={0.05}
                size="small"
              />
            </Box>

            <Box>
              <Typography variant="caption">
                Upper Threshold: {logParams.upperThreshold.toFixed(2)}
              </Typography>
              <Slider
                value={logParams.upperThreshold}
                onChange={(e, v) =>
                  setLogParams({ ...logParams, upperThreshold: v as number })
                }
                min={0}
                max={1}
                step={0.05}
                size="small"
              />
            </Box>

            {pickerRunning && (
              <Box>
                <LinearProgress variant="determinate" value={pickerProgress} />
                <Typography variant="caption" color="text.secondary">
                  Running... {Math.round(pickerProgress)}%
                </Typography>
              </Box>
            )}

            <Button
              variant="contained"
              size="small"
              startIcon={<PlayArrowIcon />}
              onClick={handleRunLogPicker}
              disabled={pickerRunning || !micrographId}
            >
              {pickerRunning ? 'Running...' : 'Run LoG Picker'}
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Topaz Picker (placeholder) */}
      <Accordion disabled>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2">Topaz Picker (Coming Soon)</Typography>
        </AccordionSummary>
      </Accordion>

      <Divider sx={{ my: 2 }} />

      {/* Export */}
      <Typography variant="subtitle2" gutterBottom>
        Export
      </Typography>
      <Button
        variant="contained"
        fullWidth
        startIcon={<FileDownloadIcon />}
        onClick={() => setExportDialogOpen(true)}
        disabled={particles.length === 0}
      >
        Export to RELION
      </Button>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>Export Particles</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, minWidth: 300 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOptions.createManualPickJob}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      createManualPickJob: e.target.checked,
                    })
                  }
                />
              }
              label="Create ManualPick job in pipeline"
            />

            {exportOptions.createManualPickJob && (
              <TextField
                label="Job Alias (optional)"
                value={exportOptions.jobAlias}
                onChange={(e) =>
                  setExportOptions({ ...exportOptions, jobAlias: e.target.value })
                }
                size="small"
                placeholder="e.g., manual_picks_1"
              />
            )}

            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOptions.includeRejected}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      includeRejected: e.target.checked,
                    })
                  }
                />
              }
              label="Include rejected particles"
            />

            <Typography variant="body2" color="text.secondary">
              This will export {particles.length} particles to a STAR file
              compatible with RELION's Extract job.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleExport}
            disabled={exporting}
            startIcon={<SaveIcon />}
          >
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ParticleEditor;
