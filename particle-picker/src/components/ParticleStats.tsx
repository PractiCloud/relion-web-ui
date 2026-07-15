import React from 'react';
import { Stack, Chip } from '@mui/material';
import { Particle } from '../types';

interface ParticleStatsProps {
  particles: Particle[];
}

export const ParticleStats: React.FC<ParticleStatsProps> = ({ particles }) => {
  const manualCount = particles.filter((p) => p.source === 'manual').length;
  const autopickCount = particles.filter((p) => p.source === 'autopick').length;
  const aiCount = particles.filter((p) => p.source === 'ai').length;

  return (
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
  );
};

export default ParticleStats;
