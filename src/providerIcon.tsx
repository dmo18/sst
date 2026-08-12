import type { CSSProperties, SyntheticEvent } from 'react';
import { providerFavicons } from './generated/providerFavicons';
import { providerIconFallback, providerIconPresentation, providerIconSrc } from './logos';

type ProviderIconStyle = CSSProperties & {
  '--provider-accent'?: string;
  '--provider-logo-mask'?: string;
};

export function ProviderIcon({ id, name }: { id: string; name: string }): JSX.Element {
  const fallback = providerIconFallback(id, name);
  const favicon = providerFavicons[id];
  const source = favicon || providerIconSrc(id, name);
  const presentation = providerIconPresentation(id);

  if (presentation.monochrome && presentation.accent) {
    const style: ProviderIconStyle = {
      '--provider-accent': presentation.accent,
      '--provider-logo-mask': `url("${source}")`
    };
    return <span className="provider-logo provider-logo--brand-mask" style={style} role="img" aria-label={`${name} logo`} />;
  }

  const className = [
    'provider-logo',
    presentation.generated ? 'provider-logo--generated' : '',
    favicon ? 'provider-logo--favicon' : ''
  ].filter(Boolean).join(' ');
  const style = presentation.accent ? ({ '--provider-accent': presentation.accent } as ProviderIconStyle) : undefined;
  const onError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.src === fallback) return;
    event.currentTarget.src = fallback;
    event.currentTarget.classList.add('provider-logo--generated');
    event.currentTarget.classList.remove('provider-logo--favicon');
    event.currentTarget.style.removeProperty('--provider-accent');
  };
  return <img className={className} style={style} src={source} alt="" width={40} height={40}
    loading="eager" decoding="async" onError={onError} />;
}
