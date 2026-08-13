import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { routes } from "../lib/routes";
import type { AuditEvent, FccInstruction, PayrollSchedule } from "../lib/types";

export function useFccConfiguration() {
  return useQuery({
    queryKey: ["fcc", "configuration"],
    queryFn: async () => (await api.get(routes.fcc.configuration)).data,
    staleTime: 60_000,
  });
}

export function useFccInstructions() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["fcc", "instructions"],
    enabled: isAuthenticated,
    queryFn: async () => (await api.get<FccInstruction[]>(routes.fcc.instructions)).data,
    refetchInterval: 5_000,
  });
}

export function useFccInstruction(id?: string | number) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["fcc", "instruction", String(id || "")],
    enabled: isAuthenticated && Boolean(id),
    queryFn: async () => (await api.get<FccInstruction>(routes.fcc.instruction(id!))).data,
    refetchInterval: 5_000,
  });
}

export function useProcessFccInstruction(id?: string | number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("Missing FCC instruction");
      return (await api.post<FccInstruction>(routes.fcc.process(id))).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fcc"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
    },
  });
}

export function useSchedules() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["schedules"],
    enabled: isAuthenticated,
    queryFn: async () => (await api.get<PayrollSchedule[]>(routes.schedules.list)).data,
    refetchInterval: 15_000,
  });
}

export function useSchedule(id?: string | number) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["schedules", String(id || "")],
    enabled: isAuthenticated && Boolean(id),
    queryFn: async () => (await api.get<PayrollSchedule>(routes.schedules.detail(id!))).data,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<PayrollSchedule>) =>
      (await api.post<PayrollSchedule>(routes.schedules.list, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules"] }),
  });
}

export function useScheduleAction(id?: string | number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: "run" | "pause" | "resume") => {
      if (!id) throw new Error("Missing schedule");
      const endpoint = {
        run: routes.schedules.runNow(id),
        pause: routes.schedules.pause(id),
        resume: routes.schedules.resume(id),
      }[action];
      return (await api.post<PayrollSchedule>(endpoint)).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules"] }),
  });
}

export function useAuditEvents(institutionId?: number) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["audit", institutionId || "all"],
    enabled: isAuthenticated,
    queryFn: async () =>
      (
        await api.get<AuditEvent[]>(routes.audit.events, {
          params: institutionId ? { institution_id: institutionId } : undefined,
        })
      ).data,
    refetchInterval: 15_000,
  });
}
