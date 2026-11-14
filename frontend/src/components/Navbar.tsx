import React from 'react';
import { Sparkles, Plus, Settings, ClipboardPaste, FolderTree, LogOut } from 'lucide-react';
import { AppSettings } from '../types';

interface NavbarProps {
  onOpenAddModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenAskVault?: () => void;
  onPasteFromClipboard: () => void;
  onToggleSidebarMobile: () => void;
  onLogout?: () => void;
  authRequired?: boolean;
  settings: AppSettings | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAddModal,
  onOpenSettingsModal,
  onOpenAskVault,
  onPasteFromClipboard,
  onToggleSidebarMobile,
  onLogout,
  authRequired,
  settings,
}) => {
  return (
    <header className="sticky top-0 z-30 claude-glass border-b border-claude-border w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-4">
        
        {/* Brand & Mobile Sidebar Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          
          <button
            onClick={onToggleSidebarMobile}
            className="lg:hidden p-1.5 sm:p-2 rounded-xl text-claude-textMuted hover:text-claude-text hover:bg-claude-surface transition-colors flex-shrink-0"
            title="Abrir carpetas"
          >
            <FolderTree className="w-5 h-5 text-claude-accent" />
          </button>

          {/* Official Neural Reel Icon */}
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-claude-surface border border-claude-border flex items-center justify-center shadow-sm overflow-hidden p-1 flex-shrink-0">
            <img src="/icons/icon.svg" alt="ReelMind" className="w-full h-full object-contain" />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-lg sm:text-xl md:text-2xl font-serif font-bold tracking-tight text-claude-text truncate">
              ReelMind
            </span>
            <span className="hidden sm:inline-flex text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-claude-accentSubtle text-claude-accent border border-claude-accentBorder flex-shrink-0">
              Vault
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          
          {/* Indicador estado Gemini */}
          <button
            onClick={onOpenSettingsModal}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              settings?.has_gemini_key
                ? 'bg-claude-surface text-claude-text border border-claude-border hover:border-claude-accent'
                : 'bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse'
            }`}
            title="Configuración de IA Gemini"
          >
            <div className={`w-1.5 h-1.5 rounded-full ${settings?.has_gemini_key ? 'bg-claude-accent' : 'bg-amber-400'}`} />
            <span className="text-xs text-claude-textMuted">{settings?.has_gemini_key ? 'Gemini IA' : 'Configurar Clave'}</span>
          </button>

          {/* Botón Preguntar a la Bóveda con IA */}
          {onOpenAskVault && (
            <button
              onClick={onOpenAskVault}
              className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium bg-claude-surface hover:bg-claude-elevated text-claude-accent border border-claude-accentBorder transition-all active:scale-95 shadow-sm"
              title="Preguntar a la Bóveda con IA Gemini"
            >
              <Sparkles className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden md:inline">Preguntar IA</span>
            </button>
          )}

          {/* Pegar rápido de portapapeles */}
          <button
            onClick={onPasteFromClipboard}
            className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium bg-claude-surface hover:bg-[#2a2925] text-claude-text border border-claude-border transition-all active:scale-95"
            title="Pegar enlace del portapapeles"
          >
            <ClipboardPaste className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-claude-accent" />
            <span className="hidden md:inline">Pegar enlace</span>
          </button>

          {/* Botón Añadir Reel en tono Terracota de Claude */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 p-2 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold bg-claude-accent hover:bg-claude-accentHover text-white shadow-sm transition-all active:scale-95"
            title="Guardar nuevo reel o vídeo"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Guardar</span>
          </button>

          {/* Botón Ajustes */}
          <button
            onClick={onOpenSettingsModal}
            className="p-2 rounded-xl text-claude-textMuted hover:text-claude-text hover:bg-claude-surface transition-all"
            title="Ajustes y Temas"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Botón Cerrar Sesión */}
          {authRequired && onLogout && (
            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-claude-textMuted hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              title="Bloquear sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
