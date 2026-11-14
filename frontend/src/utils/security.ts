/**
 * Sanitiza URLs externas para mitigar inyecciones XSS vía esquemas javascript:, data:, vbscript:
 */
export function safeExternalUrl(url: string | null | undefined): string {
  if (!url) return '#';
  const trimmed = url.trim();
  
  // Exclusivamente permitir esquemas http y https
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  
  return '#';
}
