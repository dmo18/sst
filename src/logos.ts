const brandedLogoFiles: Record<string, string> = {
  microsoft365: 'microsoft365.svg',
  entra: 'entra.svg',
  aws: 'aws.svg',
  cloudflare: 'cloudflare.svg',
  'google-workspace': 'google-workspace.svg',
  'google-cloud': 'google-cloud.svg',
  openai: 'openai.svg',
  anthropic: 'anthropic.svg',
  slack: 'slack.svg',
  zoom: 'zoom.svg'
};

function initials(name: string): string {
  const words = name
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words.at(-1)?.[0] ?? ''}`.toUpperCase();
}

function hueFor(value: string): number {
  let hash = 0;
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}

export function generatedProviderIcon(providerId: string, providerName: string): string {
  const label = initials(providerName || providerId);
  const hue = hueFor(providerId || providerName);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img"><rect width="64" height="64" rx="14" fill="hsl(${hue} 62% 34%)"/><rect x="2" y="2" width="60" height="60" rx="12" fill="none" stroke="hsl(${hue} 72% 72%)" stroke-width="2"/><text x="32" y="39" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" font-weight="750" fill="white">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function providerIconSrc(providerId: string, providerName: string): string {
  const branded = brandedLogoFiles[providerId];
  return branded
    ? `${import.meta.env.BASE_URL}assets/logos/${branded}`
    : generatedProviderIcon(providerId, providerName);
}

export function providerIconFallback(providerId: string, providerName: string): string {
  return generatedProviderIcon(providerId, providerName);
}

export function hasBrandedProviderIcon(providerId: string): boolean {
  return providerId in brandedLogoFiles;
}
