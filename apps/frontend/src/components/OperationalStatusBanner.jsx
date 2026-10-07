import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { io } from 'socket.io-client';
import { useWorkspaceAuth } from './WorkspaceAuth';

export default function OperationalStatusBanner({ onOpen }) {
  const { user } = useWorkspaceAuth();
  const [controls, setControls] = useState([]);
  const [unavailable, setUnavailable] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/operations/controls', { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Operational status unavailable');
      const data = await response.json();
      setControls(data.controls || []);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
    socket.on('connect', refresh);
    socket.on('operations:control:update', ({ control }) => {
      if (!control?.key) return;
      setControls((current) => current.map((item) => item.key === control.key ? control : item));
      setUnavailable(false);
    });
    const timer = setInterval(refresh, 60_000);
    return () => {
      clearInterval(timer);
      socket.disconnect();
    };
  }, [refresh]);

  const paused = controls.filter((control) => control.available !== false && !control.enabled);
  if (!unavailable && paused.length === 0) return null;
  return (
    <aside className="operational-banner" role="status" aria-live="polite">
      <AlertTriangle size={17} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <strong>{unavailable ? 'Operational control status is unavailable' : `${paused.length} capability ${paused.length === 1 ? 'is' : 'are'} paused`}</strong>
        <p>{unavailable ? 'Backend enforcement remains authoritative. Refresh before starting sensitive work.' : paused.map((item) => item.label).join(' · ')}</p>
      </div>
      {user.role === 'admin' && (
        <button className="text-action" onClick={onOpen}>
          Review controls <ArrowRight size={14} />
        </button>
      )}
    </aside>
  );
}
