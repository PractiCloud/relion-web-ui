import React from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  LinearProgress,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { LogPickerParams } from '../types';

interface LogPickerSectionProps {
  logParams: LogPickerParams;
  pickerRunning: boolean;
  pickerProgress: number;
  pickerError: string | null;
  micrographId: string;
  onParamsChange: (params: LogPickerParams) => void;
  onRunPicker: () => void;
  onClearError: () => void;
}

export const LogPickerSection: React.FC<LogPickerSectionProps> = ({
  logParams,
  pickerRunning,
  pickerProgress,
  pickerError,
  micrographId,
  onParamsChange,
  onRunPicker,
  onClearError,
}) => {
  return (
    <>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2">LoG Picker (AI)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {pickerError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={onClearError}>
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
                onChange={(_, v) =>
                  onParamsChange({ ...logParams, minLoGDiameter: v as number })
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
                onChange={(_, v) =>
                  onParamsChange({ ...logParams, maxLoGDiameter: v as number })
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
                onChange={(_, v) =>
                  onParamsChange({ ...logParams, threshold: v as number })
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
                onChange={(_, v) =>
                  onParamsChange({ ...logParams, upperThreshold: v as number })
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
              onClick={onRunPicker}
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
    </>
  );
};

export default LogPickerSection;
