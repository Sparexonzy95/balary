import { Navigate, Outlet } from "react-router-dom";
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
    return (
      <div className="access-denied" role="alert">
        <h1>Access denied</h1>
        <p>This wallet does not have the required Balary role for this workspace.</p>
      </div>
    );
  }

  return <Outlet />;
}

