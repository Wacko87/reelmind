import React from 'react';
import { Reel } from '../types';
import { 
  Sparkles, 
  Terminal, 
  Wand2, 
  Code2, 
  Film, 
  Cpu, 
  Bot, 
  Palette, 
  Zap, 
  Clock,
  Music,
  CheckCircle2,
  Layers
} from 'lucide-react';

interface SmartThumbnailCoverProps {
  reel: Reel;
  className?: string;
}

interface ArchetypeTheme {
  category: string;
  gradient: string;
  glowColor: string;
  accentColor: string;
  borderColor: string;
  bgWatermark: React.ReactNode;
  icon: React.ReactNode;
}

export const SmartThumbnailCover: React.FC<SmartThumbnailCoverProps> = ({ reel, className = '' }) => {
  // Analizar herramientas, etiquetas y título para deducir el arquetipo visual
  const textCorpus = [
    ...(reel.ai_tools || []),
    ...(reel.tags || []),
    reel.title || '',
    reel.summary || ''
  ].join(' ').toLowerCase();

  const getTheme = (): ArchetypeTheme => {
    // 1. Programación & Código
    if (/cursor|python|code|react|github|v0|bolt|javascript|typescript|api|terminal|html|desarrollo|programaci[oó]n|vscode/.test(textCorpus)) {
      return {
        category: 'Código & Desarrollo',
        gradient: 'from-[#06152b] via-[#091b36] to-[#030914]',
        glowColor: 'rgba(56, 189, 248, 0.28)',
        accentColor: '#38bdf8',
        borderColor: 'rgba(56, 189, 248, 0.35)',
        bgWatermark: <Code2 className="w-40 h-40 text-sky-500/10 -rotate-12 transform" />,
        icon: <Code2 className="w-3.5 h-3.5 text-sky-400" />
      };
    }

    // 2. Imagen, Diseño & Arte
    if (/midjourney|flux|stable diffusion|dall-e|imagen|photoshop|canva|dise[ñn]o|foto|leonardo|ideogram|comfyui|iluminaci[oó]n|textura|render/.test(textCorpus)) {
      return {
        category: 'Generación Visual & Arte',
        gradient: 'from-[#1c0836] via-[#290d4a] to-[#0c0317]',
        glowColor: 'rgba(192, 132, 252, 0.30)',
        accentColor: '#c084fc',
        borderColor: 'rgba(192, 132, 252, 0.35)',
        bgWatermark: <Palette className="w-40 h-40 text-purple-500/10 rotate-6 transform" />,
        icon: <Palette className="w-3.5 h-3.5 text-purple-400" />
      };
    }

    // 3. Vídeo, Cine & 3D
    if (/kling|runway|pika|sora|hailuo|luma|video|blender|animaci[oó]n|3d|cinematic|film|c[aá]mara/.test(textCorpus)) {
      return {
        category: 'Vídeo & Cinemática',
        gradient: 'from-[#2b0816] via-[#3b0b20] to-[#120309]',
        glowColor: 'rgba(244, 63, 94, 0.30)',
        accentColor: '#f43f5e',
        borderColor: 'rgba(244, 63, 94, 0.35)',
        bgWatermark: <Film className="w-40 h-40 text-rose-500/10 -rotate-6 transform" />,
        icon: <Film className="w-3.5 h-3.5 text-rose-400" />
      };
    }

    // 4. Automatización & Agentes
    if (/n8n|make|zapier|agente|crewai|autogen|automatizaci[oó]n|langchain|dify|flowise|bot|webhook/.test(textCorpus)) {
      return {
        category: 'Agentes & Workflows',
        gradient: 'from-[#2e1302] via-[#3d1a04] to-[#120701]',
        glowColor: 'rgba(251, 146, 60, 0.30)',
        accentColor: '#fb923c',
        borderColor: 'rgba(251, 146, 60, 0.35)',
        bgWatermark: <Cpu className="w-40 h-40 text-orange-500/10 rotate-12 transform" />,
        icon: <Zap className="w-3.5 h-3.5 text-orange-400" />
      };
    }

    // 5. Audio, Voz & Música
    if (/suno|udio|elevenlabs|voice|audio|m[uú]sica|podcast|voz|sonido/.test(textCorpus)) {
      return {
        category: 'Voz & Audio Sintético',
        gradient: 'from-[#04241a] via-[#073626] to-[#02120d]',
        glowColor: 'rgba(52, 211, 153, 0.30)',
        accentColor: '#34d399',
        borderColor: 'rgba(52, 211, 153, 0.35)',
        bgWatermark: <Music className="w-40 h-40 text-emerald-500/10 -rotate-12 transform" />,
        icon: <Music className="w-3.5 h-3.5 text-emerald-400" />
      };
    }

    // 6. Por defecto: LLM, Razonamiento & Prompts Generales (Estilo Claude Terracota / Ámbar)
    return {
      category: 'Razonamiento & Prompts',
      gradient: 'from-[#24130b] via-[#331b10] to-[#0f0805]',
      glowColor: 'rgba(204, 120, 92, 0.30)',
      accentColor: '#cc785c',
      borderColor: 'rgba(204, 120, 92, 0.35)',
      bgWatermark: <Sparkles className="w-40 h-40 text-amber-500/10 rotate-12 transform" />,
      icon: <Sparkles className="w-3.5 h-3.5 text-claude-accent" />
    };
  };

  const theme = getTheme();
  const primaryTool = reel.ai_tools && reel.ai_tools.length > 0 ? reel.ai_tools[0] : null;
  const hasPrompts = reel.prompts && reel.prompts.length > 0;
  
  // Extraer una frase de síntesis o el primer paso clave para la portada
  const keySnippet = hasPrompts 
    ? 'Fórmula y Prompt listo para copiar'
    : (reel.key_steps && reel.key_steps.length > 0 ? reel.key_steps[0] : reel.summary);

  return (
    <div 
      className={`relative w-full h-full overflow-hidden select-none bg-gradient-to-br ${theme.gradient} flex flex-col justify-between pt-11 pb-2.5 px-3.5 sm:px-4 text-left transition-all ${className}`}
    >
      {/* Resplandor ambiental de fondo */}
      <div 
        className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-60"
        style={{ backgroundColor: theme.glowColor }}
      />
      <div 
        className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full blur-2xl pointer-events-none opacity-40"
        style={{ backgroundColor: theme.glowColor }}
      />

      {/* Marca de agua vectorial de fondo */}
      <div className="absolute right-[-15px] bottom-[-20px] pointer-events-none opacity-70">
        {theme.bgWatermark}
      </div>

      {/* Trama sutil de cuadrícula geométrica */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="card-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#card-grid)" />
      </svg>

      {/* Centro: Título Destacado de lo que se enseña */}
      <div className="relative z-10 my-auto py-1">
        <h4 className="text-sm sm:text-base font-serif font-semibold text-white leading-snug line-clamp-2 drop-shadow-md tracking-tight">
          {reel.title}
        </h4>
        
        {/* Píldora de Síntesis Rápida */}
        <p className="text-[11px] text-white/75 line-clamp-1 mt-1 font-sans flex items-center gap-1.5">
          <span 
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: theme.accentColor }}
          />
          <span className="truncate">{keySnippet}</span>
        </p>
      </div>

      {/* Fila Inferior: Herramienta de IA, Prompts y Dificultad */}
      <div className="relative z-10 flex items-center justify-between gap-1.5 text-[10px] pt-1.5 border-t border-white/10">
        {/* Herramienta principal o categoría destacada */}
        <div 
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono font-medium shadow-sm border truncate max-w-[150px]"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.45)', 
            borderColor: theme.borderColor,
            color: theme.accentColor
          }}
        >
          {theme.icon}
          <span className="font-semibold truncate">
            {primaryTool || theme.category}
          </span>
        </div>

        {/* Badges de soporte (prompts o tiempo + dificultad) */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasPrompts ? (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm backdrop-blur-md">
              <Terminal className="w-2.5 h-2.5" />
              <span>{reel.prompts.length} prompt{reel.prompts.length > 1 ? 's' : ''}</span>
            </div>
          ) : reel.estimated_time ? (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full font-mono text-white/70 bg-black/40 border border-white/10 backdrop-blur-md">
              <Clock className="w-2.5 h-2.5 text-white/60" />
              <span>{reel.estimated_time}</span>
            </div>
          ) : null}

          {reel.difficulty && (
            <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/80 font-medium font-sans">
              {reel.difficulty}
            </span>
          )}
        </div>
      </div>

    </div>
  );
};
