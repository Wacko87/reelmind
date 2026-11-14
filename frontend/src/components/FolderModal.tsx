import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Folder } from '../types';
import { createFolder, updateFolder } from '../api';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  folderToEdit?: Folder | null;
  defaultParentId?: string | null;
  availableFolders: Folder[];
}

const EMOJI_OPTIONS = ['📁', '💻', '🤖', '⚡', '🎨', '🎬', '🖼️', '⚙️', '🔄', '🔥', '💡', '🧠', '📊', '📝', '🚀', '🎯'];
const COLOR_OPTIONS = ['#cc785c', '#5b8266', '#3b82f6', '#d4cebe', '#e09f3e', '#9e988b', '#d9856a', '#4a473f'];

export const FolderModal: React.FC<FolderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  folderToEdit,
  defaultParentId,
  availableFolders,
}) => {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState('#cc785c');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (folderToEdit) {
      setName(folderToEdit.name);
      setParentId(folderToEdit.parent_id || null);
      setIcon(folderToEdit.icon || '📁');
      setColor(folderToEdit.color || '#cc785c');
    } else {
      setName('');
      setParentId(defaultParentId || null);
      setIcon('📁');
      setColor('#cc785c');
    }
    setError(null);
  }, [folderToEdit, defaultParentId, isOpen]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      if (folderToEdit) {
        await updateFolder(folderToEdit.id, {
          name: name.trim(),
          parent_id: parentId,
          icon,
          color,
        });
      } else {
        await createFolder({
          name: name.trim(),
          parent_id: parentId,
          icon,
          color,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar tema');
    } finally {
      setLoading(false);
    }
  };

  const flattenFolders = (folders: Folder[], level = 0): { id: string; name: string; level: number }[] => {
    let result: { id: string; name: string; level: number }[] = [];
    for (const f of folders) {
      if (folderToEdit && f.id === folderToEdit.id) continue;
      result.push({ id: f.id, name: f.name, level });
      if (f.children && f.children.length > 0) {
        result = result.concat(flattenFolders(f.children, level + 1));
      }
    }
    return result;
  };

  const folderOptions = flattenFolders(availableFolders);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="w-full max-w-md bg-claude-surface border border-claude-border rounded-3xl shadow-2xl p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar modal"
          className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-xl text-claude-textMuted hover:text-claude-text hover:bg-claude-bg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5 mb-5">
          <div 
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-sm bg-claude-bg border border-claude-border"
          >
            {icon}
          </div>
          <div>
            <h3 className="text-xl font-serif font-medium text-claude-text">
              {folderToEdit ? 'Editar Tema' : parentId ? 'Nuevo Subtema' : 'Nuevo Tema'}
            </h3>
            <p className="text-xs text-claude-textMuted">
              Organiza tus vídeos por disciplinas y áreas de IA
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 text-rose-300 text-xs border border-rose-500/20 font-sans">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-claude-text">
              Nombre
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Agentes Autónomos, Modelos de Lenguaje..."
              required
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl bg-claude-bg border border-claude-border text-sm text-claude-text placeholder-claude-textMuted/50 focus:outline-none focus:border-claude-accent font-sans"
            />
          </div>

          {/* Carpeta Padre */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-claude-text">
              Ubicación / Tema Superior
            </label>
            <select
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value ? e.target.value : null)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-claude-bg border border-claude-border text-xs text-claude-text focus:outline-none focus:border-claude-accent cursor-pointer"
            >
              <option value="">📂 Ninguno (Tema Principal)</option>
              {folderOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {'— '.repeat(opt.level) + opt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Icono */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-claude-text">
              Icono
            </label>
            <div className="grid grid-cols-8 gap-1.5">
              {EMOJI_OPTIONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setIcon(em)}
                  className={`p-2 rounded-xl text-lg flex items-center justify-center transition-all ${
                    icon === em
                      ? 'bg-claude-accentSubtle border border-claude-accent text-white scale-105'
                      : 'bg-claude-bg border border-claude-border hover:bg-[#282724]'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-claude-textMuted hover:text-claude-text"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="px-5 py-2 rounded-xl bg-claude-accent hover:bg-claude-accentHover text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-40"
            >
              {loading ? 'Guardando...' : folderToEdit ? 'Actualizar' : 'Crear Tema'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
