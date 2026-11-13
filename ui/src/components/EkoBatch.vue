<template>
  <div class="w-full">
    <BaseInfiniteScroll
      v-if="
        data && data.pages && data.pages.length > 0 && data.pages[0].length > 0
      "
      @load-next="fetchNextPageInfiniteScroll"
    >
      <div class="w-full">
        <template v-for="(page, i) in data.pages" :key="i">
          <template v-for="(echo, j) of page" :key="j">
            <BaseEchoListItem
              :feed-echo="echo"
              class="my-4"
              @echo-deleted="patchEcho"
              @echo-likeed="patchEcho"
              @echo-pinned="patchEcho"
              @echo-unlikeed="patchEcho"
              @echo-unpinned="patchEcho"
              @reecho-created="patchEcho"
              @quote-created="patchEcho"
              @reply-created="patchEcho"
            />
            <hr v-if="j !== page.length - 1" class="border-base-300" />
          </template>
        </template>
      </div>
    </BaseInfiniteScroll>
    <BaseListSkeleton v-else-if="isInitialLoading" :count="4">
      <BaseEchoListItemSkeleton />
    </BaseListSkeleton>
    <BaseEmptyList v-else />
  </div>
</template>

<script setup lang="ts">
import { AppClient, encodeHashToBase64 } from "@holochain/client";
import { ComputedRef, computed, inject, watch } from "vue";
import { useCellsReady } from "@/composables/useCellsReady";
import { FeedEcho, PaginationDirectionName } from "@/types/types";
import { useInfiniteQuery, useQueryClient } from "@tanstack/vue-query";
import { usePatchFeedEcho } from "@/composables/usePatchFeedEcho";
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
const { patchFeedEcho } = usePatchFeedEcho();
const myPubKeyB64 = computed(() => encodeHashToBase64(client.myPubKey));
const pageLimit = 10;

const fetchEko = (params: any): Promise<FeedEcho[]> => {
  const start = performance.now();
  return client
    .callZome({
      role_name: "eko",
      zome_name: "echoes",
      fn_name: "get_followed_creators_echoes_with_context",
      payload: wrapInput({
        agent: client.myPubKey,
        page: {
          limit: pageLimit,
          direction: PaginationDirectionName.Descending,
          ...params.pageParam,
        },
      }),
    })
    .then((result: FeedEcho[]) => {
      console.log(
        `[batch] get_followed_creators_echoes_with_context: ${(performance.now() - start).toFixed(0)}ms, ${result.length} echoes`
      );
      return result;
    });
};

const queryKey = ["echoes", "get_followed_creators_echoes_with_context", myPubKeyB64];

const patchEcho = (updatedEcho: FeedEcho) => {
  patchFeedEcho(queryKey, updatedEcho);
};

const { data, error, fetchNextPage, hasNextPage, isInitialLoading } =
  useInfiniteQuery<FeedEcho[]>({
    queryKey,
    queryFn: fetchEko,
    getNextPageParam: (lastPage) => {
      if (lastPage.length === 0) return;
      if (lastPage.length < pageLimit) return;

      return { after_hash: lastPage[lastPage.length - 1].action_hash };
    },
    refetchInterval: 1000 * 60 * 2, // 2 minutes
    refetchOnMount: true,
    enabled: cellsReady,
  });
watch(error, console.error);

const fetchNextPageInfiniteScroll = async (
  done: (hasMore?: boolean) => void
) => {
  await fetchNextPage();
  done(hasNextPage?.value);
};

onBeforeRouteLeave(() => {
  if (data.value && data.value.pages.length > 1) {
    queryClient.setQueryData(
      queryKey,
      (d: any) => ({
        pages: [d.pages[0]],
        pageParams: [d.pageParams[0]],
      })
    );
  }
});
</script>
