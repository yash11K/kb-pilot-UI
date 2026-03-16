import useSWR from "swr";
import { getSources } from "@/lib/api";
import type { PaginatedResponse, SourceListItem } from "@/lib/types";

export function useSources(params: { region?: string; brand?: string; page?: number; size?: number }) {
  const key = `sources:${JSON.stringify(params)}`;

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<SourceListItem>>(
    key,
    () => getSources(params),
  );

  return { data, error, isLoading, mutate };
}
