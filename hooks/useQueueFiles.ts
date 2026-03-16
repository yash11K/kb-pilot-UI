import useSWR from "swr";
import { getQueueFiles } from "@/lib/api";
import type { QueueFilters } from "@/lib/types";
import type { PaginatedResponse, KBFileListItem } from "@/lib/types";

export function useQueueFiles(filters: QueueFilters) {
  const key = `queue:${JSON.stringify(filters)}`;

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<KBFileListItem>>(
    key,
    () => getQueueFiles(filters),
  );

  return { data, error, isLoading, mutate };
}
