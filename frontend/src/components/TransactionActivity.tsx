import { ArrowRight } from "lucide-react";
import { txExplorerUrl } from "../lib/chains";

export type TransactionActivityTone = "complete" | "pending" | "active" | "idle";

export type TransactionActivityItem = {
  title: string;
  status: string;
  txHash?: string | null;
  txHashes?: Array<{ hash: string; label: string }>;
  tone: TransactionActivityTone;
  emptyLabel?: string;
};

export function TransactionActivity({
  items,
  actionHeading = "Action",
}: {
  items: TransactionActivityItem[];
  actionHeading?: string;
}) {
  return (
    <div className="claim-detail-premium-activity balary-proof-activity">
      <div className="claim-detail-premium-activity-list">
        <div className="claim-detail-premium-activity-table-head" aria-hidden="true">
          <span>Activity</span>
          <span>Status</span>
          <span>{actionHeading}</span>
        </div>

        {items.map((item) => {
          const href = item.txHash ? txExplorerUrl(item.txHash) : null;
          const hasMultipleLinks = item.txHashes && item.txHashes.length > 0;
          const key = `${item.title}:${item.txHash || item.txHashes?.[0]?.hash || item.status}`;
          
          return (
            <div className="claim-detail-premium-activity-row" key={key}>
              <span
                className={`claim-detail-premium-activity-dot claim-detail-premium-activity-dot-${item.tone}`}
              />
              <span className="claim-detail-premium-activity-name">{item.title}</span>
              <strong className="claim-detail-premium-activity-status">{item.status}</strong>
              {hasMultipleLinks ? (
                <div className="stack" style={{ gap: "0.5rem", justifyContent: "flex-end" }}>
                  {item.txHashes?.map((tx) => (
                    <a key={tx.hash} href={txExplorerUrl(tx.hash)} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem" }}>
                      <span>{tx.label}</span>
                      <ArrowRight size={15} strokeWidth={2} />
                    </a>
                  ))}
                </div>
              ) : href ? (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  <span className="claim-detail-action-label-desktop">View transaction</span>
                  <span className="claim-detail-action-label-mobile">View</span>
                  <ArrowRight size={15} strokeWidth={2} />
                </a>
              ) : (
                <small>{item.emptyLabel || "No transaction yet"}</small>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}