import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Palette, 
  Sparkles, 
  CheckCircle2, 
  Type,
  FileDown,
  Bookmark,
  Copy,
  FolderTree,
  Loader2,
  FolderArchive
} from 'lucide-react';
import { AppSettings } from '../types';
import { saveSettings, downloadVaultZip } from '../api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings | null;
  onSettingsSaved: () => void;
}

interface ThemeConfig {
  id: string;
  name: string;
  brand: string;
  description: string;
  fontName: string;
  bgHex: string;
  surfaceHex: string;
  accentHex: string;
  borderHex: string;
  sampleText: string;
}

const THEMES: ThemeConfig[] = [
  {
    id: 'claude',
    name: 'Claude',
    brand: 'Anthropic',
    description: 'Estilo editorial cálido, terracota suave y tipografía Newsreader Serif.',
    fontName: 'Newsreader Serif',
    bgHex: '#181816',
    surfaceHex: '#22211e',
    accentHex: '#cc785c',
    borderHex: '#36342e',
    sampleText: 'Editorial & Inteligencia reflexiva',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    brand: 'Google DeepMind',
    description: 'Azul cósmico espacial, geometría limpia y estética cuántica moderna.',
    fontName: 'Plus Jakarta Sans',
    bgHex: '#0b0f19',
    surfaceHex: '#131929',
    accentHex: '#4285f4',
    borderHex: '#23304d',
    sampleText: 'Multimodalidad y razonamiento veloz',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    brand: 'OpenAI',
    description: 'Carbón neutro minimalista, contraste equilibrado y verde esmeralda icónico.',
    fontName: 'Inter Sans',
    bgHex: '#171717',
    surfaceHex: '#212121',
    accentHex: '#10a37f',
    borderHex: '#383838',
    sampleText: 'Conversación directa y respuesta precisa',
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    brand: 'Tactical / Cyber',
    description: 'Negro azabache táctico de alto impacto con acentos carmesí neón.',
    fontName: 'Plus Jakarta Sans',
    bgHex: '#090a0d',
    surfaceHex: '#14161f',
    accentHex: '#ff2a55',
    borderHex: '#2e3347',
    sampleText: 'Agentes autónomos en tiempo real',
  },
  {
    id: 'hermes',
    name: 'Hermes Agent',
    brand: 'Nous Research',
    description: 'Consola de ciber-inteligencia, acentos cobre ardiente y tipografía monospace.',
    fontName: 'JetBrains Mono',
    bgHex: '#080a0d',
    surfaceHex: '#11151b',
    accentHex: '#f97316',
    borderHex: '#252e3b',
    sampleText: 'Orquestación de herramientas & CLI',
  },
  {
    id: 'vercel',
    name: 'Vercel / v0',
    brand: 'Vercel & Next.js',
    description: 'Negro OLED absoluto, líneas hiperprecisas y azul cobalto de desarrollo.',
    fontName: 'Inter Sans',
    bgHex: '#000000',
    surfaceHex: '#0f0f0f',
    accentHex: '#0070f3',
    borderHex: '#282828',
    sampleText: 'Velocidad de despliegue al filo del borde',
  },
  {
    id: 'midjourney',
    name: 'Midjourney',
    brand: 'Generative Arts',
    description: 'Púrpura noche espacial, atmósfera inmersiva y destellos neón lavanda.',
    fontName: 'Plus Jakarta / Serif',
    bgHex: '#0c0915',
    surfaceHex: '#151025',
    accentHex: '#a855f7',
    borderHex: '#302452',
    sampleText: 'Imaginación sintética y creatividad visual',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'themes' | 'ai' | 'export' | 'bookmarklet'>('themes');
  const [currentTheme, setCurrentTheme] = useState<string>('claude');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de exportación y bookmarklet
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [zipSuccess, setZipSuccess] = useState(false);
  const [bookmarkletCopied, setBookmarkletCopied] = useState(false);

  // Cargar tema inicial
  useEffect(() => {
    const saved = localStorage.getItem('reelmind_theme') || 'claude';
    setCurrentTheme(saved);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, saving, onClose]);

  if (!isOpen) return null;

  const handleSelectTheme = (theme: ThemeConfig) => {
    setCurrentTheme(theme.id);
    document.documentElement.setAttribute('data-theme', theme.id);
    localStorage.setItem('reelmind_theme', theme.id);

    // Actualizar meta theme-color para navegadores móviles y Safari
    const meta = document.getElementById('theme-color-meta');
    if (meta) {
      meta.setAttribute('content', theme.bgHex);
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setSaving(true);
    setError(null);
    try {
      await saveSettings(apiKey.trim());
      setSavedSuccess(true);
      onSettingsSaved();
      setTimeout(() => {
        setSavedSuccess(false);
        setApiKey('');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="w-full max-w-2xl bg-claude-surface border border-claude-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative transition-colors duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del modal */}
        <div className="p-5 sm:p-6 pb-4 border-b border-claude-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-claude-bg border border-claude-border flex items-center justify-center text-claude-accent shadow-sm">
              {activeTab === 'themes' ? (
                <Palette className="w-5 h-5" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-heading font-semibold text-claude-text">
                Ajustes & Configuración
              </h3>
              <p className="text-xs text-claude-textMuted font-sans">
                Personaliza la apariencia y el motor de IA de ReelMind
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

        {/* Selector de pestañas */}
        <div className="px-5 sm:px-6 pt-3 flex gap-2 border-b border-claude-border bg-claude-bg/40 font-sans overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('themes')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'themes'
                ? 'border-claude-accent text-claude-accent bg-claude-surface'
                : 'border-transparent text-claude-textMuted hover:text-claude-text hover:bg-claude-surface/50'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Diseños ({THEMES.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'ai'
                ? 'border-claude-accent text-claude-accent bg-claude-surface'
                : 'border-transparent text-claude-textMuted hover:text-claude-text hover:bg-claude-surface/50'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Motor de IA</span>
            {settings?.has_gemini_key && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'export'
                ? 'border-claude-accent text-claude-accent bg-claude-surface'
                : 'border-transparent text-claude-textMuted hover:text-claude-text hover:bg-claude-surface/50'
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            <span>Obsidian (.zip)</span>
          </button>

          <button
            onClick={() => setActiveTab('bookmarklet')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'bookmarklet'
                ? 'border-claude-accent text-claude-accent bg-claude-surface'
                : 'border-transparent text-claude-textMuted hover:text-claude-text hover:bg-claude-surface/50'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Bookmarklet 1-Click</span>
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* ========================================================
              TAB: TEMAS Y DISEÑOS VISUALES
             ======================================================== */}
          {activeTab === 'themes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-claude-textMuted font-sans">
                <span>Selecciona el diseño característico que prefieras para la interfaz:</span>
                <span className="font-mono text-[11px] text-claude-accent">
                  Tema activo: <strong className="uppercase">{currentTheme}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {THEMES.map((theme) => {
                  const isSelected = currentTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => handleSelectTheme(theme)}
                      className={`text-left p-4 rounded-2xl transition-all duration-200 relative group flex flex-col justify-between border ${
                        isSelected
                          ? 'border-claude-accent ring-2 ring-claude-accent/30 shadow-lg'
                          : 'border-claude-border hover:border-claude-textMuted/40 hover:bg-claude-elevated'
                      }`}
                      style={{
                        backgroundColor: theme.surfaceHex,
                      }}
                    >
                      {/* Cabecera de la tarjeta del tema */}
                      <div className="w-full">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2.5">
                            {/* Pastilla con muestra de color */}
                            <div className="flex items-center -space-x-1.5">
                              <span 
                                className="w-4 h-4 rounded-full border border-black/40 shadow-sm inline-block"
                                style={{ backgroundColor: theme.bgHex }}
                                title="Color de fondo"
                              />
                              <span 
                                className="w-4 h-4 rounded-full border border-black/40 shadow-sm inline-block"
                                style={{ backgroundColor: theme.surfaceHex }}
                                title="Color de tarjetas"
                              />
                              <span 
                                className="w-4 h-4 rounded-full border border-black/40 shadow-sm inline-block z-10"
                                style={{ backgroundColor: theme.accentHex }}
                                title="Acento principal"
                              />
                            </div>

                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-sm text-white">
                                  {theme.name}
                                </span>
                                <span className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/10">
                                  {theme.brand}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Checkmark activo */}
                          {isSelected && (
                            <span 
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white shadow-sm flex-shrink-0"
                              style={{ backgroundColor: theme.accentHex }}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-zinc-400 font-sans line-clamp-2 leading-relaxed mb-3">
                          {theme.description}
                        </p>
                      </div>

                      {/* Muestra de tipografía & Badge inferior */}
                      <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] w-full text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <Type className="w-3.5 h-3.5" style={{ color: theme.accentHex }} />
                          <span className="font-mono text-[10px] truncate max-w-[130px]">
                            {theme.fontName}
                          </span>
                        </div>

                        <span 
                          className="font-medium text-[11px] px-2 py-0.5 rounded-full transition-colors"
                          style={{ 
                            color: theme.accentHex, 
                            backgroundColor: `${theme.accentHex}1a` 
                          }}
                        >
                          {isSelected ? 'Activo' : 'Aplicar'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-3.5 rounded-2xl bg-claude-bg border border-claude-border text-xs text-claude-textMuted flex items-center gap-2.5 font-sans">
                <CheckCircle2 className="w-4 h-4 text-claude-accent flex-shrink-0" />
                <span>
                  El tema seleccionado se guarda automáticamente en tu navegador y persiste entre sesiones.
                </span>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB: CONFIGURACIÓN DE IA & GEMINI
             ======================================================== */}
          {activeTab === 'ai' && (
            <div className="space-y-5">
              
              {/* Estado actual de la conexión */}
              <div className="p-4 rounded-2xl bg-claude-bg border border-claude-border space-y-3 font-sans">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-claude-textMuted">Estado de Gemini API:</span>
                  {settings?.has_gemini_key ? (
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <ShieldCheck className="w-4 h-4" /> Activa ({settings.masked_key})
                    </span>
                  ) : (
                    <span className="text-amber-400 font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      No configurada
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-claude-textMuted">Modelo multimodal asignado:</span>
                  <span className="text-claude-text font-mono bg-claude-surface px-2 py-0.5 rounded border border-claude-border text-[11px]">
                    {settings?.gemini_model || 'gemini-2.5-flash'}
                  </span>
                </div>

                <div className="text-[11px] text-claude-textMuted leading-relaxed pt-1 border-t border-claude-border">
                  El modelo <strong>Gemini 2.5 Flash</strong> procesa los vídeos descargados con su ventana de contexto de 1 millón de tokens para extraer transcripción, herramientas citadas, comandos, prompts e ideas accionables.
                </div>
              </div>

              {/* Formulario para cambiar API Key */}
              <form onSubmit={handleSaveApiKey} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-claude-text font-sans">
                    {settings?.has_gemini_key ? 'Actualizar Gemini API Key' : 'Introduce tu Gemini API Key'}
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-4 py-2.5 rounded-xl bg-claude-bg border border-claude-border text-sm text-claude-text placeholder-claude-textMuted/40 focus:outline-none focus:border-claude-accent font-sans transition-colors"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-claude-textMuted font-sans">
                  <span>¿Aún no tienes clave gratuita?</span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-claude-accent hover:text-claude-accentHover font-medium"
                  >
                    <span>Obtener en Google AI Studio</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-500/10 text-rose-300 text-xs border border-rose-500/20 font-sans">
                    {error}
                  </div>
                )}

                {savedSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-300 text-xs border border-emerald-500/20 flex items-center gap-2 font-sans">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Clave guardada con éxito en el almacén seguro</span>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2.5">
                  <button
                    type="submit"
                    disabled={!apiKey.trim() || saving}
                    className="px-5 py-2.5 rounded-xl bg-claude-accent hover:bg-claude-accentHover text-white text-xs font-semibold transition-all disabled:opacity-40 shadow-sm active:scale-95 flex items-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{saving ? 'Guardando...' : 'Guardar Clave de API'}</span>
                  </button>
                </div>
              </form>

            </div>
          )}

          {/* ========================================================
              TAB: EXPORTACIÓN OBSIDIAN & VAULT (.ZIP)
             ======================================================== */}
          {activeTab === 'export' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-claude-bg border border-claude-border space-y-3">
                <div className="flex items-center gap-2.5 text-claude-text">
                  <FolderArchive className="w-5 h-5 text-claude-accent" />
                  <h4 className="font-heading font-semibold text-sm">
                    Exportación de Bóveda para Obsidian
                  </h4>
                </div>
                <p className="text-xs text-claude-textMuted font-sans leading-relaxed">
                  Exporta todo tu catálogo de reels y vídeos a ficheros Markdown (<code className="text-claude-text font-mono">.md</code>) 
                  estructurados con encabezados YAML Frontmatter, resumen ejecutivo, herramientas, pasos y bloques de código de prompts.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs font-sans text-claude-textMuted">
                  <div className="p-3 rounded-xl bg-claude-surface border border-claude-border space-y-1">
                    <span className="font-semibold text-claude-text flex items-center gap-1">
                      <FolderTree className="w-3.5 h-3.5 text-claude-accent" />
                      <span>Jerarquía de Carpetas</span>
                    </span>
                    <p className="text-[11px]">
                      Las subcarpetas de ReelMind se preservan idénticas en el archivo ZIP.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-claude-surface border border-claude-border space-y-1">
                    <span className="font-semibold text-claude-text flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Índice con Wikilinks</span>
                    </span>
                    <p className="text-[11px]">
                      Incluye <code className="text-claude-text font-mono">Indice_Boveda.md</code> con enlaces <code className="text-claude-text font-mono">[[...]]</code> nativos.
                    </p>
                  </div>
                </div>
              </div>

              {zipSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-300 text-xs border border-emerald-500/20 flex items-center gap-2 font-sans">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>¡Bóveda empaquetada y descargada con éxito!</span>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-claude-surface border border-claude-border flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-claude-text">
                    Descargar Bóveda Completa
                  </div>
                  <div className="text-[11px] text-claude-textMuted font-sans mt-0.5">
                    Genera el archivo ZIP con todas las notas en tiempo real
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    setIsDownloadingZip(true);
                    setZipSuccess(false);
                    try {
                      await downloadVaultZip();
                      setZipSuccess(true);
                      setTimeout(() => setZipSuccess(false), 3000);
                    } catch (err) {
                      console.error('Error al descargar ZIP:', err);
                    } finally {
                      setIsDownloadingZip(false);
                    }
                  }}
                  disabled={isDownloadingZip}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-claude-accent hover:bg-claude-accentHover text-white text-xs font-semibold shadow-sm transition-all whitespace-nowrap disabled:opacity-50"
                >
                  {isDownloadingZip ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generando ZIP...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" />
                      <span>Descargar Bóveda (.ZIP)</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-[11px] text-claude-textMuted font-sans bg-claude-bg p-3.5 rounded-xl border border-claude-borderSubtle">
                💡 <strong>Tip para Homelab / Obsidian:</strong> Puedes descomprimir este archivo directamente en tu carpeta de Obsidian en Mac (<code className="text-claude-text font-mono">/Users/wacko87/Desktop/Proyectos Antigravity/Antigravity/</code>) para tener acceso offline total a tus trucos de IA.
              </div>
            </div>
          )}

          {/* ========================================================
              TAB: BOOKMARKLET 1-CLICK PARA NAVEGADORES (MAC)
             ======================================================== */}
          {activeTab === 'bookmarklet' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-claude-bg border border-claude-border space-y-2">
                <div className="flex items-center gap-2.5 text-claude-text">
                  <Bookmark className="w-5 h-5 text-claude-accent" />
                  <h4 className="font-heading font-semibold text-sm">
                    Bookmarklet 1-Click para Navegadores
                  </h4>
                </div>
                <p className="text-xs text-claude-textMuted font-sans leading-relaxed">
                  Guarda vídeos y reels en ReelMind directamente desde la barra de favoritos de Safari, Chrome, Arc o Edge en tu Mac sin tener que copiar y pegar enlaces manualmente.
                </p>
              </div>

              {/* Botón arrastrable estilo clásico de bookmarklets */}
              <div className="p-5 rounded-2xl bg-claude-surface border-2 border-dashed border-claude-accentBorder flex flex-col items-center justify-center text-center space-y-3">
                <span className="text-xs text-claude-textMuted font-sans">
                  Arrastra este botón a la <strong>Barra de Favoritos</strong> de tu navegador:
                </span>

                <a
                  href={`javascript:(function(){var u=window.location.href;var t='${window.location.origin}/?url='+encodeURIComponent(u);window.open(t,'_blank','width=560,height=740,location=no,toolbar=no,menubar=no,status=no');})();`}
                  onClick={(e) => {
                    // Evitar que al hacer clic en el modal ejecute el script local
                    e.preventDefault();
                    alert('Arrastra este botón directamente a la barra de marcadores de tu navegador (Safari / Chrome).');
                  }}
                  draggable="true"
                  className="px-6 py-3 rounded-2xl bg-claude-accent text-white font-semibold text-sm shadow-md hover:scale-105 active:scale-95 transition-all cursor-grab flex items-center gap-2 select-none"
                  title="Arrastra a la barra de marcadores"
                >
                  <Bookmark className="w-4 h-4 fill-white" />
                  <span>+ Guardar en ReelMind</span>
                </a>

                <span className="text-[11px] text-claude-textMuted font-mono">
                  (Arrastra y suelta en tu barra de marcadores)
                </span>
              </div>

              {/* Código manual por si el usuario prefiere crearlo a mano */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-claude-textMuted font-sans">
                  <span>O copia el código JavaScript del marcador:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const code = `javascript:(function(){var u=window.location.href;var t='${window.location.origin}/?url='+encodeURIComponent(u);window.open(t,'_blank','width=560,height=740,location=no,toolbar=no,menubar=no,status=no');})();`;
                      navigator.clipboard.writeText(code);
                      setBookmarkletCopied(true);
                      setTimeout(() => setBookmarkletCopied(false), 2000);
                    }}
                    className="flex items-center gap-1 text-claude-accent hover:text-claude-accentHover font-medium"
                  >
                    {bookmarkletCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Código</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-claude-bg border border-claude-border text-[11px] font-mono text-claude-textMuted break-all select-all">
                  {`javascript:(function(){var u=window.location.href;var t='${window.location.origin}/?url='+encodeURIComponent(u);window.open(t,'_blank','width=560,height=740,location=no,toolbar=no,menubar=no,status=no');})();`}
                </div>
              </div>

              {/* Instrucciones paso a paso */}
              <div className="p-4 rounded-xl bg-claude-surface border border-claude-border text-xs text-claude-textMuted font-sans space-y-2">
                <span className="font-semibold text-claude-text block">Cómo usarlo en Mac:</span>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-relaxed">
                  <li>Abre cualquier reel en Instagram, TikTok o tutorial en YouTube.</li>
                  <li>Haz clic en tu marcador <strong>"+ Guardar en ReelMind"</strong> en la barra superior.</li>
                  <li>Se abrirá una ventana emergente compacta con la URL precargada lista para analizar en 1 clic.</li>
                </ol>
              </div>
            </div>
          )}

        </div>

        {/* Footer del modal */}
        <div className="p-4 border-t border-claude-border bg-claude-bg/50 flex items-center justify-between font-sans">
          <span className="text-[11px] text-claude-textMuted">
            ReelMind v1.0.0
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-claude-surface hover:bg-claude-elevated text-claude-text border border-claude-border transition-colors"
          >
            Listo
          </button>
        </div>

      </div>
    </div>
  );
};
