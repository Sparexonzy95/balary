import { Link, Navigate, Outlet } from "react-router-dom";
import { hasInstitutionRole, useInstitutions } from "../hooks/useInstitutions";
import { useAuth } from "../lib/auth";
import type { Institution, InstitutionRole } from "../lib/types";
import { LoadingState } from "./ui";

export function userHasAnyRole(
  institutions: Institution[] | undefined,
  walletAddress: string | null | undefined,
  allowedRoles: InstitutionRole[],
) {
  if (!institutions?.length || !walletAddress) return false;
  return institutions.some((institution) =>
    allowedRoles.some((role) => hasInstitutionRole(institution, walletAddress, role)),
  );
}

export function RoleRoute({ roles }: { roles: InstitutionRole[] }) {
  const auth = useAuth();
  const institutions = useInstitutions();

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (institutions.isLoading) {
    return <LoadingState label="Checking access" />;
  }

  if (!userHasAnyRole(institutions.data, auth.account?.wallet_address, roles)) {
    const roleLabel = roles.map((role) => role === "hr" ? "HR" : role[0].toUpperCase() + role.slice(1)).join(" or ");
    const isInstitutionAdmin = userHasAnyRole(
      institutions.data,
      auth.account?.wallet_address,
      ["admin"],
    );
    const hasInstitution = Boolean(institutions.data?.length);

    return (
      <div className="access-denied" role="alert">
        <span className="access-denied-kicker">Access denied</span>
        <h1>
          {hasInstitution
            ? `You don't currently have the ${roleLabel} role for this institution.`
            : "No institution workspace yet"}
        </h1>
        <p>
          {isInstitutionAdmin
            ? "Assign the required team role to this wallet before opening this workspace."
            : hasInstitution
              ? "Ask an institution admin to assign the required role to this wallet."
              : "Create your first institution to start using confidential payroll."}
        </p>
        {isInstitutionAdmin ? (
          <Link className="btn btn-primary btn-md" to="/institution/roles">Assign roles</Link>
        ) : !hasInstitution ? (
          <Link className="btn btn-primary btn-md" to="/institution/register">Create institution</Link>
        ) : (
          <Link className="btn btn-secondary btn-md" to="/app">Go to available workspace</Link>
        )}
      </div>
    );
  }

  return <Outlet />;
}
