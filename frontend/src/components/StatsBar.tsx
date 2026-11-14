import React from 'react';
import { Stats } from '../types';
import { Layers, Clock, CheckCircle2, Star, Cpu } from 'lucide-react';

interface StatsBarProps {
  stats: Stats | null;
  selectedTool: string;
  onSelectTool: (tool: string) => void;
  statusFilter: string;
  onSelectStatus: (status: string) => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  stats,
  selectedTool,
  onSelectTool,
  statusFilter,
  onSelectStatus,
}) => {
  if (!stats) return null;

  const statItems = [
    {
      id: '',
      label: 'Todos',
      count: stats.total,
      icon: Layers,
      activeColor: 'bg-claude-surface text-claude-text border-claude-border shadow-sm',
    },
    {
      id: 'pending',
      label: 'Por probar',
      count: stats.pending,
      icon: Clock,
      activeColor: 'bg-claude-surface text-amber-300 border-amber-500/40',
    },
    {
      id: 'tested',
      label: 'Probados',
      count: stats.tested,
      icon: CheckCircle2,
      activeColor: 'bg-claude-surface text-emerald-400 border-emerald-500/40',
    },
    {
      id: 'favorite',
      label: 'Favoritos',
      count: stats.favorite,
      icon: Star,
      activeColor: 'bg-claude-surface text-claude-accent border-claude-accent',
    },
  ];

  return (
    <div className="space-y-4 mb-6">
      {/* Contadores sobrios estilo Claude */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
        {statItems.map((item) => {
          const Icon = item.icon;
          const isActive = statusFilter === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectStatus(item.id)}
              className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left ${
                isActive
                  ? item.activeColor
                  : 'bg-claude-surface/50 hover:bg-claude-surface border-claude-border text-claude-textMuted'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-claude-bg border border-claude-border text-claude-textMuted">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs text-claude-textMuted font-sans">{item.label}</div>
                  <div className="text-lg font-serif font-semibold text-claude-text tracking-tight">{item.count}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Herramientas de IA detectadas más populares */}
      {stats.top_tools.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          <div className="flex items-center gap-1 text-claude-textMuted font-mono text-[11px] uppercase whitespace-nowrap pl-0.5">
            <Cpu className="w-3.5 h-3.5 text-claude-accent" />
            <span>Modelos & Apps:</span>
          </div>

          {stats.top_tools.map((tool) => {
            const isSelected = selectedTool.toLowerCase() === tool.name.toLowerCase();
            return (
              <button
                key={tool.name}
                onClick={() => onSelectTool(isSelected ? '' : tool.name)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-claude-accent text-white font-medium shadow-sm'
                    : 'bg-claude-surface hover:bg-[#282724] text-claude-text border border-claude-border'
                }`}
              >
                <span>{tool.name}</span>
                <span className={`text-[10px] font-mono px-1 rounded-full ${isSelected ? 'bg-black/20 text-white' : 'text-claude-textMuted'}`}>
                  {tool.count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
