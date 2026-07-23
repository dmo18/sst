const logoFiles: Record<string, string> = {
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

export function logoSrc(providerId: string): string {
  return `${import.meta.env.BASE_URL}assets/logos/${logoFiles[providerId] ?? 'provider.svg'}`;
}
