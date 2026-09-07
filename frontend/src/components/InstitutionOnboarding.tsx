import { Building2, Check, Landmark, ListChecks, UserRound, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import type { Institution } from "../lib/types";

function hasActiveRole(institution: Institution, role: "hr" | "finance") {
  return institution.members.some(
    (member) =>
      member.role === role &&
      member.status === "active" &&
      member.approved_onchain !== false,
  );
}

export function InstitutionCreatedPanel({ institution }: { institution: Institution }) {
  const rolesAssigned = hasActiveRole(institution, "hr") && hasActiveRole(institution, "finance");

  return (
    <section className="institution-created-panel" aria-labelledby="institution-created-title">
      <div className="institution-created-head">
        <span className="institution-created-icon"><Check size={20} /></span>
        <div>
          <span>Registration confirmed</span>
          <h2 id="institution-created-title">Institution created successfully</h2>
          <p>{institution.name} is active and selected for this wallet.</p>
        </div>
      </div>

      <div className="institution-setup-progress" aria-label="Setup progress">
        {[
          { label: "Institution created", complete: true },
          { label: "Assign team roles", complete: rolesAssigned },
          { label: "Add employees", complete: false },
          { label: "Create first payroll", complete: false },
        ].map((step, index) => (
          <div className={`institution-setup-step${step.complete ? " complete" : ""}`} key={step.label}>
            <span>{step.complete ? <Check size={13} /> : index + 1}</span>
            <strong>{step.label}</strong>
          </div>
        ))}
      </div>

      <div className="institution-created-actions">
        <Link className="btn btn-primary btn-md" to="/institution/roles">
          <UsersRound size={15} />
          Set up team roles
        </Link>
        <Link className="btn btn-secondary btn-md" to="/institution">
          <Building2 size={15} />
          Go to institution
        </Link>
      </div>
    </section>
  );
}

type RoleOverviewProps = {
  institution: Institution;
  canAddEmployees: boolean;
  onAssign: (role: "hr" | "finance") => void;
};

export function InstitutionRoleOverview({ institution, canAddEmployees, onAssign }: RoleOverviewProps) {
  const roles = [
    {
      role: "hr" as const,
      title: "HR",
      description: "Creates and manages employees and payroll.",
      icon: UsersRound,
    },
    {
      role: "finance" as const,
      title: "Finance",
      description: "Funds approved payrolls.",
      icon: Landmark,
    },
  ];

  return (
    <div className="institution-role-overview" aria-label="Institution role overview">
      {roles.map((item) => {
        const Icon = item.icon;
        const members = institution.members.filter(
          (member) => member.role === item.role && member.status !== "removed",
        );
        const assigned = members.some(
          (member) => member.status === "active" && member.approved_onchain !== false,
        );
        const pendingRemoval = members.some(
          (member) => member.status === "pending_onchain" && Boolean(member.removed_tx_hash),
        );
        const pendingAssignment = members.some(
          (member) => member.status === "pending_onchain" && !member.removed_tx_hash,
        );
        const status = pendingRemoval
          ? "Pending removal"
          : pendingAssignment
            ? "Pending"
            : assigned
              ? "Assigned"
              : "Not assigned";
        return (
          <div className="institution-role-overview-row" key={item.role}>
            <span className="institution-role-overview-icon"><Icon size={16} /></span>
            <div className="institution-role-overview-copy">
              <strong>{item.title}</strong>
              <span>{item.description}</span>
              <small>
                Wallet: {members.length ? members.map((member) => member.wallet_address).join(", ") : "Not assigned"}
              </small>
            </div>
            <span className={`institution-role-overview-status${assigned ? " assigned" : ""}`}>
              {assigned && !pendingRemoval ? <><Check size={13} /> {status}</> : status}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => onAssign(item.role)}
              disabled={assigned || pendingAssignment || pendingRemoval}
            >
              {pendingRemoval
                ? "Removal pending"
                : pendingAssignment
                  ? "Pending"
                  : assigned
                    ? "Assigned"
                    : `Assign ${item.title}`}
            </button>
          </div>
        );
      })}

      <div className="institution-role-overview-row">
        <span className="institution-role-overview-icon"><UserRound size={16} /></span>
        <div className="institution-role-overview-copy">
          <strong>Employee</strong>
          <span>Views and claims eligible salary payments.</span>
          <small>Wallet: Added securely while creating payroll</small>
        </div>
        <span className="institution-role-overview-status">Added by HR</span>
        {canAddEmployees ? (
          <Link className="btn btn-secondary btn-sm" to="/hr/payrolls/new">
            <ListChecks size={14} /> Add employees
          </Link>
        ) : (
          <span className="institution-role-overview-guidance">Assign HR first</span>
        )}
      </div>
    </div>
  );
}
