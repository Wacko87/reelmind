import React, { useState, useMemo } from 'react';
import { 
  Terminal, 
  Copy, 
  Check, 
  Search, 
  X, 
  Sparkles, 
  Wand2, 
  ExternalLink,
  Cpu,
  Loader2,
  Folder as FolderIcon
} from 'lucide-react';
import { Reel, PromptVariation } from '../types';
import { optimizePrompt } from '../api';

interface PromptVaultViewProps {
  reels: Reel[];
  onOpenReel: (reel: Reel) => void;
}

interface ExtractedPromptItem {
  id: string;
  promptText: string;
  reel: Reel;
  promptIndex: number;
  tool: string;
}

export const PromptVaultView: React.FC<PromptVaultViewProps> = ({
  reels,
  onOpenReel,
}) => {
  const [search, setSearch] = useState('');
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Estados de optimización inline
  const [activeOptId, setActiveOptId] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optMode, setOptMode] = useState<'variations' | 'adapt_model'>('variations');
  const [targetEngine, setTargetEngine] = useState('Midjourney v6.1');
  const [optResults, setOptResults] = useState<{ [id: string]: PromptVariation[] }>({});
  const [optError, setOptError] = useState<string | null>(null);
  const [copiedOptKey, setCopiedOptKey] = useState<string | null>(null);

  // Extraer todos los prompts individuales con sus metadatos
  const allPrompts: ExtractedPromptItem[] = useMemo(() => {
    const list: ExtractedPromptItem[] = [];
    for (const reel of reels) {
      if (reel.prompts && reel.prompts.length > 0) {
        const primaryTool = reel.ai_tools && reel.ai_tools.length > 0 ? reel.ai_tools[0] : 'General';
        reel.prompts.forEach((p, idx) => {
          list.push({
            id: `${reel.id}_${idx}`,
            promptText: p,
            reel,
            promptIndex: idx + 1,
            tool: primaryTool,
          });
        });
      }
    }
    return list;
  }, [reels]);

  // Lista de herramientas únicas para filtros
  const uniqueTools = useMemo(() => {
    const set = new Set<string>();
    allPrompts.forEach(p => {
      if (p.tool) set.add(p.tool);
    });
    return Array.from(set).slice(0, 10);
  }, [allPrompts]);

  // Filtrado reactivo
  const filteredPrompts = useMemo(() => {
    return allPrompts.filter(item => {
      if (selectedTool && item.tool.toLowerCase() !== selectedTool.toLowerCase()) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesPrompt = item.promptText.toLowerCase().includes(q);
        const matchesTitle = item.reel.title.toLowerCase().includes(q);
        const matchesTools = item.reel.ai_tools.some(t => t.toLowerCase().includes(q));
        if (!matchesPrompt && !matchesTitle && !matchesTools) return false;
      }
      return true;
    });
  }, [allPrompts, search, selectedTool]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleRunOptimizer = async (promptItem: ExtractedPromptItem) => {
    setOptimizing(true);
    setOptError(null);
    try {
      const res = await optimizePrompt(
        promptItem.promptText,
        optMode,
        optMode === 'adapt_model' ? targetEngine : undefined
      );
      setOptResults(prev => ({
        ...prev,
        [promptItem.id]: res.variations
      }));
    } catch (err: any) {
      setOptError(err.message || 'Error al generar variaciones');
    } finally {
      setOptimizing(false);
    }
  };

  const handleCopyVariation = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOptKey(key);
    setTimeout(() => setCopiedOptKey(null), 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Barra de cabecera y búsqueda de prompts */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-claude-textMuted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en todos los prompts extraídos..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-claude-surface border border-claude-border text-sm text-claude-text placeholder-claude-textMuted/60 focus:outline-none focus:border-claude-accent transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-claude-textMuted hover:text-claude-text"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="text-xs font-mono text-claude-textMuted px-1">
          Total: <strong className="text-claude-accent font-semibold">{filteredPrompts.length}</strong> prompts
        </div>
      </div>

      {/* Chips de filtro por herramienta */}
      {uniqueTools.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setSelectedTool('')}
            className={`px-3 py-1 rounded-full font-medium transition-all whitespace-nowrap ${
              selectedTool === ''
                ? 'bg-claude-text text-claude-bg font-semibold'
                : 'bg-claude-surface text-claude-textMuted hover:text-claude-text border border-claude-border'
            }`}
          >
            Todas las herramientas
          </button>
          {uniqueTools.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedTool(selectedTool === t ? '' : t)}
              className={`px-3 py-1 rounded-full font-medium transition-all whitespace-nowrap ${
                selectedTool === t
                  ? 'bg-claude-accent text-white font-semibold'
                  : 'bg-claude-surface text-claude-textMuted hover:text-claude-text border border-claude-border'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Lista de Prompts estilo Cheatsheet */}
      {filteredPrompts.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-claude-surface/30 rounded-3xl border border-claude-border">
          <Terminal className="w-8 h-8 text-claude-textMuted/40 mx-auto" />
          <p className="text-sm font-heading text-claude-text">
            No se encontraron prompts con los filtros actuales
          </p>
          <p className="text-xs text-claude-textMuted max-w-sm mx-auto font-sans">
            Guarda reels con prompts sobreimpresos o fórmulas de IA para que aparezcan aquí automáticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPrompts.map((item) => {
            const isCopied = copiedKey === item.id;
            const isOptOpen = activeOptId === item.id;
            const variations = optResults[item.id] || [];

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-2xl bg-[#141413] border border-claude-border overflow-hidden transition-all hover:border-claude-accentBorder group"
              >
                {/* Cabecera del prompt */}
                <div className="p-3.5 bg-claude-bg border-b border-claude-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-claude-accentSubtle text-claude-accent border border-claude-accentBorder whitespace-nowrap">
                      {item.tool}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenReel(item.reel)}
                      className="text-xs font-serif font-medium text-claude-text hover:text-claude-accent transition-colors truncate text-left"
                      title={item.reel.title}
                    >
                      {item.reel.title}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Botón Optimizar */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveOptId(isOptOpen ? null : item.id);
                        setOptError(null);
                      }}
                      className={`p-1.5 rounded-lg text-xs font-sans transition-all ${
                        isOptOpen
                          ? 'bg-claude-accent text-white'
                          : 'bg-claude-surface hover:bg-[#282724] text-claude-accent border border-claude-accentBorder'
                      }`}
                      title="Generar 3 variaciones o adaptar motor con IA"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>

                    {/* Botón Copiar */}
                    <button
                      type="button"
                      onClick={() => handleCopy(item.promptText, item.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-sans transition-all ${
                        isCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-claude-surface hover:bg-[#282724] text-claude-text border border-claude-border'
                      }`}
                      title="Copiar prompt al portapapeles"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span className="text-[11px]">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span className="text-[11px]">Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Texto del Prompt */}
                <pre className="p-4 text-xs font-mono text-claude-text whitespace-pre-wrap leading-relaxed select-all flex-1">
                  {item.promptText}
                </pre>

                {/* Drawer de optimización con Gemini */}
                {isOptOpen && (
                  <div className="p-3.5 border-t border-claude-border bg-claude-surface/60 space-y-3 animate-in fade-in duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-claude-accent font-semibold">
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>Optimizar Prompt</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={optMode}
                          onChange={(e) => setOptMode(e.target.value as any)}
                          className="px-2 py-1 rounded-lg bg-claude-bg border border-claude-border text-[11px] text-claude-text focus:outline-none"
                        >
                          <option value="variations">3 Estilos Creativos</option>
                          <option value="adapt_model">Adaptar a Motor</option>
                        </select>

                        {optMode === 'adapt_model' && (
                          <select
                            value={targetEngine}
                            onChange={(e) => setTargetEngine(e.target.value)}
                            className="px-2 py-1 rounded-lg bg-claude-bg border border-claude-border text-[11px] text-claude-text focus:outline-none"
                          >
                            <option value="Midjourney v6.1">Midjourney v6.1</option>
                            <option value="Flux 1.1 Pro">Flux 1.1 Pro</option>
                            <option value="DALL-E 3">DALL-E 3</option>
                            <option value="Claude 3.7 / ChatGPT">Claude / ChatGPT</option>
                          </select>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRunOptimizer(item)}
                          disabled={optimizing}
                          className="px-3 py-1 rounded-lg bg-claude-accent hover:bg-claude-accentHover text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1"
                        >
                          {optimizing ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Generando...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3" />
                              <span>Generar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {optError && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-300 text-xs font-sans">
                        {optError}
                      </div>
                    )}

                    {variations.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {variations.map((v, vIdx) => {
                          const subKey = `${item.id}_${vIdx}`;
                          const isSubCopied = copiedOptKey === subKey;
                          return (
                            <div key={vIdx} className="p-2.5 rounded-xl bg-claude-bg border border-claude-border space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-claude-accentSubtle text-claude-accent border border-claude-accentBorder">
                                  {v.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyVariation(v.prompt, subKey)}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-all ${
                                    isSubCopied ? 'bg-emerald-600 text-white' : 'bg-claude-surface text-claude-text border border-claude-border'
                                  }`}
                                >
                                  {isSubCopied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                                  <span>{isSubCopied ? 'Copiado' : 'Copiar'}</span>
                                </button>
                              </div>
                              <pre className="text-[11px] font-mono text-claude-text whitespace-pre-wrap select-all leading-relaxed">
                                {v.prompt}
                              </pre>
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
      )}

    </div>
  );
};
