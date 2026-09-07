import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adaptNotification } from "../lib/adapters";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { routes } from "../lib/routes";
import type { NotificationItem, NotificationPreference } from "../lib/types";

type BackendPreference = {
  id: number;
  institution?: number | null;
  email_enabled: boolean;
  in_app_enabled: boolean;
  institution_updates: boolean;
  payroll_updates: boolean;
  withdrawal_updates: boolean;
  reminder_updates: boolean;
  security_updates: boolean;
};

function adaptPreference(raw: BackendPreference): NotificationPreference {
  return {
    id: raw.id,
    email: raw.email_enabled ? "enabled" : "disabled",
    institution: raw.institution ?? null,
    receive_institution_updates: raw.institution_updates,
    receive_payroll_updates: raw.payroll_updates,
    receive_claim_updates: raw.withdrawal_updates,
    receive_security_updates: raw.security_updates,
  };
}

export function useNotifications() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["notifications"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const response = await api.get<Record<string, unknown>[]>(routes.notifications.list);
      return response.data.map(adaptNotification);
    },
    refetchInterval: 5_000,
  });
}

export function useNotificationPreferences() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["notification-preferences"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const response = await api.get<BackendPreference>(routes.notifications.preferences);
      return adaptPreference(response.data);
    },
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<NotificationPreference>) => {
      const response = await api.patch<BackendPreference>(routes.notifications.preferences, {
        institution: payload.institution,
        email_enabled: payload.email !== "disabled",
        in_app_enabled: true,
        institution_updates: payload.receive_institution_updates,
        payroll_updates: payload.receive_payroll_updates,
        withdrawal_updates: payload.receive_claim_updates,
        security_updates: payload.receive_security_updates,
      });
      return adaptPreference(response.data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-preferences"] }),
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId?: number) => {
      if (notificationId) {
        const response = await api.post<Record<string, unknown>>(routes.notifications.markRead(notificationId));
        return adaptNotification(response.data);
      }
      const response = await api.post<{ updated: number }>(routes.notifications.markAllRead);
      return response.data;
    },
    onMutate: async (notificationId?: number) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<NotificationItem[]>(["notifications"]);
      if (previous) {
        queryClient.setQueryData<NotificationItem[]>(
          ["notifications"],
          previous.map((item) =>
            notificationId && item.id !== notificationId ? item : { ...item, read: true },
          ),
        );
      }
      return { previous };
    },
    onError: (_error, _notificationId, context) => {
      if (context?.previous) queryClient.setQueryData(["notifications"], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
