import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { txExplorerUrl } from "../lib/chains";
import type { Institution } from "../lib/types";
import { shortAddress } from "../lib/utils";
import { Button, Card, ExternalAnchor, StatusBadge, SuccessNote } from "./ui";

type Props = {
  institution: Institution;
  onRefresh: () => void;
  isRefreshing?: boolean;
};

export function RegistrationStatusPanel({ institution, onRefresh, isRefreshing }: Props) {
  const status = institution.registration_status;
  const txStatus = institution.registration_tx_status || status;
  const txHash = institution.registration_tx_hash;

  if (institution.is_registered_onchain || status === "confirmed") {
    return (
      <Card
        className="employer-onboarding-card"
        title="Institution already registered"
        eyebrow="Registration"
        actions={<Link className="btn btn-primary btn-md" to="/institution">Open Institution dashboard</Link>}
      >
        <div className="create-payroll-review-list">
          <div className="review-row"><span>Status</span><strong><StatusBadge value="confirmed" /></strong></div>
          <div className="review-row"><span>Institution</span><strong>{shortAddress(institution.institution_address)}</strong></div>
          <div className="review-row"><span>Treasury</span><strong>{shortAddress(institution.treasury_address)}</strong></div>
          <div className="review-row"><span>Tax vault</span><strong>{shortAddress(institution.tax_vault_address)}</strong></div>
        </div>
        <SuccessNote>The connected wallet is active as Institution Admin.</SuccessNote>
      </Card>
    );
  }

  if (status === "pending") {
    return (
      <Card
        className="employer-onboarding-card"
        title="Registration pending"
        eyebrow="Registration"
        actions={
          <Button type="button" variant="secondary" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCw size={16} />
            Refresh status
          </Button>
        }
      >
        <div className="create-payroll-review-list">
          <div className="review-row"><span>Status</span><strong><StatusBadge value={txStatus || "pending"} /></strong></div>
          <div className="review-row">
            <span>Submitted tx</span>
            <strong><ExternalAnchor href={txExplorerUrl(txHash)}>{txHash ? shortAddress(txHash) : "-"}</ExternalAnchor></strong>
          </div>
          <div className="review-row"><span>Institution</span><strong>{shortAddress(institution.institution_address)}</strong></div>
        </div>
        <div className="workflow-note">Backend receipt sync has not confirmed the registration yet.</div>
      </Card>
    );
  }

  if (status === "failed") {
    return (
      <Card
        className="employer-onboarding-card"
        title="Registration failed"
        eyebrow="Registration"
        actions={
          <Button type="button" variant="secondary" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCw size={16} />
            Refresh status
          </Button>
        }
      >
        <div className="create-payroll-review-list">
          <div className="review-row"><span>Status</span><strong><StatusBadge value={txStatus || "failed"} /></strong></div>
          <div className="review-row">
            <span>Submitted tx</span>
            <strong><ExternalAnchor href={txExplorerUrl(txHash)}>{txHash ? shortAddress(txHash) : "-"}</ExternalAnchor></strong>
          </div>
          <div className="review-row"><span>Retry safe</span><strong>{institution.can_retry_registration ? "Yes" : "No"}</strong></div>
        </div>
        {institution.registration_tx_error && <div className="form-error">{institution.registration_tx_error}</div>}
        {!institution.can_retry_registration && (
          <div className="workflow-note">Refresh status or contact support before submitting another wallet transaction.</div>
        )}
      </Card>
    );
  }

  return null;
}
