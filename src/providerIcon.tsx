import { logoSrc } from './logos';
import { hasBrandedLogo, providerHue, providerInitials } from './providerIconModel';
export function ProviderIcon({ id, name, className = 'provider-icon' }: { id: string; name: string; className?: string }): JSX.Element {
  return hasBrandedLogo(id) ? <img className={className} src={logoSrc(id)} alt="" width="40" height="40" /> : <span className={`${className} provider-monogram`} style={{ '--provider-hue': providerHue(id) } as React.CSSProperties} aria-hidden="true">{providerInitials(name)}</span>;
}
