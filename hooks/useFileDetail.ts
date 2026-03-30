import useSWR from "swr";
import { getQueueFileDetail, getFileDetail } from "@/lib/api";
import type { KBFile } from "@/lib/types";

export function useFileDetail(id: string | null, source: "queue" | "files") {
  const key = id ? `file-detail:${source}:${id}` : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<KBFile>(
    key,
    () => {
      if (!id) throw new Error("No file ID");
      return source === "queue" ? getQueueFileDetail(id) : getFileDetail(id);
    },
    { keepPreviousData: true },
  );

  return { data, error, isLoading, isValidating, mutate };
}
