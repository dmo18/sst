const branded = new Set(['microsoft365','entra','aws','cloudflare','google-workspace','google-cloud','openai','anthropic','slack','zoom']);
export function providerInitials(name: string): string { const words = name.replace(/[^a-z0-9 ]/gi, ' ').trim().split(/\s+/); return (words.length > 1 ? `${words[0][0]}${words.at(-1)?.[0]}` : words[0]?.slice(0, 2) || '?').toUpperCase(); }
export function providerHue(id: string): number { let hash = 0; for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0; return hash % 360; }
export function hasBrandedLogo(id: string): boolean { return branded.has(id); }
