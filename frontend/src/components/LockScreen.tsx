import React, { useState } from 'react';
import { Lock, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';
import { loginWithPin } from '../api';

interface LockScreenProps {
  onSuccess: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onSuccess }) => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const ok = await loginWithPin(pin.trim());
      if (ok) {
        onSuccess();
      } else {
        setError('PIN o contraseña incorrecta');
      }
    } catch (err: any) {
      setError(err.message || 'Error al autenticar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-claude-bg text-claude-text select-none">
      
      {/* Warm ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-claude-accentSubtle rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 flex flex-col items-center text-center space-y-6">
        
        {/* Shield Icon estilo Claude */}
        <div className="w-16 h-16 rounded-3xl bg-claude-surface border border-claude-border flex items-center justify-center shadow-lg">
          <Lock className="w-7 h-7 text-claude-accent" />
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <h2 className="text-3xl font-serif font-medium tracking-tight text-claude-text">
            Bóveda Bloqueada
          </h2>
          <p className="text-xs text-claude-textMuted max-w-xs font-sans">
            Introduce tu PIN o contraseña de acceso para explorar tus notas y trucos de IA.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="w-full p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="relative">
            <KeyRound className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-claude-textMuted" />
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              autoFocus
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-claude-surface border border-claude-border text-center tracking-widest text-lg font-mono text-claude-text placeholder-claude-textMuted/40 focus:outline-none focus:border-claude-accent transition-all shadow-inner"
            />
          </div>

          <button
            type="submit"
            disabled={!pin.trim() || loading}
            className="w-full py-3.5 rounded-2xl bg-claude-accent hover:bg-claude-accentHover text-white font-semibold text-sm shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-98"
          >
            <span>{loading ? 'Verificando...' : 'Desbloquear Bóveda'}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <p className="text-[11px] text-claude-textMuted font-mono">
          ReelMind — Private Knowledge Base
        </p>

      </div>
    </div>
  );
};
