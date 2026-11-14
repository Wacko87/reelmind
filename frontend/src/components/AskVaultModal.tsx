import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Send, 
  Loader2, 
  BookOpen, 
  ExternalLink, 
  HelpCircle,
  Folder,
  ArrowRight
} from 'lucide-react';
import { askVault } from '../api';
import { VaultAskResponse, Reel } from '../types';

interface AskVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReel: (reelId: string) => void;
}

const QUICK_QUESTIONS = [
  "¿Qué prompts tengo guardados para Midjourney o Flux?",
  "¿Cuáles son las mejores herramientas de vídeo e imagen en mi bóveda?",
  "¿Qué trucos rápidos de menos de 5 minutos tengo?",
  "¿Cómo puedo automatizar flujos con agentes según mis vídeos?",
];

export const AskVaultModal: React.FC<AskVaultModalProps> = ({
  isOpen,
  onClose,
  onOpenReel,
}) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<VaultAskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleAsk = async (qText?: string) => {
    const q = (qText || question).trim();
    if (!q) return;

    if (qText) setQuestion(qText);
    setLoading(true);
    setError(null);

    try {
      const res = await askVault(q);
      setResponse(res);
    } catch (err: any) {
      setError(err.message || 'Error al consultar a la bóveda con Gemini');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={() => !loading && onClose()}
    >
      <div 
        className="w-full max-w-2xl bg-claude-surface border border-claude-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="p-5 sm:p-6 pb-4 border-b border-claude-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-claude-accentSubtle border border-claude-accentBorder flex items-center justify-center text-claude-accent shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-heading font-semibold text-claude-text">
                Preguntar a tu Bóveda
              </h3>
              <p className="text-xs text-claude-textMuted font-sans">
                Asistente RAG inteligente impulsado por IA Gemini
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="w-9 h-9 flex items-center justify-center rounded-xl text-claude-textMuted hover:text-claude-text hover:bg-claude-bg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo scrolleable */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          
          {/* Preguntas rápidas si aún no ha preguntado */}
          {!response && !loading && (
            <div className="space-y-3">
              <span className="text-xs text-claude-textMuted font-sans flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-claude-accent" />
                <span>Preguntas sugeridas sobre tus vídeos guardados:</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAsk(q)}
                    className="p-3 text-left rounded-xl bg-claude-bg hover:bg-claude-elevated border border-claude-border hover:border-claude-accent text-xs text-claude-text font-sans transition-all flex items-center justify-between group"
                  >
                    <span>{q}</span>
                    <ArrowRight className="w-3 h-3 text-claude-textMuted group-hover:text-claude-accent transition-colors flex-shrink-0 ml-1.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Estado de carga */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-claude-accent/20 border-t-claude-accent animate-spin" />
                <Sparkles className="w-4 h-4 text-claude-accent absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-heading font-medium text-claude-text">
                  Analizando el contenido de tu bóveda...
                </p>
                <p className="text-xs text-claude-textMuted font-mono">
                  Sintetizando fichas técnicas y prompts con Gemini
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 text-rose-300 text-xs border border-rose-500/20 font-sans">
              {error}
            </div>
          )}

          {/* Respuesta de Gemini */}
          {response && !loading && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-claude-bg border border-claude-border text-sm text-claude-text leading-relaxed whitespace-pre-wrap font-sans">
                {response.answer}
              </div>

              {/* Fichas citadas como fuentes */}
              {response.citations && response.citations.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-claude-accent">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Fuentes de tu Bóveda Citadas ({response.citations.length})</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {response.citations.map((cite, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenReel(cite.reel_id);
                        }}
                        className="p-3 rounded-xl bg-claude-surface hover:bg-claude-elevated border border-claude-border text-left transition-all flex flex-col gap-1 group"
                      >
                        <span className="font-serif font-medium text-xs text-claude-text group-hover:text-claude-accent line-clamp-1 transition-colors">
                          {cite.title}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-claude-textMuted font-mono">
                          <span className="uppercase">{cite.platform}</span>
                          {cite.tools && cite.tools.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-claude-accent truncate max-w-[120px]">
                                {cite.tools.join(', ')}
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Barra inferior de entrada */}
        <div className="p-4 border-t border-claude-border bg-claude-bg/60">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Haz una pregunta sobre tus trucos, herramientas o prompts guardados..."
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-claude-surface border border-claude-border text-xs sm:text-sm text-claude-text placeholder-claude-textMuted/60 focus:outline-none focus:border-claude-accent transition-all"
            />
            <button
              type="submit"
              disabled={!question.trim() || loading}
              className="px-4 py-2.5 rounded-xl bg-claude-accent hover:bg-claude-accentHover text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-40 flex items-center gap-1.5"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Preguntar</span>
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
