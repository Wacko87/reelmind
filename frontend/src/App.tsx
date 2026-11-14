import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Reel, Stats, AppSettings, Folder } from './types';
import { 
  fetchReels, 
  fetchStats, 
  fetchSettings, 
  fetchFolders, 
  deleteFolder, 
  updateReel, 
  deleteReel 
} from './api';
import { Navbar } from './components/Navbar';
import { SidebarFolders } from './components/SidebarFolders';
import { StatsBar } from './components/StatsBar';
import { FilterBar } from './components/FilterBar';
import { ReelCard } from './components/ReelCard';
import { LockScreen } from './components/LockScreen';
import { extractUrlFromText } from './utils/url';
import { checkAuthStatus, logout } from './api';

// Code-splitting / Lazy loading para modales y vistas secundarias
const ReelDetailModal = lazy(() => import('./components/ReelDetailModal').then(m => ({ default: m.ReelDetailModal })));
const AddReelModal = lazy(() => import('./components/AddReelModal').then(m => ({ default: m.AddReelModal })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const FolderModal = lazy(() => import('./components/FolderModal').then(m => ({ default: m.FolderModal })));
const PromptVaultView = lazy(() => import('./components/PromptVaultView').then(m => ({ default: m.PromptVaultView })));
const AskVaultModal = lazy(() => import('./components/AskVaultModal').then(m => ({ default: m.AskVaultModal })));
import { 
  Sparkles, 
  Plus, 
  AlertCircle, 
  Loader2, 
  VideoOff, 
  Folder as FolderIcon, 
  ChevronRight,
  Smartphone,
  Film,
  Terminal,
  ExternalLink
} from 'lucide-react';

export const App: React.FC = () => {
  const [reels, setReels] = useState<Reel[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Apartado activo: 'reels' (<10 min), 'videos' (>10 min) o 'prompts'
  const [activeSection, setActiveSection] = useState<'reels' | 'videos' | 'prompts'>('reels');

  // Autenticación por PIN
  const [authRequired, setAuthRequired] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  // Navegación & Filtros
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTool, setSelectedTool] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Modales
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAskVaultOpen, setIsAskVaultOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<Folder | null>(null);
  const [defaultParentFolderId, setDefaultParentFolderId] = useState<string | null>(null);
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);
  const [initialUrlForModal, setInitialUrlForModal] = useState('');

  // Responsive Drawer Mobile
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Verificar autenticación
  useEffect(() => {
    checkAuthStatus()
      .then((status) => {
        setAuthRequired(status.auth_required);
        setIsAuthenticated(status.is_authenticated);
      })
      .catch((err) => {
        console.error('Error al comprobar autenticación:', err);
      });

    const handleUnauthorized = () => {
      setIsAuthenticated(false);
    };

    window.addEventListener('reelmind:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('reelmind:unauthorized', handleUnauthorized);
  }, []);

  // Carga de carpetas filtradas según el apartado activo
  const loadFolders = useCallback(async () => {
    try {
      const data = await fetchFolders(activeSection === 'prompts' ? undefined : (activeSection === 'reels' ? 'reel' : 'video'));
      setFolders(data);
    } catch (err) {
      console.error('Error cargando carpetas:', err);
    }
  }, [activeSection]);

  // Carga de ajustes del sistema (desacoplada de filtros para máximo rendimiento)
  const loadSettings = useCallback(async () => {
    try {
      const data = await fetchSettings();
      setSettings(data);
    } catch (err) {
      console.error('Error cargando ajustes:', err);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Carga de reels y datos con cancelación de peticiones anteriores
  const loadData = useCallback(async (signal?: AbortSignal) => {
    try {
      const mediaTypeParam = activeSection === 'prompts' ? undefined : (activeSection === 'reels' ? 'reel' : 'video');
      const [reelsData, statsData] = await Promise.all([
        fetchReels({
          q: searchQuery,
          status: statusFilter,
          tool: selectedTool,
          tag: selectedTag,
          folder_id: selectedFolderId || undefined,
          media_type: mediaTypeParam,
          time: selectedTime || undefined,
        }, signal),
        fetchStats(),
      ]);
      setReels(reelsData);
      setStats(statsData);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Error cargando datos:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, selectedTool, selectedTag, selectedTime, selectedFolderId, activeSection]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  // Manejar Share Target de la PWA (?url=... o ?text=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawShared = params.get('url') || params.get('text');
    if (rawShared) {
      const cleanUrl = extractUrlFromText(rawShared);
      setInitialUrlForModal(cleanUrl);
      setIsAddModalOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.includes('http://') || text.includes('https://'))) {
        setInitialUrlForModal(extractUrlFromText(text));
        setIsAddModalOpen(true);
      } else {
        setIsAddModalOpen(true);
      }
    } catch (err) {
      setIsAddModalOpen(true);
    }
  };

  const handleReelAdded = (newReel: Reel) => {
    setReels((prev) => [newReel, ...prev]);
    // No auto-abrir setSelectedReel(newReel) para evitar bloquear la pantalla y el menú superior en móviles
    loadData();
    loadFolders();
  };

  const handleToggleFavorite = async (reel: Reel) => {
    const newStatus = reel.status === 'favorite' ? 'pending' : 'favorite';
    try {
      const updated = await updateReel(reel.id, { status: newStatus });
      setReels((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (selectedReel?.id === updated.id) setSelectedReel(updated);
      fetchStats().then(setStats);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStatus = async (reel: Reel) => {
    const newStatus = reel.status === 'tested' ? 'pending' : 'tested';
    try {
      const updated = await updateReel(reel.id, { status: newStatus });
      setReels((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (selectedReel?.id === updated.id) setSelectedReel(updated);
      fetchStats().then(setStats);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateReel = async (id: string, updates: Partial<Reel>) => {
    const updated = await updateReel(id, updates);
    setReels((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    if (selectedReel?.id === updated.id) setSelectedReel(updated);
    fetchStats().then(setStats);
    loadFolders();
  };

  const handleDeleteReel = async (id: string) => {
    await deleteReel(id);
    setReels((prev) => prev.filter((r) => r.id !== id));
    if (selectedReel?.id === id) setSelectedReel(null);
    fetchStats().then(setStats);
    loadFolders();
  };

  // Gestión de carpetas
  const handleOpenCreateFolder = (parentId?: string | null) => {
    setFolderToEdit(null);
    setDefaultParentFolderId(parentId || null);
    setIsFolderModalOpen(true);
  };

  const handleOpenEditFolder = (folder: Folder) => {
    setFolderToEdit(folder);
    setDefaultParentFolderId(null);
    setIsFolderModalOpen(true);
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteFolder(folderId);
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null);
      }
      loadFolders();
      loadData();
    } catch (err) {
      console.error('Error al eliminar carpeta:', err);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedTool('');
    setSelectedTag('');
    setStatusFilter('');
    setSelectedTime('');
    // NO tocamos selectedFolderId aquí para no expulsar al usuario de la carpeta donde está navegando
  };

  const handleResetAll = () => {
    handleClearFilters();
    setSelectedFolderId(null);
  };

  // Buscar información de la carpeta activa para Breadcrumbs
  const findFolderBreadcrumb = (items: Folder[], targetId: string): Folder[] | null => {
    for (const item of items) {
      if (item.id === targetId) return [item];
      if (item.children && item.children.length > 0) {
        const sub = findFolderBreadcrumb(item.children, targetId);
        if (sub) return [item, ...sub];
      }
    }
    return null;
  };

  const activeBreadcrumbs = selectedFolderId && selectedFolderId !== 'unassigned'
    ? findFolderBreadcrumb(folders, selectedFolderId)
    : null;

  const handleLogout = async () => {
    await logout();
    setIsAuthenticated(false);
  };

  if (authRequired && !isAuthenticated) {
    return (
      <LockScreen
        onSuccess={() => {
          setIsAuthenticated(true);
          loadFolders();
          loadData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-claude-bg text-claude-text">
      
      {/* Barra de Navegación */}
      <Navbar
        onOpenAddModal={() => {
          setInitialUrlForModal('');
          setIsAddModalOpen(true);
        }}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenAskVault={() => setIsAskVaultOpen(true)}
        onPasteFromClipboard={handlePasteFromClipboard}
        onToggleSidebarMobile={() => setIsMobileSidebarOpen(true)}
        onLogout={handleLogout}
        authRequired={authRequired}
        settings={settings}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        
        {/* Barra Lateral de Carpetas & Subcarpetas */}
        <SidebarFolders
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          onOpenCreateFolder={handleOpenCreateFolder}
          onOpenEditFolder={handleOpenEditFolder}
          onDeleteFolder={handleDeleteFolder}
          statusFilter={statusFilter}
          onSelectStatus={setStatusFilter}
          totalReels={stats?.total || 0}
          unassignedCount={stats?.unassigned || 0}
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          reelsCount={stats?.reels_count || 0}
          videosCount={stats?.videos_count || 0}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Área Principal de Contenido */}
        <main className="flex-1 min-w-0 px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          
          {/* Selector de Apartados: Reels (<10m) vs Vídeos (>10m) vs Prompts */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-claude-border">
            <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl bg-claude-surface border border-claude-border shadow-sm overflow-x-auto scrollbar-none w-full sm:w-auto">
              <button
                onClick={() => setActiveSection('reels')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  activeSection === 'reels'
                    ? 'bg-claude-accent text-white shadow-sm'
                    : 'text-claude-textMuted hover:text-claude-text hover:bg-claude-bg/50'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="sm:hidden">Reels</span>
                <span className="hidden sm:inline">Reels (&lt; 10 min)</span>
                <span className={`text-[10px] sm:text-[11px] font-mono px-1.5 sm:px-2 py-0.5 rounded-full ${
                  activeSection === 'reels' ? 'bg-black/25 text-white' : 'bg-claude-bg text-claude-textMuted'
                }`}>
                  {stats?.reels_count ?? 0}
                </span>
              </button>

              <button
                onClick={() => setActiveSection('videos')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  activeSection === 'videos'
                    ? 'bg-claude-accent text-white shadow-sm'
                    : 'text-claude-textMuted hover:text-claude-text hover:bg-claude-bg/50'
                }`}
              >
                <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="sm:hidden">Vídeos</span>
                <span className="hidden sm:inline">Vídeos (&gt; 10 min)</span>
                <span className={`text-[10px] sm:text-[11px] font-mono px-1.5 sm:px-2 py-0.5 rounded-full ${
                  activeSection === 'videos' ? 'bg-black/25 text-white' : 'bg-claude-bg text-claude-textMuted'
                }`}>
                  {stats?.videos_count ?? 0}
                </span>
              </button>

              <button
                onClick={() => setActiveSection('prompts')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  activeSection === 'prompts'
                    ? 'bg-claude-accent text-white shadow-sm'
                    : 'text-claude-textMuted hover:text-claude-text hover:bg-claude-bg/50'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="sm:hidden">Prompts</span>
                <span className="hidden sm:inline">Bóveda Prompts</span>
                <span className={`text-[10px] sm:text-[11px] font-mono px-1.5 sm:px-2 py-0.5 rounded-full ${
                  activeSection === 'prompts' ? 'bg-black/25 text-white' : 'bg-claude-bg text-claude-textMuted'
                }`}>
                  ⚡
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-claude-textMuted font-sans">
              {activeSection === 'prompts' ? (
                <span className="flex items-center gap-1.5 text-claude-accent font-medium">
                  <Terminal className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Cheatsheet de prompts con optimizador y adaptador de modelos IA</span>
                </span>
              ) : activeSection === 'reels' ? (
                <span className="flex items-center gap-1.5 text-claude-textMuted">
                  <Sparkles className="w-3.5 h-3.5 text-claude-accent flex-shrink-0" />
                  <span>Vídeo analizado por IA (visión de fotogramas, prompts y audio)</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-claude-textMuted">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span>Enlace directo · Sin descargas en disco</span>
                </span>
              )}
            </div>
          </div>
          
          {/* Banner si no hay API Key configurada */}
          {settings && !settings.has_gemini_key && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-400" />
                <div className="text-xs sm:text-sm font-sans">
                  <strong>Clave de Gemini API pendiente:</strong> Configura tu clave gratuita de Google AI Studio para activar el análisis automático.
                </div>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-semibold transition-all shadow-sm"
              >
                Configurar Clave
              </button>
            </div>
          )}

          {/* Breadcrumb de Carpeta Activa */}
          {selectedFolderId && (
            <div className="flex items-center gap-2 mb-4 text-xs text-claude-textMuted bg-claude-surface p-2.5 rounded-xl border border-claude-border font-sans">
              <button
                onClick={() => setSelectedFolderId(null)}
                className="hover:text-claude-text transition-colors"
              >
                Biblioteca
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-claude-textMuted/60" />
              {selectedFolderId === 'unassigned' ? (
                <span className="font-medium text-claude-accent">📥 Sin clasificar</span>
              ) : activeBreadcrumbs ? (
                activeBreadcrumbs.map((b, i) => (
                  <React.Fragment key={b.id}>
                    {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-claude-textMuted/60" />}
                    <span className={i === activeBreadcrumbs.length - 1 ? 'font-medium text-claude-accent' : 'hover:text-claude-text'}>
                      {b.icon} {b.name}
                    </span>
                  </React.Fragment>
                ))
              ) : null}
            </div>
          )}

          {/* Contenido Condicional: Bóveda de Prompts vs Catálogo de Vídeos/Reels */}
          {activeSection === 'prompts' ? (
            <Suspense fallback={
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="w-7 h-7 text-claude-accent animate-spin" />
                <p className="text-xs text-claude-textMuted font-mono">Cargando Bóveda de Prompts...</p>
              </div>
            }>
              <PromptVaultView
                reels={reels}
                onOpenReel={setSelectedReel}
              />
            </Suspense>
          ) : (
            <>
              {/* Métricas y filtros rápidos */}
              <StatsBar
                stats={stats}
                selectedTool={selectedTool}
                onSelectTool={setSelectedTool}
                statusFilter={statusFilter}
                onSelectStatus={setStatusFilter}
              />

              {/* Buscador, Tags y Filtro por Tiempo */}
              <FilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedTag={selectedTag}
                onSelectTag={setSelectedTag}
                selectedTool={selectedTool}
                selectedTime={selectedTime}
                onSelectTime={setSelectedTime}
                onClearFilters={handleClearFilters}
                stats={stats}
              />

              {/* Grid de Vídeos / Reels */}
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
                  <Loader2 className="w-7 h-7 text-claude-accent animate-spin" />
                  <p className="text-xs text-claude-textMuted font-mono">Cargando biblioteca...</p>
                </div>
              ) : reels.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {reels.map((reel) => (
                    <ReelCard
                      key={reel.id}
                      reel={reel}
                      onOpenDetail={setSelectedReel}
                      onToggleFavorite={handleToggleFavorite}
                      onToggleStatus={handleToggleStatus}
                      onSelectTool={setSelectedTool}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-16 px-4 rounded-3xl bg-claude-surface/60 border border-claude-border flex flex-col items-center justify-center text-center max-w-md mx-auto my-8">
                  <div className="w-14 h-14 rounded-2xl bg-claude-bg border border-claude-border flex items-center justify-center text-claude-textMuted mb-4">
                    <VideoOff className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-heading font-medium text-claude-text mb-1">
                    {searchQuery || selectedTool || selectedTag || statusFilter || selectedFolderId || selectedTime
                      ? 'Sin resultados para estos filtros'
                      : activeSection === 'reels'
                      ? 'Sin reels cortos en este apartado'
                      : 'Sin vídeos largos en este apartado'}
                  </h3>
                  <p className="text-xs text-claude-textMuted mb-5 leading-relaxed font-sans">
                    {searchQuery || selectedTool || selectedTag || statusFilter || selectedFolderId || selectedTime
                      ? 'Prueba a cambiar los términos de búsqueda o a limpiar los filtros activos.'
                      : activeSection === 'reels'
                      ? 'Guarda reels de TikTok, Instagram o YouTube Shorts (<10 min) para procesar su audio con IA.'
                      : 'Guarda tutoriales o conferencias de YouTube (>10 min) para tener su enlace directo y resumen inteligente sin descargar archivos.'}
                  </p>
                  {searchQuery || selectedTool || selectedTag || statusFilter || selectedFolderId || selectedTime ? (
                    <button
                      onClick={handleResetAll}
                      className="px-4 py-2 rounded-xl bg-claude-bg hover:bg-claude-surface text-claude-text text-xs font-medium border border-claude-border"
                    >
                      Ver toda la biblioteca
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setInitialUrlForModal('');
                        setIsAddModalOpen(true);
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-claude-accent hover:bg-claude-accentHover text-white text-xs font-semibold shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{activeSection === 'reels' ? 'Guardar reel aquí' : 'Guardar vídeo aquí'}</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}

        </main>

      </div>

      {/* Modales cargados bajo demanda vía Suspense */}
      <Suspense fallback={null}>
        {selectedReel && (
          <ReelDetailModal
            reel={selectedReel}
            folders={folders}
            onClose={() => setSelectedReel(null)}
            onUpdate={handleUpdateReel}
            onDelete={handleDeleteReel}
          />
        )}

        {isAddModalOpen && (
          <AddReelModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onReelAdded={handleReelAdded}
            onOpenReel={(reel) => setSelectedReel(reel)}
            initialUrl={initialUrlForModal}
            folders={folders}
            currentSelectedFolderId={selectedFolderId}
            defaultMediaType={activeSection === 'reels' ? 'reel' : 'video'}
          />
        )}

        {isAskVaultOpen && (
          <AskVaultModal
            isOpen={isAskVaultOpen}
            onClose={() => setIsAskVaultOpen(false)}
            onOpenReel={(reelId) => {
              const found = reels.find(r => r.id === reelId);
              if (found) {
                setSelectedReel(found);
              } else {
                fetchReels().then(all => {
                  const f = all.find(r => r.id === reelId);
                  if (f) setSelectedReel(f);
                });
              }
            }}
          />
        )}

        {isFolderModalOpen && (
          <FolderModal
            isOpen={isFolderModalOpen}
            onClose={() => setIsFolderModalOpen(false)}
            onSuccess={() => {
              loadFolders();
              loadData();
            }}
            folderToEdit={folderToEdit}
            defaultParentId={defaultParentFolderId}
            availableFolders={folders}
          />
        )}

        {isSettingsModalOpen && (
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            settings={settings}
            onSettingsSaved={() => {
              loadSettings();
              loadData();
              loadFolders();
            }}
          />
        )}
      </Suspense>

      {/* Footer minimalista estilo Claude */}
      <footer className="py-6 border-t border-claude-border text-center text-xs text-claude-textMuted/60 font-mono">
        ReelMind — AI Knowledge Vault
      </footer>

    </div>
  );
};
