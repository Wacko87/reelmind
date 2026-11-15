import React, { useState } from 'react';
import { Reel } from '../types';
import { safeExternalUrl } from '../utils/security';
import { SmartThumbnailCover } from './SmartThumbnailCover';
import { 
  ExternalLink, 
  Star, 
  CheckCircle2, 
  Clock, 
  Terminal, 
  Sparkles,
  Play,
  Film,
  Folder as FolderIcon,
  Image as ImageIcon
} from 'lucide-react';

interface ReelCardProps {
  reel: Reel;
  onOpenDetail: (reel: Reel) => void;
  onToggleFavorite: (reel: Reel) => void;
  onToggleStatus: (reel: Reel) => void;
  onSelectTool: (tool: string) => void;
}

export const ReelCard: React.FC<ReelCardProps> = React.memo(({
  reel,
  onOpenDetail,
  onToggleFavorite,
  onToggleStatus,
  onSelectTool,
}) => {
  const isImage = reel.media_type === 'image';
  const [useOriginalPhoto, setUseOriginalPhoto] = useState(isImage);
  const isFavorite = reel.status === 'favorite';
  const isTested = reel.status === 'tested';
  const isLongVideo = reel.media_type === 'video' || (Boolean(reel.duration) && (reel.duration || 0) > 600);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPlatformBadge = (platform: string) => {
    switch (platform) {
      case 'tiktok':
        return { label: 'TikTok' };
      case 'instagram':
        return { label: 'Instagram' };
      case 'youtube':
        return { label: isLongVideo ? 'YouTube' : 'Shorts' };
      case 'facebook':
        return { label: 'Facebook' };
      case 'threads':
        return { label: 'Threads' };
      case 'pinterest':
        return { label: 'Pinterest' };
      case 'reddit':
        return { label: 'Reddit' };
      case 'upload':
        return { label: 'Subida' };
      default:
        return { label: 'Web' };
    }
  };

  const platformBadge = getPlatformBadge(reel.platform);
  const formattedDuration = formatDuration(reel.duration);

  return (
    <div className="group relative flex flex-col rounded-2xl claude-card overflow-hidden transition-all duration-300">
      
      {/* Thumbnail / Smart AI Cover Area */}
      <div 
        onClick={() => onOpenDetail(reel)}
        className="relative h-48 w-full bg-claude-surface cursor-pointer overflow-hidden border-b border-claude-borderSubtle"
      >
        {useOriginalPhoto && reel.thumbnail_url ? (
          <div className="relative w-full h-full">
            <img
              src={reel.thumbnail_url}
              alt={reel.title}
              className={`w-full h-full ${isImage ? 'object-contain bg-black/60' : 'object-cover'} group-hover:scale-[1.03] transition-transform duration-500`}
              loading="lazy"
              decoding="async"
              onError={() => setUseOriginalPhoto(false)}
            />
            {/* Gradient Overlay */}
            {!isImage && <div className="absolute inset-0 bg-gradient-to-t from-theme-bg via-theme-bg/30 to-transparent" />}
          </div>
        ) : (
          <SmartThumbnailCover 
            reel={reel} 
            className="group-hover:scale-[1.02] transition-transform duration-500" 
          />
        )}

        {/* Badges superiores */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10 flex-wrap max-w-[70%]">
          {isImage ? (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 shadow-sm backdrop-blur-md flex items-center gap-1">
              <ImageIcon className="w-2.5 h-2.5" />
              <span>Infografía</span>
            </span>
          ) : isLongVideo ? (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30 shadow-sm backdrop-blur-md flex items-center gap-1">
              <Film className="w-2.5 h-2.5" />
              <span>Vídeo {formattedDuration ? `· ${formattedDuration}` : ''}</span>
            </span>
          ) : (
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/60 text-white/90 border border-white/15 shadow-sm backdrop-blur-md">
              {platformBadge.label}
            </span>
          )}
          {reel.folder_name && (
            <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-black/60 text-claude-accent border border-white/15 backdrop-blur-md flex items-center gap-1">
              <FolderIcon className="w-2.5 h-2.5" />
              <span className="truncate max-w-[85px]">{reel.folder_name}</span>
            </span>
          )}
        </div>

        {/* Botones de acción en la esquina superior derecha */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
          {/* Botón para alternar portada inteligente / foto original del vídeo (si hay thumbnail) */}
          {reel.thumbnail_url && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setUseOriginalPhoto(prev => !prev);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-black/60 hover:bg-black/80 text-white/80 hover:text-white border border-white/15 backdrop-blur-md transition-all touch-manipulation shadow-sm cursor-pointer"
              title={useOriginalPhoto ? 'Ver portada resumen con IA' : 'Ver miniatura original del vídeo'}
            >
              {useOriginalPhoto ? <Sparkles className="w-3.5 h-3.5 text-claude-accent" /> : <ImageIcon className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Botón rápido de Favorito */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(reel);
            }}
            className={`w-7 h-7 flex items-center justify-center rounded-lg backdrop-blur-md transition-all touch-manipulation cursor-pointer ${
              isFavorite
                ? 'bg-claude-accent text-white shadow-sm'
                : 'bg-black/60 text-white/80 hover:text-white border border-white/15'
            }`}
            title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          >
            <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-white' : ''}`} />
          </button>
        </div>

        {/* Play Icon en Hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-claude-accent text-white flex items-center justify-center shadow-lg backdrop-blur-sm transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-4 h-4 ml-0.5 fill-white" />
          </div>
        </div>

        {/* Creador / Autor si existe (solo en modo foto) */}
        {useOriginalPhoto && reel.author && (
          <div className="absolute bottom-2.5 left-3 text-[11px] text-white/90 flex items-center gap-1 z-10 font-sans drop-shadow-md">
            <span>de</span>
            <span className="text-white font-medium">{reel.author}</span>
          </div>
        )}
      </div>

      {/* Contenido / Información */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        
        <div>
          {/* Herramientas de IA detectadas */}
          {reel.ai_tools.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {reel.ai_tools.map((tool) => (
                <button
                  key={tool}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTool(tool);
                  }}
                  className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-claude-accentSubtle text-claude-accent hover:bg-claude-accent/20 border border-claude-accentBorder transition-colors"
                >
                  {tool}
                </button>
              ))}
            </div>
          )}

          {/* Título en Tipografía Serif estilo Claude */}
          <h3 
            onClick={() => onOpenDetail(reel)}
            className="text-base font-serif font-medium text-claude-text group-hover:text-claude-accent transition-colors line-clamp-2 mb-2 cursor-pointer leading-snug"
          >
            {reel.title}
          </h3>

          {/* Resumen */}
          <p className="text-xs text-claude-textMuted line-clamp-2 leading-relaxed mb-3 font-sans">
            {reel.summary}
          </p>
        </div>

        {/* Footer de la tarjeta */}
        <div className="pt-3 border-t border-claude-borderSubtle flex items-center justify-between">
          
          {/* Indicador de Prompts o Pasos y Tiempo */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {reel.prompts.length > 0 ? (
              <span className="flex items-center gap-1 text-[11px] font-mono text-claude-accent bg-claude-accentSubtle px-2 py-0.5 rounded-md border border-claude-accentBorder">
                <Terminal className="w-3 h-3" />
                <span>{reel.prompts.length} prompt{reel.prompts.length > 1 ? 's' : ''}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-claude-textMuted">
                <Sparkles className="w-3 h-3 text-claude-textMuted" />
                <span>{reel.key_steps.length} pasos</span>
              </span>
            )}
            {reel.estimated_time && (
              <span className="flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-claude-bg text-claude-textMuted border border-claude-border">
                <Clock className="w-2.5 h-2.5 text-claude-accent" />
                <span>{reel.estimated_time}</span>
              </span>
            )}
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-1.5">
            {/* Toggle Estado */}
            <button
              onClick={() => onToggleStatus(reel)}
              className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-xs transition-colors ${
                isTested
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-claude-bg text-claude-textMuted hover:text-claude-text border border-claude-border'
              }`}
              title={isTested ? 'Marcar como pendiente' : 'Marcar como probado'}
            >
              {isTested ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </button>

            {/* Abrir vídeo original con safeExternalUrl */}
            <a
              href={safeExternalUrl(reel.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-claude-bg text-claude-textMuted hover:text-claude-text border border-claude-border transition-colors"
              title="Abrir enlace original en red social"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

        </div>

      </div>

    </div>
  );
});
