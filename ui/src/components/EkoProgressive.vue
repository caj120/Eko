<template>
  <div class="w-full">
    <BaseInfiniteScroll
      v-if="allHashes.length > 0"
      @load-next="fetchNextPageInfiniteScroll"
    >
      <div class="w-full">
        <template v-for="(slot, i) in echoSlots" :key="i">
          <BaseEchoListItem
            v-if="slot.status === 'loaded'"
            :feed-echo="slot.feedEcho"
            class="my-4"
            @echo-deleted="patchBatchEcho"
            @echo-likeed="patchBatchEcho"
            @echo-pinned="patchBatchEcho"
            @echo-unlikeed="patchBatchEcho"
            @echo-unpinned="patchBatchEcho"
            @reecho-created="patchBatchEcho"
            @quote-created="patchBatchEcho"
            @reply-created="patchBatchEcho"
          />
          <div v-else-if="slot.status === 'failed'" class="my-4 px-4">
            <div
              class="bg-base-200 rounded-md p-3 text-base-content/50 italic text-sm"
            >
              Echo unavailable
            </div>
          </div>
          <BaseEchoListItemSkeleton v-else class="my-4" />
          <hr
            v-if="i !== echoSlots.length - 1"
            class="border-base-300"
          />
        </template>
      </div>
    </BaseInfiniteScroll>
    <BaseListSkeleton v-else-if="isHashesLoading" :count="4">
      <BaseEchoListItemSkeleton />
    </BaseListSkeleton>
    <BaseEmptyList v-else />
  </div>
</template>

<script setup lang="ts">
import { AppClient, ActionHash, encodeHashToBase64 } from "@holochain/client";
import { ComputedRef, computed, inject, watch, ref } from "vue";
import { useCellsReady } from "@/composables/useCellsReady";
import { FeedEcho, PaginationDirectionName } from "@/types/types";
import {
  useInfiniteQuery,
  useQueries,
  useQueryClient,
} from "@tanstack/vue-query";
import { wrapInput } from "@/utils/zomeCall";
import BaseEchoListItem from "@/components/BaseEchoListItem.vue";
import BaseEmptyList from "@/components/BaseEmptyList.vue";
import BaseListSkeleton from "@/components/BaseListSkeleton.vue";
import BaseEchoListItemSkeleton from "@/components/BaseEchoListItemSkeleton.vue";
import BaseInfiniteScroll from "@/components/BaseInfiniteScroll.vue";
import { onBeforeRouteLeave } from "vue-router";

const client = (inject("client") as ComputedRef<AppClient>).value;
const cellsReady = useCellsReady();
const queryClient = useQueryClient();
const myPubKeyB64 = computed(() => encodeHashToBase64(client.myPubKey));
const pageLimit = 10;
const BATCH_SIZE = 5;

const hashFetchStart = ref<number>(0);

// Phase 1: Fetch just the hashes (fast, link queries only)
const fetchHashes = (params: any): Promise<ActionHash[]> => {
  hashFetchStart.value = performance.now();
  return client
    .callZome({
      role_name: "eko",
      zome_name: "echoes",
      fn_name: "get_followed_creators_echo_hashes_extern",
      payload: wrapInput({
        agent: client.myPubKey,
        page: {
          limit: pageLimit,
          direction: PaginationDirectionName.Descending,
          ...params.pageParam,
        },
      }),
    })
    .then((result: ActionHash[]) => {
      console.log(
        `[progressive] get_followed_creators_echo_hashes: ${(performance.now() - hashFetchStart.value).toFixed(0)}ms, ${result.length} hashes`
      );
      return result;
    });
};

const {
  data: hashData,
  error: hashError,
  fetchNextPage,
  hasNextPage,
  isInitialLoading: isHashesLoading,
} = useInfiniteQuery<ActionHash[]>({
  queryKey: [
    "echoes",
    "get_followed_creators_echo_hashes",
    myPubKeyB64,
  ],
  queryFn: fetchHashes,
  getNextPageParam: (lastPage) => {
    if (lastPage.length === 0) return;
    if (lastPage.length < pageLimit) return;
    return { after_hash: lastPage[lastPage.length - 1] };
  },
  refetchInterval: 1000 * 60 * 2,
  refetchOnMount: true,
  enabled: cellsReady,
});
watch(hashError, console.error);

// Flatten all hashes across pages
const allHashes = computed<ActionHash[]>(() => {
  if (!hashData.value?.pages) return [];
  return hashData.value.pages.flat();
});

// Split hashes into batches of BATCH_SIZE
const hashBatches = computed(() => {
  const batches: ActionHash[][] = [];
  const hashes = allHashes.value;
  for (let i = 0; i < hashes.length; i += BATCH_SIZE) {
    batches.push(hashes.slice(i, i + BATCH_SIZE));
  }
  return batches;
});

// Phase 2: Fetch context for each batch in parallel
const batchStartTimes = ref<Map<string, number>>(new Map());

const batchQueries = useQueries({
  queries: computed(() =>
    hashBatches.value.map((batch, batchIndex) => {
      const batchKey = batch
        .map((h) => encodeHashToBase64(h))
        .join(",");
      return {
        queryKey: [
          "echoes",
          "get_batch_echoes_with_context",
          batchKey,
        ],
        queryFn: async () => {
          const start = performance.now();
          batchStartTimes.value.set(batchKey, start);
          const result: FeedEcho[] = await client.callZome({
            role_name: "eko",
            zome_name: "echoes",
            fn_name: "get_batch_echoes_with_context",
            payload: wrapInput(batch),
          });
          const elapsed = performance.now() - start;
          const totalElapsed = performance.now() - hashFetchStart.value;
          console.log(
            `[progressive] batch ${batchIndex} context: ${elapsed.toFixed(0)}ms (${result.length}/${batch.length} resolved), total elapsed: ${totalElapsed.toFixed(0)}ms`
          );
          return result;
        },
        enabled: cellsReady.value && batch.length > 0,
        staleTime: 1000 * 60 * 2,
      };
    })
  ),
});

// Build the slot list: map each hash to its resolved FeedEcho or a status
type EchoSlot =
  | { status: "loading" }
  | { status: "loaded"; feedEcho: FeedEcho }
  | { status: "failed" };

const echoSlots = computed<EchoSlot[]>(() => {
  const slots: EchoSlot[] = [];
  const hashes = allHashes.value;

  // Build a lookup from action_hash to FeedEcho across all batch results
  const resolvedMap = new Map<string, FeedEcho>();
  for (const queryResult of batchQueries) {
    if (queryResult.data) {
      for (const feedEcho of queryResult.data as FeedEcho[]) {
        resolvedMap.set(
          encodeHashToBase64(feedEcho.action_hash),
          feedEcho
        );
      }
    }
  }

  // Determine which batches have completed (success or error)
  for (let i = 0; i < hashes.length; i++) {
    const hashB64 = encodeHashToBase64(hashes[i]);
    const batchIndex = Math.floor(i / BATCH_SIZE);
    const batchResult = batchQueries[batchIndex];
    const feedEcho = resolvedMap.get(hashB64);

    if (feedEcho) {
      slots.push({ status: "loaded", feedEcho });
    } else if (batchResult && (batchResult.isError || batchResult.isSuccess)) {
      // Batch completed but this hash wasn't in the results
      slots.push({ status: "failed" });
    } else {
      slots.push({ status: "loading" });
    }
  }

  return slots;
});

// Patch a single echo across all batch caches
const patchBatchEcho = (updatedEcho: FeedEcho) => {
  const targetHash = encodeHashToBase64(updatedEcho.action_hash);
  for (const batch of hashBatches.value) {
    const batchKey = batch.map((h) => encodeHashToBase64(h)).join(",");
    const qk = ["echoes", "get_batch_echoes_with_context", batchKey];
    queryClient.setQueryData(qk, (old: FeedEcho[] | undefined) => {
      if (!old) return old;
      return old.map((echo) =>
        encodeHashToBase64(echo.action_hash) === targetHash ? updatedEcho : echo
      );
    });
  }
};

const fetchNextPageInfiniteScroll = async (
  done: (hasMore?: boolean) => void
) => {
  await fetchNextPage();
  done(hasNextPage?.value);
};

onBeforeRouteLeave(() => {
  if (hashData.value && hashData.value.pages.length > 1) {
    queryClient.setQueryData(
      ["echoes", "get_followed_creators_echo_hashes", myPubKeyB64],
      (d: any) => ({
        pages: [d.pages[0]],
        pageParams: [d.pageParams[0]],
      })
    );
  }
});
</script>
