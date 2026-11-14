import React, { useState, useEffect } from 'react';
import { Search, X, Tag as TagIcon, Clock } from 'lucide-react';
import { Stats } from '../types';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  selectedTool: string;
  selectedTime?: string;
  onSelectTime?: (time: string) => void;
  onClearFilters: () => void;
  stats: Stats | null;
}

const TIME_FILTERS = [
  { label: '⚡ < 5 min', value: '< 5 min' },
  { label: '⏱️ 15-30 min', value: '15-30 min' },
  { label: '⏳ > 1 hora', value: '> 1 hora' },
];

export const FilterBar: React.FC<FilterBarProps> = React.memo(({
  searchQuery,
  onSearchChange,
  selectedTag,
  onSelectTag,
  selectedTool,
  selectedTime = '',
  onSelectTime,
  onClearFilters,
  stats,
}) => {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        onSearchChange(localSearch);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, onSearchChange]);

  const hasActiveFilters = Boolean(searchQuery || selectedTag || selectedTool || selectedTime);

  return (
    <div className="flex flex-col gap-3 mb-6">
      
      {/* Search Input & Time Chips */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-claude-textMuted" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Buscar trucos, prompts, modelos o creadores..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-claude-surface border border-claude-border text-sm text-claude-text placeholder-claude-textMuted/60 focus:outline-none focus:border-claude-accent transition-all"
          />
          {localSearch && (
            <button
              onClick={() => {
                setLocalSearch('');
                onSearchChange('');
              }}
              aria-label="Borrar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-claude-textMuted hover:text-claude-text"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filtro por Tiempo Estimado */}
        {onSelectTime && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {TIME_FILTERS.map((tf) => {
              const isSelected = selectedTime === tf.value;
              return (
                <button
                  key={tf.value}
                  type="button"
                  onClick={() => onSelectTime(isSelected ? '' : tf.value)}
                  className={`text-xs px-3 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-claude-accent text-white font-semibold shadow-sm'
                      : 'bg-claude-surface hover:bg-[#282724] text-claude-textMuted hover:text-claude-text border border-claude-border'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tags Selector Pills & Clear Filters */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
        {stats && stats.top_tags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1 text-claude-textMuted text-xs px-1">
              <TagIcon className="w-3.5 h-3.5" />
            </div>
            {stats.top_tags.slice(0, 6).map((tag) => {
              const isSelected = selectedTag.toLowerCase() === tag.name.toLowerCase();
              return (
                <button
                  key={tag.name}
                  onClick={() => onSelectTag(isSelected ? '' : tag.name)}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-claude-text text-claude-bg font-semibold shadow-sm'
                      : 'bg-claude-surface hover:bg-[#282724] text-claude-textMuted hover:text-claude-text border border-claude-border'
                  }`}
                >
                  #{tag.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-claude-accent hover:text-claude-accentHover bg-claude-accentSubtle border border-claude-accentBorder rounded-xl transition-all whitespace-nowrap ml-auto"
          >
            <X className="w-3.5 h-3.5" />
            <span>Limpiar filtros</span>
          </button>
        )}
      </div>

    </div>
  );
});
