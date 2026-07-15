import React from 'react';
import { Box, Button, Stack, Alert } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { Particle } from '../types';

interface ParticleActionsProps {
  particles: Particle[];
  saving: boolean;
  saveMessage: string | null;
  micrographId: string;
  onSave: () => void;
  onClearManual: () => void;
  onClearAll: () => void;
  onAcceptAI: () => void;
  onClearSaveMessage: () => void;
}

export const ParticleActions: React.FC<ParticleActionsProps> = ({
  particles,
  saving,
  saveMessage,
  micrographId,
  onSave,
  onClearManual,
  onClearAll,
  onAcceptAI,
  onClearSaveMessage,
}) => {
  const manualCount = particles.filter((p) => p.source === 'manual').length;
  const aiCount = particles.filter((p) => p.source === 'ai').length;

  return (
    <Box>
      {/* Save Button */}
      <Button
        variant="contained"
        color="success"
        fullWidth
        startIcon={<SaveIcon />}
        onClick={onSave}
        disabled={saving || particles.length === 0 || !micrographId}
        sx={{ mb: 2 }}
      >
        {saving ? 'Saving...' : `Save Particles (${particles.length})`}
      </Button>

      {saveMessage && (
        <Alert
          severity={saveMessage.includes('failed') ? 'error' : 'success'}
          sx={{ mb: 2 }}
          onClose={onClearSaveMessage}
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
          onClick={onClearManual}
          disabled={manualCount === 0}
        >
          Clear Manual ({manualCount})
        </Button>
        <Button
          variant="outlined"
          size="small"
          color="error"
          startIcon={<DeleteSweepIcon />}
          onClick={onClearAll}
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
            onClick={onAcceptAI}
          >
            Accept AI Suggestions ({aiCount})
          </Button>
        )}
      </Stack>
    </Box>
  );
};

export default ParticleActions;
