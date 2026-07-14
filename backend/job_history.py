"""
Job History Tracker -- Learns from past RELION job outcomes.

Scans completed jobs in a project, extracts parameters (from note.txt),
outcomes (from status markers and STAR files), and builds a persistent
learning database (.job_history.json).

Used by the MCP server's AI-guided tools to provide data-driven suggestions
instead of hardcoded heuristics.
"""
import json
import os
import re
import shlex
from pathlib import Path
from typing import Any, Dict, List, Optional

from star_parser import parse_star_file, get_table_rows, get_float_column, compute_stats


class JobHistory:
    """Scans and caches job history for a RELION project."""

    HISTORY_FILE = '.job_history.json'
    SUGGESTION_TRACKING_FILE = '.suggestion_tracking.json'

    # Job types where we can extract resolution metrics
    RESOLUTION_TYPES = {'PostProcess', 'Refine3D'}
    CTF_TYPES = {'CtfFind'}
    CLASS_TYPES = {'Class2D', 'Class3D'}
    # Tomography job types
    TOMO_TYPES = {'TomoImport', 'TomoExcludeTilts', 'TomoAlignTilts', 'TomoReconstruct',
                  'TomoDenoise', 'TomoImportParticles', 'TomoSubtomo', 'TomoCtfRefine'}

    def __init__(self, project_dir: str):
        self.project_dir = Path(project_dir)
        self.history_path = self.project_dir / self.HISTORY_FILE
        self.suggestion_tracking_path = self.project_dir / self.SUGGESTION_TRACKING_FILE
        self.jobs: List[Dict[str, Any]] = []
        self.suggestion_records: List[Dict[str, Any]] = []
        self._loaded = False
        self._suggestions_loaded = False

    def build(self, force: bool = False) -> 'JobHistory':
        """Scan all jobs and build/refresh the history database."""
        # Check cache validity
        if not force and self._try_load_cache():
            return self

        self.jobs = []
        # Scan all job type directories
        for item in sorted(self.project_dir.iterdir()):
            if not item.is_dir():
                continue
            # RELION job type dirs are capitalized (Import, CtfFind, Class2D, etc.)
            if not item.name[0].isupper():
                continue
            job_type = item.name
            for job_dir in sorted(item.iterdir()):
                if not job_dir.is_dir() or not job_dir.name.startswith('job'):
                    continue
                record = self._scan_job(job_type, job_dir)
                if record:
                    self.jobs.append(record)

        self._save_cache()
        self._loaded = True
        return self

    def _try_load_cache(self) -> bool:
        """Load from cache if valid (same job count on disk)."""
        if not self.history_path.exists():
            return False
        try:
            with open(self.history_path) as f:
                data = json.load(f)
            disk_count = self._count_jobs_on_disk()
            if data.get('job_count', 0) == disk_count and disk_count > 0:
                self.jobs = data.get('jobs', [])
                self._loaded = True
                return True
        except (json.JSONDecodeError, KeyError):
            pass
        return False

    def _count_jobs_on_disk(self) -> int:
        """Count total job directories."""
        count = 0
        for item in self.project_dir.iterdir():
            if item.is_dir() and item.name[0].isupper():
                for sub in item.iterdir():
                    if sub.is_dir() and sub.name.startswith('job'):
                        count += 1
        return count

    def _save_cache(self):
        """Persist history to disk."""
        data = {
            'job_count': len(self.jobs),
            'project_dir': str(self.project_dir),
            'jobs': self.jobs,
        }
        try:
            with open(self.history_path, 'w') as f:
                json.dump(data, f, indent=2, default=str)
        except OSError:
            pass  # Non-critical -- cache is a convenience

    def _scan_job(self, job_type: str, job_dir: Path) -> Optional[Dict[str, Any]]:
        """Extract all data from a single job directory."""
        job_id = f'{job_type}/{job_dir.name}'
        record: Dict[str, Any] = {
            'job_id': job_id,
            'job_type': job_type,
            'job_name': job_dir.name,
        }

        # Status
        if (job_dir / 'RELION_JOB_EXIT_SUCCESS').exists():
            record['status'] = 'Finished'
        elif (job_dir / 'RELION_JOB_EXIT_FAILURE').exists():
            record['status'] = 'Failed'
        elif (job_dir / 'RELION_JOB_EXIT_ABORTED').exists() or (job_dir / 'RELION_JOB_ABORT').exists():
            record['status'] = 'Aborted'
        elif (job_dir / 'RELION_JOB_RUNNING').exists():
            record['status'] = 'Running'
        else:
            record['status'] = 'Unknown'

        # Parameters from note.txt
        note_file = job_dir / 'note.txt'
        if note_file.exists():
            record['parameters'] = self._parse_note_txt(note_file)

        # Quality metrics from output files
        metrics = self._extract_metrics(job_type, job_dir)
        if metrics:
            record['metrics'] = metrics

        # Timing from .slurm_jobs.json
        slurm_data = self._get_slurm_data(job_id)
        if slurm_data:
            record['submit_time'] = slurm_data.get('submit_time', '')
            record['slurm_status'] = slurm_data.get('last_status', '')

        return record

    def _parse_note_txt(self, note_file: Path) -> Dict[str, Any]:
        """Parse RELION command from note.txt into parameter dict."""
        params = {}
        try:
            content = note_file.read_text()
            # Find the command line (after "with the following command(s):")
            # Format: `which relion_XXX` --param1 val1 --param2 val2 ...
            for line in content.split('\n'):
                line = line.strip()
                if not line or line.startswith('+++') or line.startswith('#'):
                    continue
                if '`which relion' in line or line.startswith('`which'):
                    params = self._parse_command_line(line)
                    break
        except OSError:
            pass
        return params

    def _parse_command_line(self, cmd: str) -> Dict[str, Any]:
        """Parse a RELION command line into key-value params."""
        params = {}
        # Remove backtick-quoted which command
        cmd = re.sub(r'`[^`]*`', '', cmd).strip()
        try:
            tokens = shlex.split(cmd)
        except ValueError:
            tokens = cmd.split()

        i = 0
        while i < len(tokens):
            token = tokens[i]
            if token.startswith('--'):
                key = token[2:]
                # Check if next token is a value or another flag
                if i + 1 < len(tokens) and not tokens[i + 1].startswith('--'):
                    val = tokens[i + 1]
                    # Try to convert to number
                    try:
                        val = int(val)
                    except ValueError:
                        try:
                            val = float(val)
                        except ValueError:
                            pass
                    params[key] = val
                    i += 2
                else:
                    params[key] = True
                    i += 1
            else:
                i += 1
        return params

    @staticmethod
    def _get_star_values(data: dict, block_name: str) -> dict:
        """Get key-value pairs from a STAR data block (handles both loops and values)."""
        # Try with and without data_ prefix
        for name in [block_name, f'data_{block_name}']:
            block = data.get('data_blocks', {}).get(name, {})
            if block:
                # Single-row blocks store data in 'values' dict
                if block.get('values'):
                    return block['values']
                # Loop blocks -- get first row via get_table_rows
                rows = get_table_rows(data, block_name)
                if rows:
                    return rows[0]
        return {}

    def _extract_metrics(self, job_type: str, job_dir: Path) -> Dict[str, Any]:
        """Extract quality metrics from job output files."""
        metrics = {}

        if job_type == 'PostProcess':
            star_file = job_dir / 'postprocess.star'
            if star_file.exists():
                try:
                    data = parse_star_file(str(star_file))
                    vals = self._get_star_values(data, 'general')
                    res = vals.get('rlnFinalResolution')
                    if res:
                        metrics['resolution'] = round(float(res), 3)
                    bfac = vals.get('rlnBfactorUsedForSharpening')
                    if bfac:
                        metrics['bfactor'] = round(float(bfac), 2)
                except Exception as e:
                    print(f"[JobHistory] PostProcess metric extraction failed for {job_dir.name}: {e}", flush=True)

        elif job_type == 'Refine3D':
            for star_name in ['run_model.star', 'run_it*_model.star']:
                matches = sorted(job_dir.glob(star_name))
                if matches:
                    try:
                        data = parse_star_file(str(matches[-1]))
                        vals = self._get_star_values(data, 'model_general')
                        res = vals.get('rlnCurrentResolution')
                        if res and float(res) > 0:
                            metrics['resolution'] = round(float(res), 2)
                    except Exception as e:
                        print(f"[JobHistory] Refine3D metric extraction failed for {job_dir.name}: {e}", flush=True)
                    break

        elif job_type == 'CtfFind':
            star_files = sorted(job_dir.glob('**/*ctf.star'))
            if star_files:
                try:
                    data = parse_star_file(str(star_files[-1]))
                    rows = get_table_rows(data, 'micrographs')
                    if rows:
                        metrics['micrograph_count'] = len(rows)
                        res_values = get_float_column(rows, 'rlnCtfMaxResolution')
                        if res_values:
                            stats = compute_stats(res_values)
                            metrics['mean_ctf_resolution'] = round(stats.get('mean', 999), 2)
                            metrics['best_ctf_resolution'] = round(stats.get('min', 999), 2)
                except Exception as e:
                    print(f"[JobHistory] CtfFind metric extraction failed for {job_dir.name}: {e}", flush=True)

        elif job_type in ('Class2D', 'Class3D'):
            model_files = sorted(job_dir.glob('run_it*_model.star'))
            if model_files:
                try:
                    data = parse_star_file(str(model_files[-1]))
                    classes = get_table_rows(data, 'model_classes')
                    if classes:
                        dists = [float(c.get('rlnClassDistribution', 0)) for c in classes]
                        metrics['num_classes'] = len(classes)
                        metrics['empty_classes'] = sum(1 for d in dists if d < 0.001)
                        metrics['max_class_fraction'] = round(max(dists), 4) if dists else 0
                except Exception as e:
                    print(f"[JobHistory] {job_type} metric extraction failed for {job_dir.name}: {e}", flush=True)

        elif job_type in self.TOMO_TYPES:
            metrics = self._extract_tomo_metrics(job_type, job_dir)

        return metrics

    def _get_slurm_data(self, job_id: str) -> Optional[Dict]:
        """Look up Slurm submission data from .slurm_jobs.json."""
        slurm_file = self.project_dir / '.slurm_jobs.json'
        if not slurm_file.exists():
            return None
        try:
            with open(slurm_file) as f:
                data = json.load(f)
            return data.get(job_id)
        except (json.JSONDecodeError, OSError):
            return None

    # --- Query Methods ---

    def get_successful_params(self, job_type: str) -> List[Dict[str, Any]]:
        """Return parameter sets from successful jobs of this type, newest first."""
        self._ensure_built()
        results = []
        for job in reversed(self.jobs):
            if job['job_type'] == job_type and job['status'] == 'Finished':
                entry = {
                    'job_id': job['job_id'],
                    'parameters': job.get('parameters', {}),
                    'metrics': job.get('metrics', {}),
                }
                if job.get('submit_time'):
                    entry['submit_time'] = job['submit_time']
                results.append(entry)
        return results

    def get_best_run(self, job_type: str, metric: str = 'resolution') -> Optional[Dict[str, Any]]:
        """Find the best-performing completed job by a given metric."""
        self._ensure_built()
        best = None
        best_val = float('inf')  # Lower is better for resolution
        for job in self.jobs:
            if job['job_type'] != job_type or job['status'] != 'Finished':
                continue
            val = job.get('metrics', {}).get(metric)
            if val is not None and val < best_val:
                best_val = val
                best = job
        return best

    def get_failure_patterns(self, job_type: str) -> List[Dict[str, Any]]:
        """Return parameter sets and info from failed jobs of this type."""
        self._ensure_built()
        results = []
        for job in self.jobs:
            if job['job_type'] == job_type and job['status'] == 'Failed':
                results.append({
                    'job_id': job['job_id'],
                    'parameters': job.get('parameters', {}),
                    'submit_time': job.get('submit_time', ''),
                })
        return results

    def get_type_stats(self, job_type: str) -> Dict[str, Any]:
        """Get aggregate stats for a job type."""
        self._ensure_built()
        type_jobs = [j for j in self.jobs if j['job_type'] == job_type]
        if not type_jobs:
            return {'total': 0}

        finished = [j for j in type_jobs if j['status'] == 'Finished']
        failed = [j for j in type_jobs if j['status'] == 'Failed']

        stats = {
            'total': len(type_jobs),
            'finished': len(finished),
            'failed': len(failed),
            'success_rate': round(len(finished) / len(type_jobs) * 100, 1) if type_jobs else 0,
        }

        # Resolution stats for applicable types
        resolutions = [j['metrics']['resolution'] for j in finished
                       if 'metrics' in j and 'resolution' in j.get('metrics', {})]
        if resolutions:
            stats['best_resolution'] = round(min(resolutions), 2)
            stats['worst_resolution'] = round(max(resolutions), 2)
            stats['mean_resolution'] = round(sum(resolutions) / len(resolutions), 2)

        # CTF stats
        ctf_res = [j['metrics']['mean_ctf_resolution'] for j in finished
                   if 'metrics' in j and 'mean_ctf_resolution' in j.get('metrics', {})]
        if ctf_res:
            stats['best_ctf_resolution'] = round(min(ctf_res), 2)
            stats['mean_ctf_resolution'] = round(sum(ctf_res) / len(ctf_res), 2)

        return stats

    def compare_jobs(self, job_id_1: str, job_id_2: str) -> Dict[str, Any]:
        """Side-by-side comparison of two jobs."""
        self._ensure_built()
        j1 = self._find_job(job_id_1)
        j2 = self._find_job(job_id_2)
        if not j1 or not j2:
            missing = []
            if not j1:
                missing.append(job_id_1)
            if not j2:
                missing.append(job_id_2)
            return {'error': f'Job(s) not found: {", ".join(missing)}'}

        # Parameter diff
        p1 = j1.get('parameters', {})
        p2 = j2.get('parameters', {})
        all_keys = sorted(set(list(p1.keys()) + list(p2.keys())))

        param_diff = {}
        for k in all_keys:
            v1 = p1.get(k)
            v2 = p2.get(k)
            if v1 != v2:
                param_diff[k] = {'job1': v1, 'job2': v2}

        return {
            'job1': {'id': job_id_1, 'status': j1['status'], 'metrics': j1.get('metrics', {}),
                     'submit_time': j1.get('submit_time', '')},
            'job2': {'id': job_id_2, 'status': j2['status'], 'metrics': j2.get('metrics', {}),
                     'submit_time': j2.get('submit_time', '')},
            'parameter_differences': param_diff,
            'parameters_in_common': {k: p1[k] for k in all_keys if p1.get(k) == p2.get(k) and k in p1},
        }

    def summary(self) -> Dict[str, Any]:
        """Full project history summary."""
        self._ensure_built()
        by_type: Dict[str, Dict] = {}
        for job in self.jobs:
            jt = job['job_type']
            if jt not in by_type:
                by_type[jt] = {'total': 0, 'finished': 0, 'failed': 0, 'best_resolution': None}
            by_type[jt]['total'] += 1
            if job['status'] == 'Finished':
                by_type[jt]['finished'] += 1
                res = job.get('metrics', {}).get('resolution')
                if res and (by_type[jt]['best_resolution'] is None or res < by_type[jt]['best_resolution']):
                    by_type[jt]['best_resolution'] = round(res, 2)
            elif job['status'] == 'Failed':
                by_type[jt]['failed'] += 1

        return {
            'project': str(self.project_dir),
            'total_jobs': len(self.jobs),
            'finished': sum(1 for j in self.jobs if j['status'] == 'Finished'),
            'failed': sum(1 for j in self.jobs if j['status'] == 'Failed'),
            'by_type': by_type,
        }

    def _find_job(self, job_id: str) -> Optional[Dict]:
        """Find a job record by ID."""
        for job in self.jobs:
            if job['job_id'] == job_id:
                return job
        return None

    def _ensure_built(self):
        """Build history if not already loaded."""
        if not self._loaded:
            self.build()

    # ============================================================
    # SUGGESTION TRACKING SYSTEM
    # ============================================================

    def _load_suggestion_tracking(self):
        """Load suggestion tracking records from disk."""
        if self._suggestions_loaded:
            return
        if self.suggestion_tracking_path.exists():
            try:
                with open(self.suggestion_tracking_path) as f:
                    data = json.load(f)
                self.suggestion_records = data.get('records', [])
            except (json.JSONDecodeError, OSError):
                self.suggestion_records = []
        self._suggestions_loaded = True

    def _save_suggestion_tracking(self):
        """Persist suggestion tracking to disk."""
        data = {
            'project_dir': str(self.project_dir),
            'records': self.suggestion_records,
        }
        try:
            with open(self.suggestion_tracking_path, 'w') as f:
                json.dump(data, f, indent=2, default=str)
        except OSError:
            pass  # Non-critical

    def record_suggestion_usage(
        self,
        job_id: str,
        job_type: str,
        suggestion_source: str,
        suggested_params: Dict[str, Any],
        actual_params: Dict[str, Any],
        based_on_job: str = ''
    ) -> Dict[str, Any]:
        """
        Record when a suggestion was made and what the user actually submitted.

        Args:
            job_id: The submitted job ID
            job_type: Job type (Class2D, Refine3D, etc.)
            suggestion_source: 'history', 'heuristics', or 'user' (no suggestion used)
            suggested_params: What suggest_parameters() returned
            actual_params: What the user actually submitted
            based_on_job: If source='history', which job informed the suggestion

        Returns: The tracking record created
        """
        self._load_suggestion_tracking()

        # Calculate which parameters differ
        modified_params = []
        skip_keys = {'nr_mpi', 'nr_threads', 'o', 'pipeline_control', 'j', 'gpu', 'pool', 'pad'}

        for key in set(list(suggested_params.keys()) + list(actual_params.keys())):
            if key in skip_keys:
                continue
            suggested_val = suggested_params.get(key)
            actual_val = actual_params.get(key)
            if suggested_val != actual_val:
                modified_params.append(key)

        # Calculate deviation score (0 = used suggestion exactly, 1 = all different)
        relevant_keys = [k for k in suggested_params.keys() if k not in skip_keys]
        deviation_score = len(modified_params) / max(len(relevant_keys), 1)

        record = {
            'job_id': job_id,
            'job_type': job_type,
            'timestamp': str(Path(self.project_dir / job_id).stat().st_mtime
                            if (self.project_dir / job_id).exists() else ''),
            'suggestion_source': suggestion_source,
            'based_on_job': based_on_job,
            'suggested_params': suggested_params,
            'actual_params': {k: v for k, v in actual_params.items() if k not in skip_keys},
            'modified_params': modified_params,
            'deviation_score': round(deviation_score, 3),
            'outcome': None,  # Filled in later by link_outcome()
        }

        self.suggestion_records.append(record)
        self._save_suggestion_tracking()
        return record

    def link_outcome(self, job_id: str) -> bool:
        """
        Link a job's final outcome to its suggestion record.
        Call this after job completes to close the feedback loop.

        Returns: True if record was updated, False if not found
        """
        self._load_suggestion_tracking()
        self._ensure_built()

        # Find the suggestion record
        rec = None
        for r in self.suggestion_records:
            if r['job_id'] == job_id:
                rec = r
                break
        if not rec:
            return False

        # Find the job record
        job = self._find_job(job_id)
        if not job:
            return False

        rec['outcome'] = {
            'status': job.get('status', 'Unknown'),
            'success': job.get('status') == 'Finished',
            'metrics': job.get('metrics', {}),
        }

        self._save_suggestion_tracking()
        return True

    def get_suggestion_accuracy(self, job_type: str = '') -> Dict[str, Any]:
        """
        Get accuracy statistics for the suggestion system.

        Returns stats on:
        - How often suggestions were used vs modified vs ignored
        - Success rate when using suggestions vs not
        - Resolution outcomes (for applicable types)

        Args:
            job_type: Optional filter by job type. Empty = all types.
        """
        self._load_suggestion_tracking()
        self._ensure_built()

        records = self.suggestion_records
        if job_type:
            records = [r for r in records if r['job_type'] == job_type]

        if not records:
            return {
                'total_jobs_tracked': 0,
                'message': f'No suggestion tracking data{f" for {job_type}" if job_type else ""}',
            }

        # Categorize by source and deviation
        from_history = [r for r in records if r['suggestion_source'] == 'history']
        from_heuristics = [r for r in records if r['suggestion_source'] == 'heuristics']
        no_suggestion = [r for r in records if r['suggestion_source'] == 'user']

        # Further split by whether user modified
        used_exactly = [r for r in (from_history + from_heuristics) if r['deviation_score'] < 0.01]
        modified = [r for r in (from_history + from_heuristics) if 0.01 <= r['deviation_score'] < 0.5]
        heavily_modified = [r for r in (from_history + from_heuristics) if r['deviation_score'] >= 0.5]

        # Calculate success rates
        def success_rate(recs: List[Dict]) -> float:
            with_outcome = [r for r in recs if r.get('outcome')]
            if not with_outcome:
                return -1  # No data
            successes = sum(1 for r in with_outcome if r['outcome'].get('success'))
            return round(successes / len(with_outcome) * 100, 1)

        def avg_resolution(recs: List[Dict]) -> Optional[float]:
            vals = [r['outcome']['metrics'].get('resolution')
                    for r in recs if r.get('outcome') and r['outcome'].get('metrics', {}).get('resolution')]
            return round(sum(vals) / len(vals), 2) if vals else None

        stats = {
            'total_jobs_tracked': len(records),
            'suggestions_from_history': len(from_history),
            'suggestions_from_heuristics': len(from_heuristics),
            'no_suggestion_used': len(no_suggestion),

            'suggestion_acceptance': {
                'used_exactly': len(used_exactly),
                'modified_slightly': len(modified),
                'heavily_modified': len(heavily_modified),
            },

            'success_rates': {
                'with_history_suggestion': success_rate(from_history),
                'with_heuristic_suggestion': success_rate(from_heuristics),
                'no_suggestion': success_rate(no_suggestion),
                'used_exactly': success_rate(used_exactly),
                'modified': success_rate(modified + heavily_modified),
            },

            'resolution_outcomes': {
                'avg_with_history': avg_resolution(from_history),
                'avg_with_heuristics': avg_resolution(from_heuristics),
                'avg_no_suggestion': avg_resolution(no_suggestion),
            },
        }

        # Add interpretation
        notes = []
        if stats['success_rates']['with_history_suggestion'] > 0:
            hist_rate = stats['success_rates']['with_history_suggestion']
            heur_rate = stats['success_rates']['with_heuristic_suggestion']
            if hist_rate > heur_rate > 0:
                diff = hist_rate - heur_rate
                notes.append(f"History-based suggestions have {diff:.0f}% higher success rate than heuristics")
            if stats['resolution_outcomes']['avg_with_history'] and stats['resolution_outcomes']['avg_with_heuristics']:
                if stats['resolution_outcomes']['avg_with_history'] < stats['resolution_outcomes']['avg_with_heuristics']:
                    notes.append("History-based suggestions lead to better average resolution")

        if used_exactly:
            exact_rate = stats['success_rates']['used_exactly']
            mod_rate = stats['success_rates']['modified']
            if exact_rate > mod_rate > 0:
                notes.append(f"Jobs using suggestions exactly succeed {exact_rate - mod_rate:.0f}% more often")

        stats['insights'] = notes
        return stats

    def get_parameter_impact(self, job_type: str, param_name: str) -> Dict[str, Any]:
        """
        Analyze correlation between a parameter's values and job outcomes.

        Args:
            job_type: Job type to analyze
            param_name: Parameter name to analyze (e.g., 'nr_classes', 'tau_fudge')

        Returns: Analysis of how different values correlate with success/failure and resolution
        """
        self._ensure_built()

        type_jobs = [j for j in self.jobs if j['job_type'] == job_type
                     and 'parameters' in j and param_name in j.get('parameters', {})]

        if not type_jobs:
            return {
                'job_type': job_type,
                'parameter': param_name,
                'error': f'No jobs found with parameter {param_name}',
            }

        # Group by value
        by_value: Dict[Any, List[Dict]] = {}
        for job in type_jobs:
            val = job['parameters'][param_name]
            # Bucket numeric values to reduce noise
            if isinstance(val, (int, float)):
                # Round to 2 significant figures for grouping
                if val != 0:
                    from math import log10, floor
                    magnitude = floor(log10(abs(val)))
                    val = round(val, -magnitude + 1)
            if val not in by_value:
                by_value[val] = []
            by_value[val].append(job)

        # Calculate stats per value
        value_stats = []
        for val, jobs in sorted(by_value.items(), key=lambda x: (str(type(x[0])), x[0])):
            finished = [j for j in jobs if j['status'] == 'Finished']
            failed = [j for j in jobs if j['status'] == 'Failed']
            resolutions = [j['metrics']['resolution'] for j in finished
                          if 'metrics' in j and 'resolution' in j.get('metrics', {})]

            stat = {
                'value': val,
                'total_jobs': len(jobs),
                'succeeded': len(finished),
                'failed': len(failed),
                'success_rate': round(len(finished) / len(jobs) * 100, 1) if jobs else 0,
            }
            if resolutions:
                stat['avg_resolution'] = round(sum(resolutions) / len(resolutions), 2)
                stat['best_resolution'] = round(min(resolutions), 2)

            value_stats.append(stat)

        # Find optimal value
        best_by_success = max(value_stats, key=lambda x: x['success_rate']) if value_stats else None
        best_by_resolution = min(
            [s for s in value_stats if s.get('avg_resolution')],
            key=lambda x: x['avg_resolution'],
            default=None
        )

        return {
            'job_type': job_type,
            'parameter': param_name,
            'total_jobs_analyzed': len(type_jobs),
            'value_breakdown': value_stats,
            'optimal_for_success': best_by_success['value'] if best_by_success else None,
            'optimal_for_resolution': best_by_resolution['value'] if best_by_resolution else None,
            'recommendation': (
                f"For best success rate, use {param_name}={best_by_success['value']}" if best_by_success else None
            ),
        }

    # ============================================================
    # TOMOGRAPHY METRICS EXTRACTION
    # ============================================================

    def _extract_tomo_metrics(self, job_type: str, job_dir: Path) -> Dict[str, Any]:
        """Extract metrics from tomography jobs."""
        metrics = {}

        if job_type == 'TomoAlignTilts':
            # Look for alignment results
            for star_file in job_dir.glob('**/*tilt*.star'):
                try:
                    data = parse_star_file(str(star_file))
                    tilts = get_table_rows(data, 'global')
                    if tilts:
                        metrics['tilt_count'] = len(tilts)
                        # Extract RMSE if available
                        rmse_vals = get_float_column(tilts, 'rlnTomoXTiltCorrection')
                        if rmse_vals:
                            metrics['mean_correction'] = round(sum(abs(v) for v in rmse_vals) / len(rmse_vals), 3)
                    break
                except Exception as e:
                    print(f"[JobHistory] TomoAlign metric extraction failed for {job_dir.name} ({star_file.name}): {e}", flush=True)

        elif job_type == 'TomoReconstruct':
            # Look for tomogram dimensions
            for mrc_file in job_dir.glob('**/*.mrc'):
                try:
                    # Get file size as proxy for reconstruction quality
                    size_mb = mrc_file.stat().st_size / (1024 * 1024)
                    if size_mb > 10:  # Real tomogram, not just a slice
                        metrics['tomogram_count'] = metrics.get('tomogram_count', 0) + 1
                        metrics['total_size_mb'] = metrics.get('total_size_mb', 0) + round(size_mb, 1)
                except Exception as e:
                    print(f"[JobHistory] TomoReconstruct metric extraction failed for {job_dir.name} ({mrc_file.name}): {e}", flush=True)

        elif job_type == 'TomoSubtomo':
            # Look for subtomogram particle counts
            for star_file in job_dir.glob('**/*particles*.star'):
                try:
                    data = parse_star_file(str(star_file))
                    particles = get_table_rows(data, 'particles')
                    if particles:
                        metrics['particle_count'] = len(particles)
                    break
                except Exception as e:
                    print(f"[JobHistory] TomoSubtomo metric extraction failed for {job_dir.name} ({star_file.name}): {e}", flush=True)

        elif job_type in ('TomoDenoise', 'TomoImport', 'TomoExcludeTilts', 'TomoImportParticles'):
            # Count output files
            star_files = list(job_dir.glob('**/*.star'))
            mrc_files = list(job_dir.glob('**/*.mrc'))
            metrics['star_file_count'] = len(star_files)
            metrics['mrc_file_count'] = len(mrc_files)

        return metrics
