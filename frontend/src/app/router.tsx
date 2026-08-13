import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppDashboard } from "./AppDashboard";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { RoleRoute } from "../components/RoleRoute";
import { NotificationsPage } from "../pages/NotificationsPage";
import {
  NewPrivateWithdrawalPage,
  PrivateWithdrawalDetailPage,
  PrivateWithdrawalsPage,
} from "../pages/WithdrawalsPage";
import {
  AgentAuditPage,
  AgentDashboardPage,
  AgentJobDetailPage,
  AgentTemplateDetailPage,
  AgentTemplateUploadPage,
} from "../pages/agent";
import {
  AccountPage,
  AppHomePage,
  CreatePayrollPage,
  FinanceDashboardPage,
  FinancePayrollDetailPage,
  HRDashboardPage,
  HRPayrollDetailPage,
  InstitutionPage,
  LandingPage,
  LoginPage,
  RegisterInstitutionPage,
  RolesPage,
  TransactionsPage,
} from "../pages";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppDashboard />,
        children: [
          { path: "/app", element: <AppHomePage /> },
          { path: "/institution/register", element: <RegisterInstitutionPage /> },
          {
            element: <RoleRoute roles={["admin"]} />,
            children: [
              { path: "/institution", element: <InstitutionPage /> },
              { path: "/institution/roles", element: <RolesPage /> },
            ],
          },
          {
            element: <RoleRoute roles={["hr"]} />,
            children: [
              { path: "/hr", element: <HRDashboardPage /> },
              { path: "/hr/payrolls/new", element: <CreatePayrollPage /> },
              { path: "/hr/payrolls/:runId", element: <HRPayrollDetailPage /> },
            ],
          },
          {
            element: <RoleRoute roles={["finance"]} />,
            children: [
              { path: "/finance", element: <FinanceDashboardPage /> },
              { path: "/finance/payrolls/:runId", element: <FinancePayrollDetailPage /> },
            ],
          },
          {
            element: <RoleRoute roles={["admin", "hr", "finance"]} />,
            children: [
              { path: "/agent", element: <AgentDashboardPage /> },
              { path: "/agent/templates/new", element: <AgentTemplateUploadPage /> },
              { path: "/agent/templates/:id", element: <AgentTemplateDetailPage /> },
              { path: "/agent/jobs/:jobId", element: <AgentJobDetailPage /> },
              { path: "/agent/audit", element: <AgentAuditPage /> },
            ],
          },
          { path: "/employee/claims", element: <PrivateWithdrawalsPage /> },
          { path: "/employee/claims/new", element: <NewPrivateWithdrawalPage /> },
          { path: "/employee/claims/:paymentId", element: <PrivateWithdrawalDetailPage /> },
          { path: "/transactions", element: <TransactionsPage /> },
          { path: "/notifications", element: <NotificationsPage /> },
          { path: "/account", element: <AccountPage /> },
        ],
      },
    ],
  },
  { path: "/employer", element: <Navigate to="/hr" replace /> },
  { path: "/employee", element: <Navigate to="/employee/claims" replace /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);
