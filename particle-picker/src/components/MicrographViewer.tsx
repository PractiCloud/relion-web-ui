import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Rect, Group } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { Box, Typography, Chip, Stack } from '@mui/material';
import { Micrograph, Particle, ViewerSettings, EditMode, getFOMColor } from '../types';
import { api } from '../services/api';

// API mode type for micrograph image requests
type ApiImageMode = 'raw' | 'denoised' | 'preprocessed';

interface MicrographViewerProps {
  micrograph: Micrograph;
  particles: Particle[];
  boxSize: number;
  projectPath: string;
  settings: ViewerSettings;
  editMode: EditMode;
  onAddParticle: (x: number, y: number) => void;
  onRemoveParticle: (id: string) => void;
  onSettingsChange: (settings: ViewerSettings) => void;
  // IDs of the adjacent micrographs in the current filtered list, used to
  // warm the browser image cache so arrow-key navigation feels instant.
  prevMicrographId?: string;
  nextMicrographId?: string;
}

export const MicrographViewer: React.FC<MicrographViewerProps> = ({
  micrograph,
  particles,
  boxSize,
  projectPath,
  settings,
  editMode,
  onAddParticle,
  onRemoveParticle,
  onSettingsChange,
  prevMicrographId,
  nextMicrographId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [ctfImage, setCtfImage] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });

  // Load micrograph image.
  //
  // Notes:
  //  - We deliberately do NOT clear `image` state on transition. Konva keeps
  //    rendering the previously loaded image until the new one's onload fires,
  //    so the canvas never goes blank during a switch.
  //  - `loading=true` only surfaces the small "Loading micrograph..." badge;
  //    the previous image stays visible behind it.
  //  - After a successful load, we prefetch the previous and next micrograph
  //    URLs so arrow-key navigation hits the browser HTTP cache (the backend
  //    sets Cache-Control: max-age=3600 + ETag).
  useEffect(() => {
    let cancelled = false;
    const loadImage = async () => {
      setLoading(true);
      const imageUrl = await api.getMicrographImage(projectPath, micrograph.id, {
        mode: (settings.viewMode === 'downscaled' ? 'raw' : settings.viewMode) as ApiImageMode,
        scale: 1.0,
      });

      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        setImage(img);
        setLoading(false);

        // Fit image to container - fill available space
        if (containerRef.current && containerSize.width > 0 && containerSize.height > 0) {
          const scaleX = containerSize.width / img.width;
          const scaleY = containerSize.height / img.height;
          // Use min to maintain aspect ratio, but allow scaling up to fill space
          const scale = Math.min(scaleX, scaleY);
          setStageScale(scale);
          setStagePosition({
            x: (containerSize.width - img.width * scale) / 2,
            y: (containerSize.height - img.height * scale) / 2,
          });
        }

        // Warm the browser cache for adjacent micrographs in the background.
        // The `new Image()` objects are discarded; what we want is the cached
        // HTTP response. If the user is offline or these fail, we don't care.
        const prefetchOpts = {
          mode: (settings.viewMode === 'downscaled' ? 'raw' : settings.viewMode) as ApiImageMode,
          scale: 1.0,
        };
        const prefetch = async (id?: string) => {
          if (!id) return;
          const url = await api.getMicrographImage(projectPath, id, prefetchOpts);
          const pre = new window.Image();
          pre.crossOrigin = 'anonymous';
          pre.src = url;
        };
        prefetch(nextMicrographId);
        prefetch(prevMicrographId);
      };
      img.onerror = () => {
        if (cancelled) return;
        console.error('Failed to load micrograph image');
        setLoading(false);
      };
      img.src = imageUrl;
    };

    loadImage();
    return () => { cancelled = true; };
  }, [micrograph.id, projectPath, settings.viewMode, containerSize, prevMicrographId, nextMicrographId]);

  // Load CTF image if needed
  useEffect(() => {
    if (!settings.showCTF) {
      setCtfImage(null);
      return;
    }

    const loadCTF = async () => {
      const ctfUrl = await api.getCTFImage(projectPath, micrograph.id);
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setCtfImage(img);
      img.src = ctfUrl;
    };

    loadCTF();
  }, [micrograph.id, projectPath, settings.showCTF]);

  // Handle container resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldScale = stageScale;
    const scaleBy = 1.1;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.1, Math.min(5, newScale));

    const mousePointTo = {
      x: (pointer.x - stagePosition.x) / oldScale,
      y: (pointer.y - stagePosition.y) / oldScale,
    };

    setStageScale(clampedScale);
    setStagePosition({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });

    onSettingsChange({ ...settings, zoom: clampedScale });
  }, [stageScale, stagePosition, settings, onSettingsChange]);

  // Handle stage click for adding/removing particles
  const handleStageClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (editMode === 'view') return;

    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Convert screen coordinates to image coordinates
    const x = (pointer.x - stagePosition.x) / stageScale;
    const y = (pointer.y - stagePosition.y) / stageScale;

    if (editMode === 'add') {
      // Check if click is within image bounds
      if (image && x >= 0 && x < image.width && y >= 0 && y < image.height) {
        onAddParticle(x, y);
      }
    }
  }, [editMode, stageScale, stagePosition, image, onAddParticle]);

  // Handle particle click
  const handleParticleClick = useCallback((e: KonvaEventObject<MouseEvent | TouchEvent>, particle: Particle) => {
    e.cancelBubble = true; // Prevent stage click

    if (editMode === 'delete') {
      onRemoveParticle(particle.id);
    }
  }, [editMode, onRemoveParticle]);

  // Get cursor based on edit mode
  const getCursor = () => {
    switch (editMode) {
      case 'add':
        return 'crosshair';
      case 'delete':
        return 'pointer';
      case 'select':
        return 'cell';
      default:
        return 'grab';
    }
  };

  const particleRadius = boxSize / 2;

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'common.black' : 'grey.100',
        cursor: getCursor(),
        overflow: 'hidden',
      }}
    >
      {/* Info bar */}
      <Stack
        direction="row"
        spacing={1}
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 10,
        }}
      >
        <Chip
          label={micrograph.name}
          size="small"
          sx={{ bgcolor: 'rgba(0,0,0,0.7)', color: 'white' }}
        />
        <Chip
          label={`${particles.length} particles`}
          size="small"
          color="primary"
          sx={{ bgcolor: 'rgba(25,118,210,0.8)' }}
        />
        <Chip
          label={`${Math.round(stageScale * 100)}%`}
          size="small"
          sx={{ bgcolor: 'rgba(0,0,0,0.7)', color: 'white' }}
        />
      </Stack>

      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <Typography color="text.primary">Loading micrograph...</Typography>
        </Box>
      )}

      {/* Only render Stage when container has valid dimensions */}
      {containerSize.width > 0 && containerSize.height > 0 && (
      <Stage
        width={containerSize.width}
        height={containerSize.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePosition.x}
        y={stagePosition.y}
        draggable={editMode === 'view'}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onDragEnd={(e) => {
          setStagePosition({
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
      >
        {/* Micrograph Layer */}
        <Layer>
          {image && (
            <KonvaImage
              image={image}
              width={image.width}
              height={image.height}
            />
          )}
        </Layer>

        {/* CTF Overlay Layer */}
        {settings.showCTF && ctfImage && (
          <Layer opacity={0.5}>
            <KonvaImage
              image={ctfImage}
              width={200}
              height={200}
              x={10}
              y={image ? image.height - 210 : 10}
            />
          </Layer>
        )}

        {/* Particles Layer */}
        {settings.showParticles && (
          <Layer>
            {particles.map((particle) => {
              const color = getFOMColor(particle.fom);
              const isManual = particle.source === 'manual';

              return (
                <Group
                  key={particle.id}
                  x={particle.x}
                  y={particle.y}
                  onClick={(e) => handleParticleClick(e, particle)}
                  onTap={(e) => handleParticleClick(e, particle)}
                >
                  {settings.particleShape === 'circle' ? (
                    <Circle
                      radius={particleRadius}
                      stroke={color}
                      strokeWidth={2 / stageScale}
                      opacity={settings.particleOpacity}
                      fill={isManual ? `${color}20` : undefined}
                    />
                  ) : (
                    <Rect
                      width={boxSize}
                      height={boxSize}
                      offsetX={particleRadius}
                      offsetY={particleRadius}
                      stroke={color}
                      strokeWidth={2 / stageScale}
                      opacity={settings.particleOpacity}
                      fill={isManual ? `${color}20` : undefined}
                    />
                  )}
                </Group>
              );
            })}
          </Layer>
        )}
      </Stage>
      )}

      {/* Edit mode indicator */}
      {editMode !== 'view' && (
        <Chip
          label={`Mode: ${editMode.toUpperCase()}`}
          color={editMode === 'add' ? 'success' : editMode === 'delete' ? 'error' : 'info'}
          sx={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        />
      )}
    </Box>
  );
};

export default MicrographViewer;
