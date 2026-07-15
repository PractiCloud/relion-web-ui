import React, { useState, useCallback, useEffect } from 'react';
import { HashRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import SettingsIcon from '@mui/icons-material/Settings';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useThemeContext } from './context/ThemeContext';

import { MicrographViewer } from './components/MicrographViewer';
import { QualityMetricsPanel } from './components/QualityMetricsPanel';
import { MicrographList } from './components/MicrographList';
import { ControlPanel } from './components/ControlPanel';
import { ParticleEditor } from './components/ParticleEditor';
import { api } from './services/api';
import {
  Micrograph,
  Particle,
  ViewerSettings,
  EditMode,
  FilterCriteria,
  Project,
} from './types';

const LEFT_DRAWER_WIDTH = 280;
const RIGHT_DRAWER_WIDTH = 260;

function ParticlePickerApp() {
  const [searchParams] = useSearchParams();
  const { isDarkMode, toggleTheme } = useThemeContext();

  // Project state
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Micrograph state
  const [micrographs, setMicrographs] = useState<Micrograph[]>([]);
  const [filteredMicrographs, setFilteredMicrographs] = useState<Micrograph[]>([]);
  const [selectedMicrograph, setSelectedMicrograph] = useState<Micrograph | null>(null);
  const [selectedMicrographIndex, setSelectedMicrographIndex] = useState(0);

  // Particle state
  const [particles, setParticles] = useState<Particle[]>([]);
  const [boxSize, setBoxSize] = useState(200);
  const [particleHistory, setParticleHistory] = useState<Particle[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // UI state
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(true);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(true);
  const [editMode, setEditMode] = useState<EditMode>('view');
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Viewer settings
  const [viewerSettings, setViewerSettings] = useState<ViewerSettings>({
    viewMode: 'downscaled',
    showParticles: true,
    showMasks: false,
    showCTF: false,
    particleShape: 'circle',
    particleOpacity: 0.7,
    zoom: 1,
    panX: 0,
    panY: 0,
  });

  // Get project from URL params
  const projectPath = searchParams.get('project') || '';
  const ctfJob = searchParams.get('ctf') || '';
  const autopickJob = searchParams.get('autopick') || '';
  const manualpickJob = searchParams.get('manualpick') || '';

  // Load project data
  useEffect(() => {
    const loadProject = async () => {
      if (!projectPath) {
        setError('No project specified. Add ?project=<path> to URL.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await api.getMicrographs(projectPath, ctfJob, autopickJob, manualpickJob);
        setMicrographs(response.micrographs);
        setFilteredMicrographs(response.micrographs);
        setProject({
          name: projectPath.split('/').pop() || 'Unknown',
          path: projectPath,
          micrographCount: response.total,
          particleCount: 0,
          ctfJobId: response.ctfJob,
          autopickJobId: response.autopickJob,
        });

        if (response.micrographs.length > 0) {
          setSelectedMicrograph(response.micrographs[0]);
          setSelectedMicrographIndex(0);
        }
        setError(null);
      } catch (err) {
        setError(`Failed to load project: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectPath, ctfJob, autopickJob, manualpickJob]);

  // Load particles when micrograph changes
  useEffect(() => {
    const loadParticles = async () => {
      if (!selectedMicrograph || !projectPath) return;

      try {
        const response = await api.getParticles(projectPath, selectedMicrograph.id);
        setParticles(response.particles);
        setBoxSize(response.boxSize);
        // Reset history for new micrograph
        setParticleHistory([response.particles]);
        setHistoryIndex(0);
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error('Failed to load particles:', err);
        setParticles([]);
      }
    };

    loadParticles();
  }, [selectedMicrograph, projectPath]);

  // Apply filter criteria
  useEffect(() => {
    const filtered = micrographs.filter(mic => {
      const m = mic.metrics;
      if (filterCriteria.defocusMin && m.defocusU < filterCriteria.defocusMin) return false;
      if (filterCriteria.defocusMax && m.defocusU > filterCriteria.defocusMax) return false;
      if (filterCriteria.resolutionMin && m.maxResolution < filterCriteria.resolutionMin) return false;
      if (filterCriteria.resolutionMax && m.maxResolution > filterCriteria.resolutionMax) return false;
      if (filterCriteria.particleCountMin && m.particleCount < filterCriteria.particleCountMin) return false;
      if (filterCriteria.particleCountMax && m.particleCount > filterCriteria.particleCountMax) return false;
      if (filterCriteria.motionMax && m.motionTotal > filterCriteria.motionMax) return false;
      if (filterCriteria.ctfFomMin && m.ctfFom < filterCriteria.ctfFomMin) return false;
      return true;
    });
    setFilteredMicrographs(filtered);
  }, [micrographs, filterCriteria]);

  // Particle editing functions
  const pushToHistory = useCallback((newParticles: Particle[]) => {
    const newHistory = particleHistory.slice(0, historyIndex + 1);
    newHistory.push(newParticles);
    setParticleHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setHasUnsavedChanges(true);
  }, [particleHistory, historyIndex]);

  const handleAddParticle = useCallback((x: number, y: number) => {
    const newParticle: Particle = {
      id: `manual_${Date.now()}`,
      x,
      y,
      fom: 1.0,
      source: 'manual',
    };
    const newParticles = [...particles, newParticle];
    setParticles(newParticles);
    pushToHistory(newParticles);
  }, [particles, pushToHistory]);

  const handleRemoveParticle = useCallback((id: string) => {
    const newParticles = particles.filter(p => p.id !== id);
    setParticles(newParticles);
    pushToHistory(newParticles);
  }, [particles, pushToHistory]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setParticles(particleHistory[historyIndex - 1]);
    }
  }, [historyIndex, particleHistory]);

  const handleRedo = useCallback(() => {
    if (historyIndex < particleHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setParticles(particleHistory[historyIndex + 1]);
    }
  }, [historyIndex, particleHistory]);

  const handleSave = useCallback(async () => {
    if (!selectedMicrograph || !projectPath) return;

    try {
      await api.saveParticles(projectPath, selectedMicrograph.id, particles, boxSize);
      setHasUnsavedChanges(false);
    } catch (err) {
      setError(`Failed to save particles: ${err}`);
    }
  }, [selectedMicrograph, projectPath, particles, boxSize]);

  // Navigation
  const handleNextMicrograph = useCallback(() => {
    const newIndex = Math.min(selectedMicrographIndex + 1, filteredMicrographs.length - 1);
    setSelectedMicrographIndex(newIndex);
    setSelectedMicrograph(filteredMicrographs[newIndex]);
  }, [selectedMicrographIndex, filteredMicrographs]);

  const handlePrevMicrograph = useCallback(() => {
    const newIndex = Math.max(selectedMicrographIndex - 1, 0);
    setSelectedMicrographIndex(newIndex);
    setSelectedMicrograph(filteredMicrographs[newIndex]);
  }, [selectedMicrographIndex, filteredMicrographs]);

  const handleSelectMicrograph = useCallback((mic: Micrograph) => {
    const index = filteredMicrographs.findIndex(m => m.id === mic.id);
    setSelectedMicrographIndex(index >= 0 ? index : 0);
    setSelectedMicrograph(mic);
  }, [filteredMicrographs]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'n':
          handleNextMicrograph();
          break;
        case 'ArrowLeft':
        case 'p':
          handlePrevMicrograph();
          break;
        case 'a':
          setEditMode('add');
          break;
        case 'd':
          setEditMode('delete');
          break;
        case 'v':
          setEditMode('view');
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            if (e.shiftKey) handleRedo();
            else handleUndo();
          }
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleSave();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextMicrograph, handlePrevMicrograph, handleUndo, handleRedo, handleSave]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading project...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* App Bar */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar variant="dense">
          <IconButton
            color="inherit"
            onClick={() => setLeftDrawerOpen(!leftDrawerOpen)}
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
          <IconButton color="inherit" onClick={handleUndo} disabled={historyIndex <= 0}>
            <UndoIcon />
          </IconButton>
          <IconButton color="inherit" onClick={handleRedo} disabled={historyIndex >= particleHistory.length - 1}>
            <RedoIcon />
          </IconButton>
          <IconButton
            color={hasUnsavedChanges ? 'warning' : 'inherit'}
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
          >
            <SaveIcon />
          </IconButton>

          <Typography variant="body2" sx={{ ml: 2, mr: 2 }}>
            {selectedMicrographIndex + 1} / {filteredMicrographs.length}
          </Typography>

          <Tooltip title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
            <IconButton color="inherit" onClick={toggleTheme}>
              {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          <IconButton
            color="inherit"
            onClick={() => setRightDrawerOpen(!rightDrawerOpen)}
            edge="end"
          >
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Left Drawer - Quality Metrics */}
      <Drawer
        variant="persistent"
        anchor="left"
        open={leftDrawerOpen}
        sx={{
          width: LEFT_DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: LEFT_DRAWER_WIDTH,
            boxSizing: 'border-box',
            top: 48,
            height: 'calc(100% - 48px)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>Quality Metrics</Typography>
          <IconButton onClick={() => setLeftDrawerOpen(false)}>
            <ChevronLeftIcon />
          </IconButton>
        </Box>
        <Divider />
        <QualityMetricsPanel
          micrographs={micrographs}
          selectedMicrograph={selectedMicrograph}
          onSelectMicrograph={handleSelectMicrograph}
          filterCriteria={filterCriteria}
          onFilterChange={setFilterCriteria}
        />
        <Divider />
        <MicrographList
          micrographs={filteredMicrographs}
          selectedMicrograph={selectedMicrograph}
          onSelectMicrograph={handleSelectMicrograph}
        />
      </Drawer>

      {/* Main Content - Micrograph Viewer */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: '48px',
          ml: leftDrawerOpen ? `${LEFT_DRAWER_WIDTH}px` : 0,
          mr: rightDrawerOpen ? `${RIGHT_DRAWER_WIDTH}px` : 0,
          transition: 'margin 0.2s',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {error && (
          <Alert severity="error" sx={{ m: 1 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {selectedMicrograph ? (
          <MicrographViewer
            micrograph={selectedMicrograph}
            particles={particles}
            boxSize={boxSize}
            projectPath={projectPath}
            settings={viewerSettings}
            editMode={editMode}
            onAddParticle={handleAddParticle}
            onRemoveParticle={handleRemoveParticle}
            onSettingsChange={setViewerSettings}
            prevMicrographId={filteredMicrographs[selectedMicrographIndex - 1]?.id}
            nextMicrographId={filteredMicrographs[selectedMicrographIndex + 1]?.id}
          />
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography color="text.secondary">
              {micrographs.length === 0 ? 'No micrographs found' : 'Select a micrograph'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Right Drawer - Controls & Editor */}
      <Drawer
        variant="persistent"
        anchor="right"
        open={rightDrawerOpen}
        sx={{
          width: RIGHT_DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: RIGHT_DRAWER_WIDTH,
            boxSizing: 'border-box',
            top: 48,
            height: 'calc(100% - 48px)',
            overflow: 'auto',
          },
        }}
      >
        {/* Single scrollable container with both sections */}
        <ParticleEditor
          particles={particles}
          boxSize={boxSize}
          projectPath={projectPath}
          micrographId={selectedMicrograph?.id || ''}
          onParticlesChange={(newParticles) => {
            setParticles(newParticles);
            pushToHistory(newParticles);
          }}
        />
        <Divider />
        <ControlPanel
          settings={viewerSettings}
          onSettingsChange={setViewerSettings}
          editMode={editMode}
          onEditModeChange={setEditMode}
          boxSize={boxSize}
          onBoxSizeChange={setBoxSize}
        />
      </Drawer>
    </Box>
  );
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ParticlePickerApp />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
