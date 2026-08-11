type BrandedLogo = {
  file: string;
  accent?: string;
  monochrome?: boolean;
};

type GeneratedBrand = {
  label: string;
  accent: string;
  secondary?: string;
  motif?: 'bars' | 'diamond' | 'orbit' | 'split' | 'wave';
};

const brandedLogoFiles: Record<string, BrandedLogo> = {
  microsoft365: { file: 'microsoft365.svg' },
  entra: { file: 'entra.svg' },
  aws: { file: 'aws.svg' },
  cloudflare: { file: 'cloudflare.svg' },
  'google-workspace': { file: 'google-workspace.svg' },
  'google-cloud': { file: 'google-cloud.svg' },
  openai: { file: 'openai.svg' },
  anthropic: { file: 'anthropic.svg' },
  slack: { file: 'slack.svg' },
  zoom: { file: 'zoom.svg' },

  github: { file: 'github.svg', accent: '#24292f', monochrome: true },
  digitalocean: { file: 'digitalocean.svg', accent: '#0080ff', monochrome: true },
  okta: { file: 'okta.svg', accent: '#007dc1', monochrome: true },
  dropbox: { file: 'dropbox.svg', accent: '#0061ff', monochrome: true },
  box: { file: 'box.svg', accent: '#0061d5', monochrome: true },
  '1password': { file: '1password.svg', accent: '#145fe4', monochrome: true },
  auth0: { file: 'auth0.svg', accent: '#eb5424', monochrome: true },
  bitwarden: { file: 'bitwarden.svg', accent: '#175ddc', monochrome: true },
  lastpass: { file: 'lastpass.svg', accent: '#d32d27', monochrome: true },
  discord: { file: 'discord.svg', accent: '#5865f2', monochrome: true },
  docker: { file: 'docker.svg', accent: '#2496ed', monochrome: true },
  vercel: { file: 'vercel.svg', accent: '#111111', monochrome: true },
  stripe: { file: 'stripe.svg', accent: '#635bff', monochrome: true },
  paypal: { file: 'paypal.svg', accent: '#003087', monochrome: true },
  shopify: { file: 'shopify.svg', accent: '#7ab55c', monochrome: true },
  hubspot: { file: 'hubspot.svg', accent: '#ff7a59', monochrome: true },
  zendesk: { file: 'zendesk.svg', accent: '#03363d', monochrome: true },
  notion: { file: 'notion.svg', accent: '#111111', monochrome: true },
  asana: { file: 'asana.svg', accent: '#f06a6a', monochrome: true },
  xero: { file: 'xero.svg', accent: '#13b5ea', monochrome: true },
  godaddy: { file: 'godaddy.svg', accent: '#09757a', monochrome: true },
  fortinet: { file: 'fortinet.svg', accent: '#ee3124', monochrome: true },
  malwarebytes: { file: 'malwarebytes.svg', accent: '#0d3ecc', monochrome: true },
  meraki: { file: 'cisco.svg', accent: '#1ba0d7', monochrome: true },
  duo: { file: 'cisco.svg', accent: '#1ba0d7', monochrome: true },
  'cisco-umbrella': { file: 'cisco.svg', accent: '#1ba0d7', monochrome: true },
  'quickbooks-online': { file: 'quickbooks.svg', accent: '#2ca01c', monochrome: true },
  vultr: { file: 'vultr.svg', accent: '#007bfc', monochrome: true },
  backblaze: { file: 'backblaze.svg', accent: '#e21e29', monochrome: true },
  keeper: { file: 'keeper.svg', accent: '#ffc700', monochrome: true },
  ubiquiti: { file: 'ubiquiti.svg', accent: '#0559c9', monochrome: true },
  lumen: { file: 'lumen.svg', accent: '#00c389', monochrome: true },
  wasabi: { file: 'wasabi.svg', accent: '#28a745', monochrome: true },
  'bitdefender-gravityzone': { file: 'bitdefender.svg', accent: '#d71920', monochrome: true },
  'elastic-cloud': { file: 'elastic.svg', accent: '#00bfb3', monochrome: true }
};

const generatedBrands: Record<string, GeneratedBrand> = {
  sentinelone: { label: 'S1', accent: '#5b35d5', secondary: '#221446', motif: 'orbit' },
  sophos: { label: 'S', accent: '#005eb8', secondary: '#003b73', motif: 'bars' },
  dnsfilter: { label: 'DNS', accent: '#4b44e7', secondary: '#28227f', motif: 'orbit' },
  connectwise: { label: 'CW', accent: '#f47b20', secondary: '#943b08', motif: 'split' },
  halopsa: { label: 'HALO', accent: '#6d4dff', secondary: '#2f1c8f', motif: 'orbit' },
  ninjaone: { label: 'N', accent: '#f26b38', secondary: '#18181b', motif: 'diamond' },
  jumpcloud: { label: 'JC', accent: '#5566ff', secondary: '#2634aa', motif: 'orbit' },
  jamf: { label: 'J', accent: '#00a4e4', secondary: '#00577b', motif: 'wave' },
  addigy: { label: 'A', accent: '#6366f1', secondary: '#272a88', motif: 'orbit' },
  atera: { label: 'A', accent: '#5b45e0', secondary: '#241c70', motif: 'diamond' },
  syncro: { label: 'S', accent: '#14a3a3', secondary: '#075353', motif: 'split' },
  kaseya: { label: 'K', accent: '#f05a28', secondary: '#7e2b0e', motif: 'bars' },
  'n-able': { label: 'N', accent: '#ff6b00', secondary: '#7a3300', motif: 'wave' },
  superops: { label: 'SO', accent: '#7b45ff', secondary: '#341b88', motif: 'orbit' },
  crowdstrike: { label: 'CS', accent: '#d71920', secondary: '#690a0d', motif: 'wave' },
  huntress: { label: 'H', accent: '#6b4cf6', secondary: '#2b1b86', motif: 'diamond' },
  eset: { label: 'ESET', accent: '#0096a6', secondary: '#004d57', motif: 'orbit' },
  proofpoint: { label: 'PP', accent: '#e4002b', secondary: '#670014', motif: 'bars' },
  mimecast: { label: 'M', accent: '#ef4023', secondary: '#7d1709', motif: 'wave' },
  barracuda: { label: 'B', accent: '#e4002b', secondary: '#690014', motif: 'split' },
  knowbe4: { label: 'KB4', accent: '#ff6b00', secondary: '#7c3400', motif: 'bars' },
  crashplan: { label: 'CP', accent: '#f26722', secondary: '#7d2c07', motif: 'wave' },
  'cove-data-protection': { label: 'COVE', accent: '#00a5a8', secondary: '#005255', motif: 'wave' },
  sharefile: { label: 'SF', accent: '#00a651', secondary: '#005329', motif: 'split' },
  ultradns: { label: 'UDNS', accent: '#0073cf', secondary: '#003e70', motif: 'orbit' },
  linode: { label: 'L', accent: '#00a95c', secondary: '#00552f', motif: 'bars' },
  ringcentral: { label: 'RC', accent: '#0684bc', secondary: '#ffb000', motif: 'orbit' },
  '8x8': { label: '8x8', accent: '#ec1c24', secondary: '#730b0e', motif: 'split' },
  nextiva: { label: 'N', accent: '#005fec', secondary: '#002b6b', motif: 'wave' },
  intermedia: { label: 'I', accent: '#005b96', secondary: '#002c49', motif: 'bars' },
  twilio: { label: 'T', accent: '#f22f46', secondary: '#7a1020', motif: 'orbit' },
  salesforce: { label: 'SF', accent: '#00a1e0', secondary: '#005473', motif: 'wave' },
  'monday-com': { label: 'm', accent: '#6161ff', secondary: '#2f2f8c', motif: 'bars' },
  docusign: { label: 'DS', accent: '#ffcc22', secondary: '#4b3a00', motif: 'diamond' },
  nuso: { label: 'NUSO', accent: '#2464eb', secondary: '#0d2d72', motif: 'wave' }
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

function assetBaseUrl(): string {
  return import.meta.env?.BASE_URL ?? '/';
}

function escapeSvgText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function motifSvg(motif: GeneratedBrand['motif'], secondary: string): string {
  if (motif === 'bars') return `<path d="M7 14h50v5H7zm0 15h50v5H7zm0 15h50v5H7z" fill="${secondary}" opacity=".5"/>`;
  if (motif === 'diamond') return `<path d="M32 5 59 32 32 59 5 32Z" fill="none" stroke="${secondary}" stroke-width="5" opacity=".55"/>`;
  if (motif === 'orbit') return `<circle cx="32" cy="32" r="24" fill="none" stroke="${secondary}" stroke-width="4" opacity=".55"/><circle cx="50" cy="16" r="4" fill="white" opacity=".8"/>`;
  if (motif === 'split') return `<path d="M0 46 64 18v46H0Z" fill="${secondary}" opacity=".55"/>`;
  if (motif === 'wave') return `<path d="M-4 42c15-15 27 13 43-2 10-10 20-7 29-1v25H-4Z" fill="${secondary}" opacity=".55"/>`;
  return '';
}

export function generatedProviderIcon(providerId: string, providerName: string): string {
  const profile = generatedBrands[providerId];
  const label = escapeSvgText(profile?.label ?? initials(providerName || providerId));
  const hue = hueFor(providerId || providerName);
  const accent = profile?.accent ?? `hsl(${hue} 62% 34%)`;
  const secondary = profile?.secondary ?? `hsl(${hue} 72% 22%)`;
  const fontSize = label.length >= 4 ? 13 : label.length === 3 ? 16 : 22;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img"><rect width="64" height="64" rx="14" fill="${accent}"/>${motifSvg(profile?.motif, secondary)}<rect x="2" y="2" width="60" height="60" rx="12" fill="none" stroke="white" stroke-opacity=".24" stroke-width="2"/><text x="32" y="39" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="850" letter-spacing="-.5" fill="white">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function providerIconSrc(providerId: string, providerName: string): string {
  const branded = brandedLogoFiles[providerId];
  return branded
    ? `${assetBaseUrl()}assets/logos/${branded.file}`
    : generatedProviderIcon(providerId, providerName);
}

export function providerIconFallback(providerId: string, providerName: string): string {
  return generatedProviderIcon(providerId, providerName);
}

export function hasBrandedProviderIcon(providerId: string): boolean {
  return providerId in brandedLogoFiles;
}

export function providerIconPresentation(providerId: string): { monochrome: boolean; accent?: string; generated: boolean } {
  const branded = brandedLogoFiles[providerId];
  if (branded) return { monochrome: Boolean(branded.monochrome), accent: branded.accent, generated: false };
  return { monochrome: false, accent: generatedBrands[providerId]?.accent, generated: true };
}

export function curatedProviderIdentity(providerId: string): boolean {
  return providerId in brandedLogoFiles || providerId in generatedBrands;
}
