import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import SettingsIcon from '@mui/icons-material/Settings';
import { Project } from '../types';

interface TopBarProps {
  project: Project | null;
  selectedIndex: number;
  totalCount: number;
  historyIndex: number;
  historyLength: number;
  hasUnsavedChanges: boolean;
  onToggleLeftDrawer: () => void;
  onToggleRightDrawer: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  project,
  selectedIndex,
  totalCount,
  historyIndex,
  historyLength,
  hasUnsavedChanges,
  onToggleLeftDrawer,
  onToggleRightDrawer,
  onUndo,
  onRedo,
  onSave,
}) => {
  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar variant="dense">
        <IconButton
          color="inherit"
          onClick={onToggleLeftDrawer}
          edge="start"
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
          RELION Particle Picker
          {project && ` - ${project.name}`}
        </Typography>

        {/* Toolbar actions */}
        <IconButton color="inherit" onClick={onUndo} disabled={historyIndex <= 0}>
          <UndoIcon />
        </IconButton>
        <IconButton color="inherit" onClick={onRedo} disabled={historyIndex >= historyLength - 1}>
          <RedoIcon />
        </IconButton>
        <IconButton
          color={hasUnsavedChanges ? 'warning' : 'inherit'}
          onClick={onSave}
          disabled={!hasUnsavedChanges}
        >
          <SaveIcon />
        </IconButton>

        <Typography variant="body2" sx={{ ml: 2, mr: 2 }}>
          {selectedIndex + 1} / {totalCount}
        </Typography>

        <IconButton
          color="inherit"
          onClick={onToggleRightDrawer}
          edge="end"
        >
          <SettingsIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
