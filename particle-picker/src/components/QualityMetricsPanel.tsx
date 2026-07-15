import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  Stack,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceArea,
} from 'recharts';
import { Micrograph, FilterCriteria } from '../types';

interface QualityMetricsPanelProps {
  micrographs: Micrograph[];
  selectedMicrograph: Micrograph | null;
  onSelectMicrograph: (mic: Micrograph) => void;
  filterCriteria: FilterCriteria;
  onFilterChange: (criteria: FilterCriteria) => void;
}

interface MetricConfig {
  key: string;
  label: string;
  unit: string;
  getValue: (m: Micrograph) => number;
  filterMin?: keyof FilterCriteria;
  filterMax?: keyof FilterCriteria;
  color: string;
}

const METRICS: MetricConfig[] = [
  {
    key: 'defocus',
    label: 'Defocus',
    unit: 'Å',
    getValue: (m) => (m.metrics.defocusU + m.metrics.defocusV) / 2,
    filterMin: 'defocusMin',
    filterMax: 'defocusMax',
    color: '#4caf50',
  },
  {
    key: 'resolution',
    label: 'Max Resolution',
    unit: 'Å',
    getValue: (m) => m.metrics.maxResolution,
    filterMin: 'resolutionMin',
    filterMax: 'resolutionMax',
    color: '#2196f3',
  },
  {
    key: 'particleCount',
    label: 'Particle Count',
    unit: '',
    getValue: (m) => m.metrics.particleCount,
    filterMin: 'particleCountMin',
    filterMax: 'particleCountMax',
    color: '#ff9800',
  },
  {
    key: 'motion',
    label: 'Total Motion',
    unit: 'px',
    getValue: (m) => m.metrics.motionTotal,
    filterMax: 'motionMax',
    color: '#9c27b0',
  },
  {
    key: 'ctfFom',
    label: 'CTF FOM',
    unit: '',
    getValue: (m) => m.metrics.ctfFom,
    filterMin: 'ctfFomMin',
    color: '#00bcd4',
  },
];

export const QualityMetricsPanel: React.FC<QualityMetricsPanelProps> = ({
  micrographs,
  selectedMicrograph,
  onSelectMicrograph,
  filterCriteria,
  onFilterChange,
}) => {
  const theme = useTheme();

  // Prepare data for each metric
  const metricsData = useMemo(() => {
    return METRICS.map((metric) => {
      const data = micrographs.map((m, index) => ({
        index,
        value: metric.getValue(m),
        id: m.id,
        name: m.name,
        micrograph: m,
        isSelected: m.id === selectedMicrograph?.id,
      }));

      const values = data.map((d) => d.value);
      const min = Math.min(...values);
      const max = Math.max(...values);

      return {
        ...metric,
        data,
        min,
        max,
        range: max - min,
      };
    });
  }, [micrographs, selectedMicrograph]);

  const handleChartClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const point = data.activePayload[0].payload;
      if (point.micrograph) {
        onSelectMicrograph(point.micrograph);
      }
    }
  };

  const handleSliderChange = (
    filterMinKey: keyof FilterCriteria | undefined,
    filterMaxKey: keyof FilterCriteria | undefined,
    min: number,
    max: number
  ) => (event: Event, newValue: number | number[]) => {
    const [newMin, newMax] = newValue as number[];
    const newCriteria = { ...filterCriteria };

    if (filterMinKey) {
      newCriteria[filterMinKey] = newMin;
    }
    if (filterMaxKey) {
      newCriteria[filterMaxKey] = newMax;
    }

    onFilterChange(newCriteria);
  };

  const getSliderValue = (
    metric: typeof metricsData[0]
  ): [number, number] => {
    const minVal = metric.filterMin
      ? (filterCriteria[metric.filterMin] as number) ?? metric.min
      : metric.min;
    const maxVal = metric.filterMax
      ? (filterCriteria[metric.filterMax] as number) ?? metric.max
      : metric.max;
    return [minVal, maxVal];
  };

  // Don't render if no micrographs
  if (micrographs.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No micrographs loaded
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ overflow: 'auto', maxHeight: 'calc(50vh - 100px)' }}>
      {metricsData.map((metric) => (
        <Accordion key={metric.key} defaultExpanded={metric.key === 'defocus'}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2">
              {metric.label}
              {metric.unit && ` (${metric.unit})`}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 1 }}>
            {/* Scatter Chart */}
            <Box sx={{ width: '100%', height: 100, minWidth: 150, minHeight: 100 }}>
              <ResponsiveContainer width="100%" height={100} minWidth={150}>
                <ScatterChart
                  margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
                  onClick={handleChartClick}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                  <XAxis
                    type="number"
                    dataKey="index"
                    tick={false}
                    axisLine={{ stroke: theme.palette.text.disabled }}
                  />
                  <YAxis
                    type="number"
                    dataKey="value"
                    tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
                    axisLine={{ stroke: theme.palette.text.disabled }}
                    domain={['dataMin', 'dataMax']}
                    width={40}
                  />
                  <Tooltip
                    content={({ payload }) => {
                      if (payload && payload[0]) {
                        const data = payload[0].payload;
                        return (
                          <Box
                            sx={{
                              bgcolor: 'background.paper',
                              p: 1,
                              border: `1px solid ${theme.palette.divider}`,
                              borderRadius: 1,
                            }}
                          >
                            <Typography variant="caption" display="block">
                              {data.name}
                            </Typography>
                            <Typography variant="caption" color="primary">
                              {metric.label}: {data.value.toFixed(2)} {metric.unit}
                            </Typography>
                          </Box>
                        );
                      }
                      return null;
                    }}
                  />
                  {/* Highlight filter range */}
                  {(metric.filterMin || metric.filterMax) && (
                    <ReferenceArea
                      y1={
                        metric.filterMin
                          ? (filterCriteria[metric.filterMin] as number) ?? metric.min
                          : metric.min
                      }
                      y2={
                        metric.filterMax
                          ? (filterCriteria[metric.filterMax] as number) ?? metric.max
                          : metric.max
                      }
                      fill={metric.color}
                      fillOpacity={0.1}
                    />
                  )}
                  <Scatter data={metric.data} fill={metric.color}>
                    {metric.data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isSelected ? theme.palette.text.primary : metric.color}
                        stroke={entry.isSelected ? theme.palette.text.primary : undefined}
                        strokeWidth={entry.isSelected ? 2 : 0}
                        r={entry.isSelected ? 6 : 3}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </Box>

            {/* Range Slider */}
            {(metric.filterMin || metric.filterMax) && (
              <Stack sx={{ px: 1, mt: 1 }}>
                <Slider
                  value={getSliderValue(metric)}
                  onChange={handleSliderChange(
                    metric.filterMin,
                    metric.filterMax,
                    metric.min,
                    metric.max
                  )}
                  min={metric.min}
                  max={metric.max}
                  step={(metric.max - metric.min) / 100}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => v.toFixed(1)}
                  size="small"
                  sx={{
                    color: metric.color,
                    '& .MuiSlider-thumb': {
                      width: 12,
                      height: 12,
                    },
                  }}
                />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    {metric.min.toFixed(1)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {metric.max.toFixed(1)}
                  </Typography>
                </Stack>
              </Stack>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default QualityMetricsPanel;
