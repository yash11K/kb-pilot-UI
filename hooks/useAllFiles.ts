import useSWR from "swr";
import { getAllFiles } from "@/lib/api";
import type { FileFilters } from "@/lib/types";
import type { PaginatedResponse, KBFileListItem } from "@/lib/types";

export function useAllFiles(filters: FileFilters) {
  const key = `files:${JSON.stringify(filters)}`;

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<KBFileListItem>>(
    key,
    () => getAllFiles(filters),
  );

  return { data, error, isLoading, mutate };
}
