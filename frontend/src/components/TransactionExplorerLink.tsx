import { ExternalLink } from "lucide-react";
import { txExplorerUrl } from "../lib/chains";
import { shortAddress } from "../lib/utils";

export function TransactionExplorerLink({
  hash,
  label,
}: {
  hash?: string | null;
  label: string;
}) {
  const href = txExplorerUrl(hash);
  if (!hash || !href) return null;

  const accessibleLabel = `${label}: ${hash}`;
  return (
    <a
      className="address-pill"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      <span>{label}</span>
      <span aria-hidden="true"> ({shortAddress(hash)})</span>
      <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}
