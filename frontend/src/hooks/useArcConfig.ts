import { useQuery } from "@tanstack/react-query";
import { adaptChainConfig } from "../lib/adapters";
import { api } from "../lib/api";
import { routes } from "../lib/routes";

export function useArcConfig() {
  return useQuery({
    queryKey: ["chain", "coston2"],
    queryFn: async () => {
      const response = await api.get<Record<string, unknown>>(routes.chains.arc);
      return adaptChainConfig(response.data);
    },
    staleTime: 60_000,
  });
}
