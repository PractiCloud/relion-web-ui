import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  FormControlLabel,
  FormLabel,
  RadioGroup,
  Radio,
  Switch,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import { ViewerSettings, EditMode, ViewMode } from '../types';

interface ControlPanelProps {
  settings: ViewerSettings;
  onSettingsChange: (settings: ViewerSettings) => void;
  editMode: EditMode;
  onEditModeChange: (mode: EditMode) => void;
  boxSize: number;
  onBoxSizeChange: (size: number) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  settings,
  onSettingsChange,
  editMode,
  onEditModeChange,
  boxSize,
  onBoxSizeChange,
}) => {
  const handleSettingChange = <K extends keyof ViewerSettings>(
    key: K,
    value: ViewerSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Box sx={{ overflow: 'auto' }}>
      {/* Edit Mode - Always visible */}
      <Box sx={{ p: 1.5, pb: 0 }}>
        <Typography variant="subtitle2" gutterBottom>
          Edit Mode
        </Typography>
        <ToggleButtonGroup
          value={editMode}
          exclusive
          onChange={(e, value) => value && onEditModeChange(value)}
          size="small"
          fullWidth
        >
          <Tooltip title="View/Pan (V)">
            <ToggleButton value="view">
              <VisibilityIcon fontSize="small" />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Add Particles (A)">
            <ToggleButton value="add" color="success">
              <AddCircleIcon fontSize="small" />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Delete Particles (D)">
            <ToggleButton value="delete" color="error">
              <RemoveCircleIcon fontSize="small" />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Select Particles">
            <ToggleButton value="select" color="info">
              <SelectAllIcon fontSize="small" />
            </ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>
      </Box>

      {/* Collapsible Settings */}
      <Accordion defaultExpanded={false} disableGutters sx={{ '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
          <Typography variant="body2">Display Settings</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, pb: 1 }}>
          {/* View Mode */}
          <FormControl component="fieldset" size="small" sx={{ mb: 1 }}>
            <FormLabel component="legend">
              <Typography variant="caption">View Mode</Typography>
            </FormLabel>
            <RadioGroup
              value={settings.viewMode}
              onChange={(e) => handleSettingChange('viewMode', e.target.value as ViewMode)}
              row
            >
              <FormControlLabel
                value="downscaled"
                control={<Radio size="small" />}
                label={<Typography variant="caption">Down</Typography>}
              />
              <FormControlLabel
                value="denoised"
                control={<Radio size="small" />}
                label={<Typography variant="caption">Denoise</Typography>}
              />
              <FormControlLabel
                value="preprocessed"
                control={<Radio size="small" />}
                label={<Typography variant="caption">Preproc</Typography>}
              />
            </RadioGroup>
          </FormControl>

          {/* Display Options */}
          <Stack spacing={0}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={settings.showParticles}
                  onChange={(e) => handleSettingChange('showParticles', e.target.checked)}
                />
              }
              label={<Typography variant="caption">Show Particles</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={settings.showCTF}
                  onChange={(e) => handleSettingChange('showCTF', e.target.checked)}
                />
              }
              label={<Typography variant="caption">Show CTF</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={settings.showMasks}
                  onChange={(e) => handleSettingChange('showMasks', e.target.checked)}
                />
              }
              label={<Typography variant="caption">Show Masks</Typography>}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded={false} disableGutters sx={{ '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
          <Typography variant="body2">Particle Settings</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, pb: 1 }}>
          {/* Particle Shape */}
          <Typography variant="caption" display="block" gutterBottom>
            Shape
          </Typography>
          <ToggleButtonGroup
            value={settings.particleShape}
            exclusive
            onChange={(e, value) => value && handleSettingChange('particleShape', value)}
            size="small"
            sx={{ mb: 1 }}
          >
            <ToggleButton value="circle">
              <CircleOutlinedIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="square">
              <CropSquareIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Box Size */}
          <Typography variant="caption" display="block">
            Box Size: {boxSize} px
          </Typography>
          <Slider
            value={boxSize}
            onChange={(e, value) => onBoxSizeChange(value as number)}
            min={50}
            max={500}
            step={10}
            size="small"
            sx={{ mb: 1 }}
          />

          {/* Particle Opacity */}
          <Typography variant="caption" display="block">
            Opacity: {Math.round(settings.particleOpacity * 100)}%
          </Typography>
          <Slider
            value={settings.particleOpacity}
            onChange={(e, value) => handleSettingChange('particleOpacity', value as number)}
            min={0.1}
            max={1}
            step={0.1}
            size="small"
          />
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded={false} disableGutters sx={{ '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
          <Typography variant="body2">Keyboard Shortcuts</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, pb: 1 }}>
          <Box sx={{ fontSize: 10, color: 'text.secondary' }}>
            <Box>← / → : Navigate</Box>
            <Box>V/A/D : View/Add/Delete</Box>
            <Box>Ctrl+Z/Shift+Z : Undo/Redo</Box>
            <Box>Ctrl+S : Save</Box>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default ControlPanel;
