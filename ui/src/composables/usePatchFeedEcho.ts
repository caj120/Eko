import { useQueryClient } from "@tanstack/vue-query";
import { FeedEcho } from "@/types/types";
import { encodeHashToBase64 } from "@holochain/client";

/**
 * Returns a function that patches a single FeedEcho in a vue-query cache
 * without triggering a zome refetch. Works with both useInfiniteQuery
 * (pages of FeedEcho[]) and useQuery (FeedEcho[]) data shapes.
 */
export function usePatchFeedEcho() {
  const queryClient = useQueryClient();

  const patchFeedEcho = (queryKey: unknown[], updatedEcho: FeedEcho) => {
    const targetHash = encodeHashToBase64(updatedEcho.action_hash);

    // Try infinite query shape: { pages: FeedEcho[][], pageParams: ... }
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;

      if (old.pages) {
        return {
          ...old,
          pages: old.pages.map((page: FeedEcho[]) =>
            page.map((echo) =>
              encodeHashToBase64(echo.action_hash) === targetHash
                ? updatedEcho
                : echo
            )
          ),
        };
      }

      // Plain array shape: FeedEcho[]
      if (Array.isArray(old)) {
        return old.map((echo: FeedEcho) =>
          encodeHashToBase64(echo.action_hash) === targetHash
            ? updatedEcho
            : echo
        );
      }

      return old;
    });
  };

  return { patchFeedEcho };
}
