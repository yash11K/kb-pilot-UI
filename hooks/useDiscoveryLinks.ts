import useSWR from "swr";
import { getAllDeepLinks } from "@/lib/api";
import type { DeepLink, DeepLinkStatus, PaginatedResponse } from "@/lib/types";

export function useDiscoveryLinks(status?: DeepLinkStatus) {
  const key = `discovery-links:${status ?? "all"}`;

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<DeepLink>>(
    key,
    () => getAllDeepLinks(status),
    { refreshInterval: 30_000 },
  );

  return { data: data?.items ?? [], total: data?.total ?? 0, error, isLoading, mutate };
}
