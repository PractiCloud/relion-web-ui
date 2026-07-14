import React from 'react';
import {
  Typography,
  Button,
  TextField,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { ExportOptions } from '../types';

interface ExportDialogProps {
  open: boolean;
  exportOptions: ExportOptions;
  exporting: boolean;
  particleCount: number;
  onClose: () => void;
  onExport: () => void;
  onOptionsChange: (options: ExportOptions) => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  exportOptions,
  exporting,
  particleCount,
  onClose,
  onExport,
  onOptionsChange,
}) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Export Particles</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1, minWidth: 300 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={exportOptions.createManualPickJob}
                onChange={(e) =>
                  onOptionsChange({
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
                onOptionsChange({ ...exportOptions, jobAlias: e.target.value })
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
                  onOptionsChange({
                    ...exportOptions,
                    includeRejected: e.target.checked,
                  })
                }
              />
            }
            label="Include rejected particles"
          />

          <Typography variant="body2" color="text.secondary">
            This will export {particleCount} particles to a STAR file
            compatible with RELION's Extract job.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={onExport}
          disabled={exporting}
          startIcon={<SaveIcon />}
        >
          {exporting ? 'Exporting...' : 'Export'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportDialog;
