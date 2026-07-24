import type { SyntheticEvent } from 'react';
import { providerIconFallback, providerIconSrc } from './logos';

export function ProviderIcon({ id, name }: { id: string; name: string }): JSX.Element {
  const fallback = providerIconFallback(id, name);
  const onError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
  };
  return <img className="provider-logo" src={providerIconSrc(id, name)} alt="" width={40} height={40}
    loading="lazy" decoding="async" onError={onError} />;
}
