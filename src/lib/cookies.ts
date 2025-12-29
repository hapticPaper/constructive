export function getCookie(name: string): string | null {
  const encoded = encodeURIComponent(name);
  const parts = document.cookie.split(';').map((p) => p.trim());
  for (const part of parts) {
    if (!part.startsWith(`${encoded}=`)) continue;
    return decodeURIComponent(part.slice(encoded.length + 1));
  }
  return null;
}

export function setCookie({
  name,
  value,
  maxAgeSeconds,
  path = '/',
}: {
  name: string;
  value: string;
  maxAgeSeconds: number;
  path?: string;
}): void {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=${path}; SameSite=Lax`;
}

export function deleteCookie(name: string): void {
  setCookie({ name, value: '', maxAgeSeconds: 0 });
}
