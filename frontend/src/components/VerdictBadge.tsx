import React from 'react';
import { CheckCircle2, AlertTriangle, HelpCircle, XCircle } from 'lucide-react';
import { Verdict } from '../types/domain';

interface VerdictBadgeProps {
  verdict: Verdict | '';
}

export const VerdictBadge: React.FC<VerdictBadgeProps> = ({ verdict }) => {
  if (!verdict) {
    return <span className="badge badge-neutral">PENDING EVALUATION</span>;
  }

  switch (verdict) {
    case 'SUPPORTED':
      return (
        <span className="badge badge-success" title="Supported: Evidence supports the skill claim">
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>SUPPORTED</span>
        </span>
      );
    case 'INSUFFICIENT_EVIDENCE':
      return (
        <span className="badge badge-warning" title="Insufficient Evidence: Evidence is too weak or incomplete">
          <HelpCircle size={14} aria-hidden="true" />
          <span>INSUFFICIENT EVIDENCE</span>
        </span>
      );
    case 'NOT_SUPPORTED':
      return (
        <span 
          className="badge" 
          style={{
            backgroundColor: '#FFF2E6',
            color: '#B25900',
            border: '1px solid rgba(178, 89, 0, 0.2)'
          }} 
          title="Not Supported: Evidence contradicts the claim"
        >
          <XCircle size={14} aria-hidden="true" />
          <span>NOT SUPPORTED</span>
        </span>
      );
    case 'INCONCLUSIVE':
      return (
        <span className="badge badge-neutral" title="Inconclusive: Evidence could not be evaluated reliably">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>INCONCLUSIVE</span>
        </span>
      );
    default:
      return <span className="badge badge-neutral">{verdict}</span>;
  }
};
