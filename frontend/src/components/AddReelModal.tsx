import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  ClipboardPaste, 
  AlertCircle, 
  Link as LinkIcon, 
  Folder as FolderIcon,
  Film,
  Smartphone,
  Zap,
  Info,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { analyzeReel } from '../api';
import { Reel, Folder } from '../types';
import { extractUrlFromText } from '../utils/url';

interface AddReelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReelAdded: (newReel: Reel) => void;
  onOpenReel?: (reel: Reel) => void;
  initialUrl?: string;
  folders: Folder[];
  currentSelectedFolderId?: string | null;
  defaultMediaType?: 'reel' | 'video';
}

export const AddReelModal: React.FC<AddReelModalProps> = ({
  isOpen,
  onClose,
  onReelAdded,
  onOpenReel,
  initialUrl = '',
  folders,
  currentSelectedFolderId,
  defaultMediaType,
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'auto' | 'reel' | 'video'>('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [duplicateReel, setDuplicateReel] = useState<Reel | null>(null);

  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
    }
    setDuplicateReel(null);
  }, [initialUrl, isOpen]);

  useEffect(() => {
    if (defaultMediaType) {
      setMediaType(defaultMediaType);
    } else {
      setMediaType('auto');
    }
  }, [defaultMediaType, isOpen]);

  useEffect(() => {
    if (currentSelectedFolderId && currentSelectedFolderId !== 'unassigned') {
      setFolderId(currentSelectedFolderId);
    } else {
      setFolderId(null);
    }
  }, [currentSelectedFolderId, isOpen]);

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

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(extractUrlFromText(text));
      }
    } catch (err) {
      console.warn('No se pudo acceder al portapapeles:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    
    if (mediaType === 'video') {
      setLoadingStep('Extrayendo metadatos y descripción...');
    } else {
      setLoadingStep('Extrayendo información del vídeo...');
    }

    const timer1 = setTimeout(() => {
      setLoadingStep('Generando resumen con Gemini...');
    }, 2200);

    const timer2 = setTimeout(() => {
      setLoadingStep('Extrayendo herramientas, temas y pasos clave...');
    }, 4500);

    try {
      const newReel = await analyzeReel(url.trim(), folderId, mediaType);
      clearTimeout(timer1);
      clearTimeout(timer2);

      if (newReel.is_duplicate) {
        setDuplicateReel(newReel);
        return;
      }

      onReelAdded(newReel);
      setUrl('');
      onClose();
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setError(err.message || 'Error al procesar el enlace');
    } finally {
      setLoading(false);
      setLoadingStep('');
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

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-modal-title"
    >
      <div 
        className="w-full max-w-lg bg-claude-surface border border-claude-border rounded-3xl shadow-2xl p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={loading}
          aria-label="Cerrar modal"
          className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-xl text-claude-textMuted hover:text-claude-text hover:bg-claude-bg transition-colors disabled:opacity-40"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header estilo Claude */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-claude-bg border border-claude-border flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5 text-claude-accent" />
          </div>
          <div>
            <h3 id="add-modal-title" className="text-xl font-heading font-medium text-claude-text">
              Guardar Contenido
            </h3>
            <p className="text-xs text-claude-textMuted">
              Guarda reels cortos o vídeos largos de YouTube y redes sociales
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5 font-sans">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        {duplicateReel ? (
          <div className="py-2 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 rounded-2xl bg-claude-accentSubtle border border-claude-accentBorder space-y-3">
              <div className="flex items-center gap-2.5 text-claude-accent">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <h4 className="font-heading font-semibold text-sm text-claude-text">
                  ¡Este contenido ya estaba en tu biblioteca!
                </h4>
              </div>

              <div className="p-3 rounded-xl bg-claude-surface border border-claude-border text-xs space-y-1.5">
                <div className="font-serif font-medium text-sm text-claude-text line-clamp-2">
                  {duplicateReel.title}
                </div>
                <div className="flex items-center gap-2 text-claude-textMuted text-[11px] font-sans">
                  <span className="flex items-center gap-1">
                    <FolderIcon className="w-3 h-3 text-claude-accent" />
                    <span>{duplicateReel.folder_name || 'Sin carpeta asignada'}</span>
                  </span>
                  <span>•</span>
                  <span>Guardado el {new Date(duplicateReel.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <p className="text-xs text-claude-textMuted font-sans">
                Para evitar duplicados en tu base de datos SQLite homelab, se ha detectado el enlace existente. Puedes abrir su ficha técnica ahora o cerrar esta ventana.
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              {onOpenReel && (
                <button
                  type="button"
                  onClick={() => {
                    const reelToOpen = duplicateReel;
                    onClose();
                    onOpenReel(reelToOpen);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-claude-accent hover:bg-claude-accentHover text-white text-xs font-semibold shadow-sm transition-all"
                >
                  <span>Ver ficha guardada</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setDuplicateReel(null);
                  setUrl('');
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl bg-claude-surface hover:bg-claude-bg text-claude-text border border-claude-border text-xs font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-2 border-claude-accent/20 border-t-claude-accent animate-spin" />
              <Sparkles className="w-5 h-5 text-claude-accent absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-heading font-medium text-claude-text">
                Procesando con Inteligencia Artificial
              </h4>
              <p className="text-xs text-claude-accent font-mono animate-pulse">
                {loadingStep}
              </p>
            </div>
            <p className="text-[11px] text-claude-textMuted max-w-xs font-sans">
              {mediaType === 'video' 
                ? 'Sintetizando la descripción del vídeo con mínimo consumo de tokens.' 
                : 'Analizando el contenido para extraer herramientas, prompts y pasos clave.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Selector de Tipo / Apartado */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-claude-text flex items-center justify-between">
                <span>Tipo de contenido:</span>
                <span className="text-[11px] text-claude-textMuted font-mono">
                  {mediaType === 'video' ? 'Solo enlace + resumen' : mediaType === 'reel' ? 'Vídeo + lectura OCR de prompts' : 'Detección automática'}
                </span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMediaType('auto')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                    mediaType === 'auto'
                      ? 'border-claude-accent bg-claude-accentSubtle text-claude-text ring-1 ring-claude-accent'
                      : 'border-claude-border bg-claude-bg/60 text-claude-textMuted hover:text-claude-text hover:bg-claude-bg'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Auto</span>
                  </div>
                  <span className="text-[10px] leading-tight text-claude-textMuted line-clamp-1">
                    Según duración
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMediaType('reel')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                    mediaType === 'reel'
                      ? 'border-claude-accent bg-claude-accentSubtle text-claude-text ring-1 ring-claude-accent'
                      : 'border-claude-border bg-claude-bg/60 text-claude-textMuted hover:text-claude-text hover:bg-claude-bg'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Smartphone className="w-3.5 h-3.5 text-claude-accent" />
                    <span>Reel</span>
                  </div>
                  <span className="text-[10px] leading-tight text-claude-textMuted line-clamp-1">
                    &lt; 10m (Vídeo+OCR)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMediaType('video')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                    mediaType === 'video'
                      ? 'border-claude-accent bg-claude-accentSubtle text-claude-text ring-1 ring-claude-accent'
                      : 'border-claude-border bg-claude-bg/60 text-claude-textMuted hover:text-claude-text hover:bg-claude-bg'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Film className="w-3.5 h-3.5 text-blue-400" />
                    <span>Vídeo</span>
                  </div>
                  <span className="text-[10px] leading-tight text-claude-textMuted line-clamp-1">
                    &gt; 10 min (Enlace)
                  </span>
                </button>
              </div>
            </div>

            {/* Input URL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-claude-text">
                <label htmlFor="reel-url">Enlace del vídeo</label>
                <button
                  type="button"
                  onClick={handlePaste}
                  className="flex items-center gap-1 text-claude-accent hover:text-claude-accentHover text-[11px] font-medium"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Pegar del portapapeles</span>
                </button>
              </div>

              <div className="relative">
                <LinkIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-claude-textMuted" />
                <input
                  id="reel-url"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text');
                    if (pasted && (pasted.includes('http://') || pasted.includes('https://'))) {
                      e.preventDefault();
                      setUrl(extractUrlFromText(pasted));
                    }
                  }}
                  placeholder={
                    mediaType === 'video'
                      ? 'https://www.youtube.com/watch?v=...'
                      : 'https://www.tiktok.com/@... o https://www.instagram.com/reel/...'
                  }
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-claude-bg border border-claude-border text-sm text-claude-text placeholder-claude-textMuted/50 focus:outline-none focus:border-claude-accent transition-all font-sans"
                />
              </div>
            </div>

            {/* Selector de Carpeta */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-claude-text flex items-center gap-1.5">
                <FolderIcon className="w-3.5 h-3.5 text-claude-textMuted" />
                <span>Guardar en tema / carpeta (opcional)</span>
              </label>
              <select
                value={folderId || ''}
                onChange={(e) => setFolderId(e.target.value ? e.target.value : null)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-claude-bg border border-claude-border text-xs text-claude-text focus:outline-none focus:border-claude-accent cursor-pointer"
              >
                <option value="" className="bg-claude-surface text-claude-textMuted">📥 Sin clasificar (Inbox)</option>
                {folderOptions.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-claude-surface text-claude-text">
                    {'— '.repeat(opt.level) + `${opt.icon} ${opt.name}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Banner explicativo para vídeos largos */}
            <div className="p-3 rounded-2xl bg-claude-bg border border-claude-border text-[11px] text-claude-textMuted flex items-start gap-2.5 font-sans leading-relaxed">
              <Info className="w-4 h-4 text-claude-accent flex-shrink-0 mt-0.5" />
              <div>
                <strong>Ahorro de espacio & tokens:</strong> Los vídeos de más de 10 minutos se guardan como enlace directo sin descargar archivos multimedia en tu servidor, resumiendo su contenido con el modelo de texto más eficiente.
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-claude-textMuted hover:text-claude-text transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!url.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-claude-accent hover:bg-claude-accentHover text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Guardar Contenido</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
