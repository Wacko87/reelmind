import React, { useState } from 'react';
import { 
  Folder as FolderIcon, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Edit2, 
  Trash2, 
  Inbox, 
  Layers, 
  X,
  Smartphone,
  Film,
  Terminal,
  Image as ImageIcon
} from 'lucide-react';
import { Folder } from '../types';

interface SidebarFoldersProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onOpenCreateFolder: (parentId?: string | null) => void;
  onOpenEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folderId: string) => void;
  statusFilter: string;
  onSelectStatus: (status: string) => void;
  totalReels: number;
  unassignedCount: number;
  activeSection: 'reels' | 'videos' | 'images' | 'prompts';
  onSelectSection: (section: 'reels' | 'videos' | 'images' | 'prompts') => void;
  reelsCount?: number;
  videosCount?: number;
  imagesCount?: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const SidebarFolders: React.FC<SidebarFoldersProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onOpenCreateFolder,
  onOpenEditFolder,
  onDeleteFolder,
  statusFilter,
  onSelectStatus,
  totalReels,
  unassignedCount,
  activeSection,
  onSelectSection,
  reelsCount = 0,
  videosCount = 0,
  imagesCount = 0,
  isOpenMobile,
  onCloseMobile,
}) => {
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderFolderItem = (folder: Folder, level = 0) => {
    const isSelected = selectedFolderId === folder.id;
    const hasChildren = folder.children && folder.children.length > 0;
    const isCollapsed = collapsedMap[folder.id];

    return (
      <div key={folder.id} className="select-none">
        <div
          onClick={() => {
            onSelectFolder(folder.id);
            onCloseMobile();
          }}
          style={{ paddingLeft: `${10 + level * 14}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded-xl text-xs cursor-pointer transition-all ${
            isSelected
              ? 'bg-claude-surface text-claude-accent font-semibold border border-claude-border'
              : 'text-claude-textMuted hover:bg-claude-surface/60 hover:text-claude-text'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasChildren ? (
              <button
                onClick={(e) => toggleCollapse(folder.id, e)}
                className="p-0.5 text-claude-textMuted hover:text-claude-text transition-transform"
              >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-3.5 h-3.5" />
            )}

            <span className="text-sm">{folder.icon || '📁'}</span>
            <span className="truncate">{folder.name}</span>
          </div>

          <div className="flex items-center gap-1">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                isSelected
                  ? 'bg-claude-accentSubtle text-claude-accent'
                  : 'bg-claude-surface text-claude-textMuted group-hover:text-claude-text'
              }`}
            >
              {folder.total_reel_count}
            </span>

            {/* Acciones al hover */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity ml-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCreateFolder(folder.id);
                }}
                className="p-1 rounded hover:bg-claude-border text-claude-textMuted hover:text-claude-accent"
                title="Añadir subcarpeta"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEditFolder(folder);
                }}
                className="p-1 rounded hover:bg-claude-border text-claude-textMuted hover:text-claude-text"
                title="Editar carpeta"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`¿Eliminar carpeta "${folder.name}" y sus subcarpetas?`)) {
                    onDeleteFolder(folder.id);
                  }
                }}
                className="p-1 rounded hover:bg-claude-border text-claude-textMuted hover:text-rose-400"
                title="Eliminar carpeta"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Subcarpetas */}
        {hasChildren && !isCollapsed && (
          <div className="space-y-0.5 mt-0.5">
            {folder.children.map((child) => renderFolderItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const content = (
    <div className="flex flex-col h-full space-y-6">
      
      {/* Apartados: Reels vs Vídeos */}
      <div className="space-y-1">
        <div className="text-[11px] font-mono uppercase tracking-wider text-claude-textMuted px-3 mb-2 flex items-center justify-between">
          <span>Apartados</span>
        </div>

        <button
          onClick={() => {
            onSelectSection('reels');
            onCloseMobile();
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            activeSection === 'reels'
              ? 'bg-claude-accent text-white font-semibold shadow-sm'
              : 'text-claude-textMuted hover:bg-claude-surface/60 hover:text-claude-text'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-4 h-4" />
            <span>Reels (&lt; 10 min)</span>
          </div>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
            activeSection === 'reels' ? 'bg-black/20 text-white' : 'bg-claude-surface text-claude-textMuted'
          }`}>
            {reelsCount}
          </span>
        </button>

        <button
          onClick={() => {
            onSelectSection('videos');
            onCloseMobile();
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            activeSection === 'videos'
              ? 'bg-claude-accent text-white font-semibold shadow-sm'
              : 'text-claude-textMuted hover:bg-claude-surface/60 hover:text-claude-text'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Film className="w-4 h-4" />
            <span>Vídeos (&gt; 10 min)</span>
          </div>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
            activeSection === 'videos' ? 'bg-black/20 text-white' : 'bg-claude-surface text-claude-textMuted'
          }`}>
            {videosCount}
          </span>
        </button>

        <button
          onClick={() => {
            onSelectSection('images');
            onCloseMobile();
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            activeSection === 'images'
              ? 'bg-claude-accent text-white font-semibold shadow-sm'
              : 'text-claude-textMuted hover:bg-claude-surface/60 hover:text-claude-text'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ImageIcon className="w-4 h-4" />
            <span>Infografías & Prompts</span>
          </div>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
            activeSection === 'images' ? 'bg-black/20 text-white' : 'bg-claude-surface text-claude-textMuted'
          }`}>
            {imagesCount}
          </span>
        </button>

        <button
          onClick={() => {
            onSelectSection('prompts');
            onCloseMobile();
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            activeSection === 'prompts'
              ? 'bg-claude-accent text-white font-semibold shadow-sm'
              : 'text-claude-textMuted hover:bg-claude-surface/60 hover:text-claude-text'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4" />
            <span>Bóveda de Prompts</span>
          </div>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
            activeSection === 'prompts' ? 'bg-black/20 text-white' : 'bg-claude-surface text-claude-textMuted'
          }`}>
            ⚡
          </span>
        </button>
      </div>

      {/* Vistas Principales */}
      <div className="space-y-1">
        <div className="text-[11px] font-mono uppercase tracking-wider text-claude-textMuted px-3 mb-2">
          Filtrar
        </div>

        <button
          onClick={() => {
            onSelectFolder(null);
            onSelectStatus('');
            onCloseMobile();
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            selectedFolderId === null && statusFilter === ''
              ? 'bg-claude-surface text-claude-text font-semibold border border-claude-border'
              : 'text-claude-textMuted hover:bg-claude-surface/60 hover:text-claude-text'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-claude-accent" />
            <span>Todos los vídeos</span>
          </div>
          <span className="text-[10px] font-mono bg-claude-surface px-1.5 py-0.5 rounded-md text-claude-textMuted">
            {totalReels}
          </span>
        </button>

        <button
          onClick={() => {
            onSelectFolder('unassigned');
            onCloseMobile();
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            selectedFolderId === 'unassigned'
              ? 'bg-claude-surface text-claude-text font-semibold border border-claude-border'
              : 'text-claude-textMuted hover:bg-claude-surface/60 hover:text-claude-text'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Inbox className="w-4 h-4 text-claude-sand" />
            <span>Sin clasificar</span>
          </div>
          <span className="text-[10px] font-mono bg-claude-surface px-1.5 py-0.5 rounded-md text-claude-textMuted">
            {unassignedCount}
          </span>
        </button>
      </div>

      {/* Árbol de Carpetas */}
      <div className="flex-1 flex flex-col min-h-0 space-y-2">
        <div className="flex items-center justify-between px-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-claude-textMuted">
            Temas
          </span>
          <button
            onClick={() => onOpenCreateFolder(null)}
            className="flex items-center gap-1 text-[11px] text-claude-accent hover:text-claude-accentHover font-medium transition-colors"
            title="Crear nueva carpeta raíz"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nueva</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
          {folders.length > 0 ? (
            folders.map((folder) => renderFolderItem(folder))
          ) : (
            <div className="p-4 text-center rounded-2xl bg-claude-surface border border-claude-border space-y-2">
              <FolderIcon className="w-6 h-6 text-claude-textMuted mx-auto" />
              <p className="text-xs text-claude-textMuted">Sin temas organizados</p>
              <button
                onClick={() => onOpenCreateFolder(null)}
                className="text-xs text-claude-accent font-medium hover:underline"
              >
                + Crear primer tema
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );

  return (
    <>
      {/* Sidebar Desktop */}
      <aside className="hidden lg:block w-64 flex-shrink-0 border-r border-claude-border p-4 h-[calc(100vh-4rem)] sticky top-16 overflow-hidden bg-claude-bg">
        {content}
      </aside>

      {/* Drawer Mobile */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] bg-claude-bg border-r border-claude-border p-5 h-full z-50 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
            <div className="flex items-center justify-between pb-4 border-b border-claude-border mb-4">
              <span className="font-serif font-semibold text-base text-claude-text">Temas & Carpetas</span>
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-claude-textMuted hover:text-claude-text hover:bg-claude-surface cursor-pointer touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {content}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
