import React, { useRef, useEffect } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Chip,
  Stack,
  TextField,
  InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { Micrograph } from '../types';

interface MicrographListProps {
  micrographs: Micrograph[];
  selectedMicrograph: Micrograph | null;
  onSelectMicrograph: (mic: Micrograph) => void;
}

export const MicrographList: React.FC<MicrographListProps> = ({
  micrographs,
  selectedMicrograph,
  onSelectMicrograph,
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Filter micrographs by search term
  const filteredMicrographs = React.useMemo(() => {
    if (!searchTerm) return micrographs;
    const term = searchTerm.toLowerCase();
    return micrographs.filter((m) =>
      m.name.toLowerCase().includes(term)
    );
  }, [micrographs, searchTerm]);

  // Scroll to selected item
  useEffect(() => {
    if (selectedRef.current && listRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedMicrograph]);

  const getQualityColor = (mic: Micrograph): string => {
    // Color based on CTF FOM
    const fom = mic.metrics.ctfFom;
    if (fom > 0.8) return '#4caf50';
    if (fom > 0.5) return '#ff9800';
    return '#f44336';
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <Box sx={{ p: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search micrographs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Count */}
      <Box sx={{ px: 1, py: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {filteredMicrographs.length} of {micrographs.length} micrographs
        </Typography>
      </Box>

      {/* List */}
      <List
        ref={listRef}
        dense
        sx={{
          overflow: 'auto',
          flex: 1,
          '& .MuiListItemButton-root': {
            py: 0.5,
          },
        }}
      >
        {filteredMicrographs.map((mic) => {
          const isSelected = mic.id === selectedMicrograph?.id;
          return (
            <ListItemButton
              key={mic.id}
              selected={isSelected}
              onClick={() => onSelectMicrograph(mic)}
              ref={isSelected ? selectedRef : undefined}
              sx={{
                borderLeft: `3px solid ${getQualityColor(mic)}`,
              }}
            >
              <ListItemText
                primary={
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{
                      fontWeight: isSelected ? 600 : 400,
                      maxWidth: 180,
                    }}
                  >
                    {mic.name}
                  </Typography>
                }
                secondary={
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                    <Chip
                      label={`${mic.metrics.particleCount}`}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: 10,
                        bgcolor: 'primary.dark',
                        color: 'white',
                      }}
                    />
                    <Chip
                      label={`${(mic.metrics.maxResolution).toFixed(1)}Å`}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: 10,
                        bgcolor: 'success.dark',
                        color: 'white',
                      }}
                    />
                  </Stack>
                }
              />
            </ListItemButton>
          );
        })}

        {filteredMicrographs.length === 0 && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No micrographs found
            </Typography>
          </Box>
        )}
      </List>
    </Box>
  );
};

export default MicrographList;
