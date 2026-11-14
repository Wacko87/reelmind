/**
 * Extrae limpiamente la primera URL válida encontrada en un texto compartido por TikTok o Instagram
 */
export function extractUrlFromText(text: string): string {
  if (!text) return '';
  const match = text.match(/(https?:\/\/[^\s]+)/i);
  return match ? match[1].trim() : text.trim();
}
