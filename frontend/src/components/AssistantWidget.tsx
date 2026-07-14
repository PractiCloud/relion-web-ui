import React, { useState, useEffect, useRef } from 'react';
import {
  Fab,
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Collapse,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';

// The Assistant app is a sibling Passenger app on the same OOD host.
// We share OOD auth (same PUN), so a relative fetch works.
function assistantUrl(path: string): string {
  const m = window.location.pathname.match(/^(\/pun\/sys\/)[^/]+/);
  const base = m ? `${m[1]}relion-web-ui-assistant` : '';
  return `${base}/${path.replace(/^\//, '')}`;
}

type ToolCall = { name: string; input: any; output: any };
type Message = {
  role: 'user' | 'assistant';
  text?: string;
  tool_calls?: ToolCall[];
  error?: string;
};

interface Props {
  currentProjectPath?: string | null;
}

function ToolCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  return (
    <Paper variant="outlined" sx={{ mt: 1, fontSize: 12 }}>
      <Box
        sx={{ p: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1 }}
        onClick={() => setOpen(!open)}
      >
        <SettingsEthernetIcon fontSize="small" color="primary" />
        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
          {call.name}()
        </Typography>
        {open ? <ExpandLessIcon fontSize="small" sx={{ ml: 'auto' }} />
              : <ExpandMoreIcon fontSize="small" sx={{ ml: 'auto' }} />}
      </Box>
      <Collapse in={open}>
        <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider', fontFamily: 'monospace', fontSize: 11, maxHeight: 200, overflow: 'auto' }}>
          <Typography variant="caption" color="text.secondary">Input</Typography>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(call.input, null, 2)}</pre>
          <Typography variant="caption" color="text.secondary">Output</Typography>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(call.output, null, 2)}</pre>
        </Box>
      </Collapse>
    </Paper>
  );
}

export default function AssistantWidget({ currentProjectPath }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'dry_run' | 'live' | 'error' | 'loading'>('loading');
  const [reachable, setReachable] = useState<boolean>(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch(assistantUrl('health'))
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(h => setMode(h.mode === 'live' ? 'live' : 'dry_run'))
      .catch(() => { setMode('error'); setReachable(false); });
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput('');
    const newMsgs: Message[] = [...messages, { role: 'user', text }];
    setMessages(newMsgs);

    // Inject current-project context into the FIRST user message of this turn,
    // so Claude knows what we're looking at without the user having to type it.
    const apiMessages = newMsgs.map((m, i) => {
      let content = m.text || '';
      if (i === newMsgs.length - 1 && currentProjectPath) {
        content = `[Context: currently viewing project at ${currentProjectPath}]\n\n${content}`;
      }
      return { role: m.role, content };
    });

    try {
      const r = await fetch(assistantUrl('chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMessages([...newMsgs, { role: 'assistant', error: data.error || `HTTP ${r.status}` }]);
      } else {
        setMessages([...newMsgs, {
          role: 'assistant',
          text: data.reply,
          tool_calls: data.tool_calls || [],
        }]);
      }
    } catch (err: any) {
      setMessages([...newMsgs, { role: 'assistant', error: String(err) }]);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setMessages([]);
    fetch(assistantUrl('reset'), { method: 'POST' }).catch(() => {});
  }

  function onKey(ev: React.KeyboardEvent) {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      send();
    }
  }

  const modeColor = mode === 'live' ? 'success' : mode === 'dry_run' ? 'warning' : 'error';
  const modeLabel = mode === 'live' ? 'LIVE' : mode === 'dry_run' ? 'DRY RUN' : mode === 'error' ? 'OFFLINE' : '…';

  return (
    <>
      <Fab
        color="primary"
        onClick={() => setOpen(true)}
        sx={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1300,
          display: open ? 'none' : 'flex',
        }}
        aria-label="Open assistant"
      >
        <ChatIcon />
      </Fab>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 440 } } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider',
          }}>
            <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
              Assistant
            </Typography>
            <Chip label={modeLabel} color={modeColor as any} size="small" sx={{ ml: 1, height: 20, fontSize: 10 }} />
            <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
              <IconButton size="small" onClick={reset} title="New conversation"><RefreshIcon fontSize="small" /></IconButton>
              <IconButton size="small" onClick={() => setOpen(false)}><CloseIcon fontSize="small" /></IconButton>
            </Box>
          </Box>

          {currentProjectPath && (
            <Box sx={{ px: 2, py: 0.75, bgcolor: 'action.hover', fontSize: 11 }}>
              <Typography variant="caption" color="text.secondary">
                Context: {currentProjectPath.split('/').slice(-1)[0]}
              </Typography>
            </Box>
          )}

          {/* Messages */}
          <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            {!reachable && (
              <Typography variant="body2" color="error">
                Assistant backend not reachable at {assistantUrl('health')}.
                Open the Assistant app once to spin it up, then retry.
              </Typography>
            )}
            {reachable && messages.length === 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Ask about your projects, jobs, or RELION results. Examples:
                </Typography>
                <Typography variant="caption" component="div" sx={{ pl: 1, color: 'text.secondary' }}>
                  • "List my projects"<br/>
                  • "What should I run next?"<br/>
                  • "Analyze Class3D/job023"<br/>
                  • "Compare Class3D/job023 and job029"
                </Typography>
              </Box>
            )}
            {messages.map((m, i) => (
              <Box key={i} sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                  {m.role === 'user' ? 'You' : 'Assistant'}
                </Typography>
                {m.text && (
                  <Paper variant="outlined" sx={{ p: 1.25, mt: 0.5, whiteSpace: 'pre-wrap', fontSize: 13, bgcolor: m.role === 'user' ? 'action.hover' : 'background.paper' }}>
                    {m.text}
                  </Paper>
                )}
                {m.error && (
                  <Paper variant="outlined" sx={{ p: 1.25, mt: 0.5, color: 'error.main', fontSize: 12 }}>
                    {m.error}
                  </Paper>
                )}
                {(m.tool_calls || []).map((c, j) => <ToolCard key={j} call={c} />)}
              </Box>
            ))}
            {busy && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                <CircularProgress size={14} />
                <Typography variant="caption">Thinking…</Typography>
              </Box>
            )}
          </Box>

          {/* Input */}
          <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              multiline
              maxRows={4}
              placeholder={busy ? 'Working…' : 'Ask…  (Enter = send, Shift+Enter = newline)'}
              value={input}
              disabled={busy || !reachable}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
            />
            <Button
              variant="contained"
              onClick={send}
              disabled={busy || !input.trim() || !reachable}
              sx={{ minWidth: 0, px: 2 }}
            >
              <SendIcon fontSize="small" />
            </Button>
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
