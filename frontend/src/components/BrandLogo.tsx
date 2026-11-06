import { Building2 } from 'lucide-react';
import './brand.css';

export function BrandLogo({ subtitle }: { subtitle?: string }) {
  return <div className="sme-brand" role="img" aria-label={subtitle ? `SME · ${subtitle}` : 'SME'}>
    <span className="sme-brand-icon"><Building2 size={22} aria-hidden="true" /></span>
    <div className="sme-brand-text"><strong>SME</strong>{subtitle && <small>{subtitle}</small>}</div>
  </div>;
}
