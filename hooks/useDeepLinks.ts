import useSWR from "swr";
import { getDeepLinks } from "@/lib/api";
import type { DeepLink } from "@/lib/types";

export function useDeepLinks(sourceId: string | null, status = "pending") {
  const { data, error, isLoading, mutate } = useSWR(
    sourceId ? [`deep-links`, sourceId, status] : null,
    () => getDeepLinks(sourceId!, status),
    { refreshInterval: 30_000 },
  );

  return { data: data ?? [], error, isLoading, mutate };
}
