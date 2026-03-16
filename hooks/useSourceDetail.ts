import useSWR from "swr";
import { getSourceDetail } from "@/lib/api";
import type { SourceDetail } from "@/lib/types";

export function useSourceDetail(sourceId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<SourceDetail>(
    sourceId ? `source-detail:${sourceId}` : null,
    () => {
      if (!sourceId) throw new Error("No source ID");
      return getSourceDetail(sourceId);
    },
  );

  return { data, error, isLoading, mutate };
}
