import { ArrowRight } from "lucide-react";
import { txExplorerUrl } from "../lib/chains";

export type TransactionActivityTone = "complete" | "pending" | "active" | "idle";

export type TransactionActivityItem = {
  title: string;
  status: string;
  txHash?: string | null;
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
          return (
            <div className="claim-detail-premium-activity-row" key={`${item.title}:${item.txHash || item.status}`}>
              <span
                className={`claim-detail-premium-activity-dot claim-detail-premium-activity-dot-${item.tone}`}
              />
              <span className="claim-detail-premium-activity-name">{item.title}</span>
              <strong className="claim-detail-premium-activity-status">{item.status}</strong>
              {href ? (
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