import { Reel, Stats, AppSettings, Folder, AuthStatus, PromptOptimizeResponse, VaultAskResponse } from './types';

const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('reelmind_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    if (res.status === 401) {
      // Disparar evento para que la app muestre la pantalla de bloqueo
      window.dispatchEvent(new CustomEvent('reelmind:unauthorized'));
    }

    if (isJson) {
      const err = await res.json();
      throw new Error(err.detail || `Error HTTP ${res.status}`);
    }
    const text = await res.text();
    throw new Error(text || `Error HTTP ${res.status}: ${res.statusText}`);
  }
  return isJson ? res.json() : ({} as T);
}

export async function checkAuthStatus(): Promise<AuthStatus> {
  const res = await fetch(`${API_BASE}/auth/status`, {
    headers: getAuthHeaders(),
    signal: AbortSignal.timeout(10000),
  });
  return handleResponse<AuthStatus>(res);
}

export async function loginWithPin(pin: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await handleResponse<{ success: boolean; token?: string }>(res);
  if (data.token) {
    localStorage.setItem('reelmind_token', data.token);
  }
  return Boolean(data.success);
}

export async function logout(): Promise<void> {
  localStorage.removeItem('reelmind_token');
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

export async function fetchFolders(media_type?: string): Promise<Folder[]> {
  const query = media_type ? `?media_type=${encodeURIComponent(media_type)}` : '';
  const res = await fetch(`${API_BASE}/folders${query}`, {
    headers: getAuthHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  return handleResponse<Folder[]>(res);
}

export async function createFolder(data: {
  name: string;
  parent_id?: string | null;
  icon?: string;
  color?: string;
}): Promise<Folder> {
  const res = await fetch(`${API_BASE}/folders`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(15000),
  });
  return handleResponse<Folder>(res);
}

export async function updateFolder(
  id: string,
  data: {
    name?: string;
    parent_id?: string | null;
    icon?: string;
    color?: string;
  }
): Promise<Folder> {
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(15000),
  });
  return handleResponse<Folder>(res);
}

export async function deleteFolder(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  await handleResponse(res);
}

export async function fetchReels(
  params?: {
    q?: string;
    status?: string;
    tool?: string;
    tag?: string;
    folder_id?: string;
    media_type?: string;
    time?: string;
  },
  signal?: AbortSignal
): Promise<Reel[]> {
  const query = new URLSearchParams();
  if (params?.q) query.append('q', params.q);
  if (params?.status) query.append('status', params.status);
  if (params?.tool) query.append('tool', params.tool);
  if (params?.tag) query.append('tag', params.tag);
  if (params?.folder_id) query.append('folder_id', params.folder_id);
  if (params?.media_type) query.append('media_type', params.media_type);
  if (params?.time) query.append('time', params.time);

  const res = await fetch(`${API_BASE}/reels?${query.toString()}`, {
    headers: getAuthHeaders(),
    signal: signal || AbortSignal.timeout(15000),
  });
  return handleResponse<Reel[]>(res);
}

export async function analyzeReel(
  url: string, 
  folder_id?: string | null,
  media_type?: 'auto' | 'reel' | 'video' | 'image'
): Promise<Reel> {
  const res = await fetch(`${API_BASE}/reels/analyze`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ url, folder_id, media_type: media_type || 'auto' }),
    signal: AbortSignal.timeout(60000),
  });
  return handleResponse<Reel>(res);
}

export async function uploadImage(file: File): Promise<{ url: string; filename: string; preview_url: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('reelmind_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/upload-image`, {
    method: 'POST',
    headers,
    body: formData,
    signal: AbortSignal.timeout(30000),
  });
  return handleResponse<{ url: string; filename: string; preview_url: string }>(res);
}

export async function updateReel(
  id: string,
  updates: {
    status?: string;
    user_notes?: string;
    title?: string;
    tags?: string[];
    folder_id?: string | null;
    media_type?: 'reel' | 'video' | 'image';
    estimated_time?: string;
  }
): Promise<Reel> {
  const res = await fetch(`${API_BASE}/reels/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
    signal: AbortSignal.timeout(15000),
  });
  return handleResponse<Reel>(res);
}

export async function deleteReel(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/reels/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  await handleResponse(res);
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/stats`, {
    headers: getAuthHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  return handleResponse<Stats>(res);
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/settings`, {
    headers: getAuthHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  return handleResponse<AppSettings>(res);
}

export async function saveSettings(geminiApiKey: string): Promise<void> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ gemini_api_key: geminiApiKey }),
    signal: AbortSignal.timeout(15000),
  });
  await handleResponse(res);
}

export async function optimizePrompt(
  prompt: string,
  mode: 'variations' | 'adapt_model' = 'variations',
  targetModel?: string
): Promise<PromptOptimizeResponse> {
  const res = await fetch(`${API_BASE}/prompts/optimize`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ prompt, mode, target_model: targetModel }),
    signal: AbortSignal.timeout(30000),
  });
  return handleResponse<PromptOptimizeResponse>(res);
}

export async function askVault(question: string): Promise<VaultAskResponse> {
  const res = await fetch(`${API_BASE}/vault/ask`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ question }),
    signal: AbortSignal.timeout(45000),
  });
  return handleResponse<VaultAskResponse>(res);
}

export async function downloadReelMarkdown(id: string, filename?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/reels/${id}/markdown`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Error al descargar Markdown del reel');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ? `${filename.replace(/[/\\?%*:|"<>]/g, '_')}.md` : 'recurso.md';
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function downloadVaultZip(): Promise<void> {
  const res = await fetch(`${API_BASE}/export/vault`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Error al descargar archivo ZIP de la bóveda');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ReelMind_Boveda_Obsidian_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
