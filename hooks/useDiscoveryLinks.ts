import useSWR from "swr";
import { getAllDeepLinks } from "@/lib/api";
import type { DeepLink, DeepLinkStatus, PaginatedResponse } from "@/lib/types";

export function useDiscoveryLinks(status?: DeepLinkStatus, page = 1, size = 50) {
  const key = `discovery-links:${status ?? "all"}:${page}:${size}`;

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<DeepLink>>(
    key,
    () => getAllDeepLinks(status, page, size),
    { refreshInterval: 30_000 },
  );

  return {
    data: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    pages: data?.pages ?? 1,
    size: data?.size ?? size,
    error,
    isLoading,
    mutate,
  };
}
