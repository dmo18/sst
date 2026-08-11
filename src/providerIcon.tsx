import type { CSSProperties, SyntheticEvent } from 'react';
import { providerIconFallback, providerIconPresentation, providerIconSrc } from './logos';

export function ProviderIcon({ id, name }: { id: string; name: string }): JSX.Element {
  const fallback = providerIconFallback(id, name);
  const presentation = providerIconPresentation(id);
  const className = [
    'provider-logo',
    presentation.monochrome ? 'provider-logo--monochrome' : '',
    presentation.generated ? 'provider-logo--generated' : ''
  ].filter(Boolean).join(' ');
  const style = presentation.accent
    ? ({ '--provider-accent': presentation.accent } as CSSProperties)
    : undefined;
  const onError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.src === fallback) return;
    event.currentTarget.src = fallback;
    event.currentTarget.classList.remove('provider-logo--monochrome');
    event.currentTarget.classList.add('provider-logo--generated');
    event.currentTarget.style.removeProperty('--provider-accent');
  };
  return <img className={className} style={style} src={providerIconSrc(id, name)} alt="" width={40} height={40}
    loading="lazy" decoding="async" onError={onError} />;
}
