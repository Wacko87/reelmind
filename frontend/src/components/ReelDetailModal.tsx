import React, { useState, useEffect } from 'react';
import { Reel, Folder, PromptVariation } from '../types';
import { safeExternalUrl } from '../utils/security';
import { downloadReelMarkdown, optimizePrompt } from '../api';
import { 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  Star, 
  CheckCircle2, 
  Trash2, 
  Save, 
  Terminal, 
  ListOrdered, 
  Cpu, 
  FileText,
  Folder as FolderIcon,
  Film,
  Play,
  Sparkles,
  Link as LinkIcon,
  FileDown,
  Clock,
  Wand2,
  Loader2
} from 'lucide-react';

interface ReelDetailModalProps {
  reel: Reel;
  folders: Folder[];
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Reel>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const ReelDetailModal: React.FC<ReelDetailModalProps> = ({
  reel,
  folders,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(null);
  const [notes, setNotes] = useState(reel.user_notes || '');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(reel.folder_id || null);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSavedAlert, setNotesSavedAlert] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExportingMd, setIsExportingMd] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Estados de optimización de prompts
  const [activeOptimizerIndex, setActiveOptimizerIndex] = useState<number | null>(null);
  const [optimizerMode, setOptimizerMode] = useState<'variations' | 'adapt_model'>('variations');
  const [targetModel, setTargetModel] = useState<string>('Midjourney v6.1');
  const [optimizing, setOptimizing] = useState(false);
  const [optimizerError, setOptimizerError] = useState<string | null>(null);
  const [optimizedResults, setOptimizedResults] = useState<{ [index: number]: PromptVariation[] }>({});
  const [copiedOptKey, setCopiedOptKey] = useState<string | null>(null);

  const handleExportMarkdown = async () => {
    setIsExportingMd(true);
    try {
      await downloadReelMarkdown(reel.id, reel.title);
    } catch (err) {
      console.error('Error al exportar markdown:', err);
    } finally {
      setTimeout(() => setIsExportingMd(false), 1200);
    }
  };

  const handleToggleOptimizer = (index: number) => {
    if (activeOptimizerIndex === index) {
      setActiveOptimizerIndex(null);
    } else {
      setActiveOptimizerIndex(index);
      setOptimizerError(null);
    }
  };

  const handleRunOptimizer = async (promptText: string, index: number) => {
    setOptimizing(true);
    setOptimizerError(null);
    try {
      const res = await optimizePrompt(
        promptText,
        optimizerMode,
        optimizerMode === 'adapt_model' ? targetModel : undefined
      );
      setOptimizedResults(prev => ({
        ...prev,
        [index]: res.variations
      }));
    } catch (err: any) {
      setOptimizerError(err.message || 'Error al generar variaciones con Gemini');
    } finally {
      setOptimizing(false);
    }
  };

  const handleCopyVariation = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOptKey(key);
    setTimeout(() => setCopiedOptKey(null), 2500);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopyPrompt = (promptText: string, index: number) => {
    navigator.clipboard.writeText(promptText);
    setCopiedPromptIndex(index);
    setTimeout(() => setCopiedPromptIndex(null), 2500);
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await onUpdate(reel.id, { user_notes: notes });
      setNotesSavedAlert(true);
      setTimeout(() => setNotesSavedAlert(false), 2000);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleFolderChange = async (newFolderId: string | null) => {
    setSelectedFolderId(newFolderId);
    await onUpdate(reel.id, { folder_id: newFolderId });
  };

  const handleToggleFavorite = async () => {
    const newStatus = reel.status === 'favorite' ? 'pending' : 'favorite';
    await onUpdate(reel.id, { status: newStatus });
  };

  const handleToggleTested = async () => {
    const newStatus = reel.status === 'tested' ? 'pending' : 'tested';
    await onUpdate(reel.id, { status: newStatus });
  };

  const handleDelete = async () => {
    if (confirm('¿Estás seguro de que deseas eliminar este vídeo de tu bóveda?')) {
      setIsDeleting(true);
      try {
        await onDelete(reel.id);
        onClose();
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const flattenFolders = (items: Folder[], level = 0): { id: string; name: string; icon: string; level: number }[] => {
    let result: { id: string; name: string; icon: string; level: number }[] = [];
    for (const f of items) {
      result.push({ id: f.id, name: f.name, icon: f.icon, level });
      if (f.children && f.children.length > 0) {
        result = result.concat(flattenFolders(f.children, level + 1));
      }
    }
    return result;
  };

  const folderOptions = flattenFolders(folders);

  const isLongVideo = reel.media_type === 'video' || (Boolean(reel.duration) && (reel.duration || 0) > 600);
  const youtubeMatch = reel.url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  const youtubeId = youtubeMatch ? youtubeMatch[1] : null;

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formattedDuration = formatDuration(reel.duration);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-3xl bg-claude-surface border border-claude-border rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="p-4 sm:p-6 border-b border-claude-border flex items-start justify-between gap-4 bg-claude-surface sticky top-0 z-10 backdrop-blur-md">
          <div className="space-y-2 flex-1 pr-2">
            <div className="flex flex-wrap items-center gap-2">
              {isLongVideo ? (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                  <Film className="w-3 h-3 text-blue-400" />
                  <span>Vídeo Largo {formattedDuration ? `· ${formattedDuration}` : ''}</span>
                </span>
              ) : (
                <span className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-claude-accentSubtle text-claude-accent border border-claude-accentBorder">
                  {reel.platform}
                </span>
              )}
              
              {/* Selector de Carpeta */}
              <div className="flex items-center gap-1.5 bg-claude-bg px-2.5 py-0.5 rounded-full border border-claude-border text-xs text-claude-text">
                <FolderIcon className="w-3 h-3 text-claude-accent" />
                <select
                  value={selectedFolderId || ''}
                  onChange={(e) => handleFolderChange(e.target.value ? e.target.value : null)}
                  className="bg-transparent border-none text-xs text-claude-text focus:outline-none cursor-pointer pr-1"
                >
                  <option value="" className="bg-claude-surface text-claude-textMuted">📥 Sin clasificar</option>
                  {folderOptions.map((opt) => (
                    <option key={opt.id} value={opt.id} className="bg-claude-surface text-claude-text">
                      {'— '.repeat(opt.level) + `${opt.icon} ${opt.name}`}
                    </option>
                  ))}
                </select>
              </div>

              {reel.author && (
                <span className="text-xs text-claude-textMuted font-sans">
                  por <strong className="text-claude-text font-medium">{reel.author}</strong>
                </span>
              )}

              {/* Tiempo estimado */}
              {reel.estimated_time && (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-claude-bg text-claude-textMuted border border-claude-border flex items-center gap-1" title="Tiempo estimado para probar">
                  <Clock className="w-3 h-3 text-claude-accent" />
                  <span>{reel.estimated_time}</span>
                </span>
              )}
            </div>
            
            {/* Título en Newsreader Serif */}
            <h2 id="detail-modal-title" className="text-xl sm:text-2xl font-serif font-medium text-claude-text leading-snug">
              {reel.title}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Botón Favorito */}
            <button
              onClick={handleToggleFavorite}
              className={`p-2 rounded-xl border transition-all ${
                reel.status === 'favorite'
                  ? 'bg-claude-accent text-white border-claude-accent'
                  : 'bg-claude-bg text-claude-textMuted hover:text-claude-text border-claude-border'
              }`}
              title={reel.status === 'favorite' ? 'Quitar de favoritos' : 'Marcar favorito'}
            >
              <Star className={`w-4 h-4 ${reel.status === 'favorite' ? 'fill-white' : ''}`} />
            </button>

            {/* Botón Probado */}
            <button
              onClick={handleToggleTested}
              className={`p-2 rounded-xl border transition-all ${
                reel.status === 'tested'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-claude-bg text-claude-textMuted hover:text-claude-text border-claude-border'
              }`}
              title={reel.status === 'tested' ? 'Marcar como pendiente' : 'Marcar como probado'}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>

            {/* Botón Exportar a Obsidian / Markdown */}
            <button
              onClick={handleExportMarkdown}
              disabled={isExportingMd}
              className={`p-2 rounded-xl border transition-all ${
                isExportingMd
                  ? 'bg-claude-accent text-white border-claude-accent animate-pulse'
                  : 'bg-claude-bg text-claude-textMuted hover:text-claude-text hover:bg-claude-elevated border-claude-border'
              }`}
              title="Exportar ficha técnica a Markdown / Obsidian (.md)"
            >
              <FileDown className="w-4 h-4" />
            </button>

            {/* Cerrar */}
            <button
              onClick={onClose}
              aria-label="Cerrar modal"
              className="p-2 rounded-xl bg-claude-bg hover:bg-claude-elevated text-claude-textMuted hover:text-claude-text border border-claude-border transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto">
          
          {/* Si es vídeo largo: reproductor incrustado o banner con enlace directo */}
          {isLongVideo && (
            <div className="space-y-3">
              {youtubeId ? (
                <div className="w-full aspect-video rounded-2xl overflow-hidden border border-claude-border bg-black shadow-lg">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
                    title={reel.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-claude-bg border border-claude-border flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {reel.thumbnail_url && (
                      <img 
                        src={reel.thumbnail_url} 
                        alt={reel.title} 
                        className="w-20 h-14 object-cover rounded-xl border border-claude-border flex-shrink-0"
                      />
                    )}
                    <div>
                      <div className="text-xs font-semibold text-claude-text flex items-center gap-1.5">
                        <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
                        <span>Vídeo largo guardado como enlace</span>
                      </div>
                      <div className="text-[11px] text-claude-textMuted font-sans">
                        Sin descargas pesadas en tu homelab · Resumen generado con IA
                      </div>
                    </div>
                  </div>

                  <a
                    href={safeExternalUrl(reel.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-claude-accent hover:bg-claude-accentHover text-white text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Ver vídeo en la fuente</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Herramientas de IA */}
          {reel.ai_tools.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-claude-accent">
                <Cpu className="w-4 h-4" />
                <span>Modelos & Herramientas Detectadas</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {reel.ai_tools.map((tool) => (
                  <span
                    key={tool}
                    className="text-xs font-mono px-3 py-1 rounded-full bg-claude-accentSubtle text-claude-accent border border-claude-accentBorder"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Resumen */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-claude-textMuted">
              <FileText className="w-4 h-4" />
              <span>Resumen</span>
            </div>
            <div className="p-4 rounded-2xl bg-claude-bg border border-claude-border text-sm text-claude-text leading-relaxed font-sans">
              {reel.summary}
            </div>
          </div>

          {/* Pasos Clave */}
          {reel.key_steps.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-claude-textMuted">
                <ListOrdered className="w-4 h-4" />
                <span>Instrucciones Paso a Paso</span>
              </div>
              <div className="space-y-2">
                {reel.key_steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3.5 rounded-xl bg-claude-bg border border-claude-borderSubtle text-sm text-claude-text"
                  >
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-claude-accentSubtle text-claude-accent border border-claude-accentBorder flex items-center justify-center text-xs font-mono font-bold">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed font-sans">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prompts Extraídos & Optimizador IA */}
          {reel.prompts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-claude-accent">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-4 h-4" />
                  <span>Prompts Extraídos</span>
                </div>
                <span className="text-[11px] text-claude-textMuted lowercase font-sans">
                  con optimizador y adaptador de modelos IA
                </span>
              </div>
              <div className="space-y-3">
                {reel.prompts.map((promptText, idx) => {
                  const isCopied = copiedPromptIndex === idx;
                  const isOptimizerOpen = activeOptimizerIndex === idx;
                  const variations = optimizedResults[idx] || [];

                  return (
                    <div
                      key={idx}
                      className="relative rounded-2xl bg-[#141413] border border-claude-border overflow-hidden transition-all"
                    >
                      <div className="flex items-center justify-between px-4 py-2.5 bg-claude-bg border-b border-claude-border text-[11px] text-claude-textMuted font-mono">
                        <span>PROMPT #{idx + 1}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleOptimizer(idx)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-sans font-medium transition-all ${
                              isOptimizerOpen
                                ? 'bg-claude-accent text-white shadow-sm'
                                : 'bg-claude-surface hover:bg-[#2d2c28] text-claude-accent border border-claude-accentBorder'
                            }`}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{isOptimizerOpen ? 'Cerrar Optimizador' : 'Variaciones IA'}</span>
                          </button>

                          <button
                            onClick={() => handleCopyPrompt(promptText, idx)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-sans font-medium transition-all ${
                              isCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-claude-surface hover:bg-[#2d2c28] text-claude-text border border-claude-border'
                            }`}
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copiar Prompt</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <pre className="p-4 text-xs font-mono text-claude-text whitespace-pre-wrap leading-relaxed select-all">
                        {promptText}
                      </pre>

                      {/* Panel Expansible de Optimización con Gemini */}
                      {isOptimizerOpen && (
                        <div className="p-4 border-t border-claude-border bg-claude-surface/60 space-y-4 animate-in fade-in duration-200">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                              <Wand2 className="w-4 h-4 text-claude-accent" />
                              <span className="text-xs font-semibold text-claude-text font-heading">
                                Generador de Variaciones & Adaptación
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Selector Modo */}
                              <div className="flex items-center bg-claude-bg p-0.5 rounded-lg border border-claude-border text-xs">
                                <button
                                  type="button"
                                  onClick={() => setOptimizerMode('variations')}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                                    optimizerMode === 'variations'
                                      ? 'bg-claude-surface text-claude-text shadow-sm'
                                      : 'text-claude-textMuted hover:text-claude-text'
                                  }`}
                                >
                                  3 Estilos
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOptimizerMode('adapt_model')}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                                    optimizerMode === 'adapt_model'
                                      ? 'bg-claude-surface text-claude-text shadow-sm'
                                      : 'text-claude-textMuted hover:text-claude-text'
                                  }`}
                                >
                                  Adaptar Motor
                                </button>
                              </div>

                              {/* Selector Motor Destino si adapt_model */}
                              {optimizerMode === 'adapt_model' && (
                                <select
                                  value={targetModel}
                                  onChange={(e) => setTargetModel(e.target.value)}
                                  className="px-2 py-1 rounded-lg bg-claude-bg border border-claude-border text-xs text-claude-text focus:outline-none"
                                >
                                  <option value="Midjourney v6.1">Midjourney v6.1</option>
                                  <option value="Flux 1.1 Pro">Flux 1.1 Pro</option>
                                  <option value="DALL-E 3">DALL-E 3</option>
                                  <option value="Stable Diffusion XL">Stable Diffusion XL</option>
                                  <option value="Claude 3.7 / ChatGPT">Claude / ChatGPT</option>
                                  <option value="Cursor / Programación">Cursor / Code</option>
                                </select>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRunOptimizer(promptText, idx)}
                                disabled={optimizing}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-claude-accent hover:bg-claude-accentHover text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                              >
                                {optimizing ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Generando...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Generar</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {optimizerError && (
                            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-sans">
                              {optimizerError}
                            </div>
                          )}

                          {/* Variaciones Generadas */}
                          {variations.length > 0 && (
                            <div className="space-y-3 pt-1">
                              {variations.map((v, vIdx) => {
                                const optKey = `${idx}-${vIdx}`;
                                const isOptCopied = copiedOptKey === optKey;

                                return (
                                  <div
                                    key={vIdx}
                                    className="p-3.5 rounded-xl bg-claude-bg border border-claude-border space-y-2"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-claude-accentSubtle text-claude-accent border border-claude-accentBorder">
                                        {v.label}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyVariation(v.prompt, optKey)}
                                        className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-sans transition-all ${
                                          isOptCopied
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-claude-surface hover:bg-claude-elevated text-claude-text border border-claude-border'
                                        }`}
                                      >
                                        {isOptCopied ? (
                                          <>
                                            <Check className="w-3 h-3" />
                                            <span>Copiado</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3 h-3" />
                                            <span>Copiar</span>
                                          </>
                                        )}
                                      </button>
                                    </div>

                                    <pre className="text-xs font-mono text-claude-text whitespace-pre-wrap leading-relaxed select-all">
                                      {v.prompt}
                                    </pre>

                                    {v.explanation && (
                                      <p className="text-[11px] text-claude-textMuted font-sans italic border-t border-claude-borderSubtle/50 pt-1.5">
                                        💡 {v.explanation}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notas Personales */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-claude-textMuted">
              <span>Notas Personales</span>
              {notesSavedAlert && (
                <span className="text-emerald-400 flex items-center gap-1 font-sans capitalize">
                  <Check className="w-3.5 h-3.5" /> Guardado
                </span>
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Escribe aquí tus observaciones o ajustes..."
              rows={3}
              className="w-full p-3.5 rounded-xl bg-claude-bg border border-claude-border text-sm text-claude-text placeholder-claude-textMuted/50 focus:outline-none focus:border-claude-accent font-sans"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-claude-bg hover:bg-claude-elevated text-claude-text text-xs font-medium border border-claude-border transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-claude-accent" />
                <span>{isSavingNotes ? 'Guardando...' : 'Guardar notas'}</span>
              </button>
            </div>
          </div>

          {/* Footer del Modal */}
          <div className="pt-4 border-t border-claude-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {reel.tags.map((tag) => (
                <span key={tag} className="text-xs text-claude-textMuted bg-claude-bg border border-claude-borderSubtle px-2.5 py-0.5 rounded-full font-mono">
                  #{tag}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors"
                title="Eliminar de la bóveda"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar</span>
              </button>

              <a
                href={safeExternalUrl(reel.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-claude-accent hover:bg-claude-accentHover text-white text-xs font-semibold shadow-sm transition-all"
              >
                <span>Abrir vídeo original</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
