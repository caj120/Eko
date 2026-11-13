<template>
  <div>
    <div class="flex justify-start items-center space-x-2 mb-8">
      <BaseButtonBack />

      <h1 class="text-2xl font-title font-bold tracking-tighter">
        echoes with
        <span class="text-primary"
          >{{ route.meta.tag }}{{ route.params.tag }}</span
        >
      </h1>
    </div>

    <BaseInfiniteScroll
      v-if="
        data && data.pages && data.pages.length > 0 && data.pages[0].length > 0
      "
      @load-next="fetchNextPageInfiniteScroll"
    >
      <template v-for="(page, i) in data.pages" :key="i">
        <template v-for="(echo, j) of page" :key="j">
          <BaseEchoListItem
            :feed-echo="echo"
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
    </BaseInfiniteScroll>
    <BaseListSkeleton v-else-if="isInitialLoading" :count="4">
      <BaseEchoListItemSkeleton />
    </BaseListSkeleton>
    <BaseEmptyList v-else />
  </div>
</template>

<script setup lang="ts">
import { AppClient } from "@holochain/client";
import { ComputedRef, computed, inject } from "vue";
import { useCellsReady } from "@/composables/useCellsReady";
import { useRoute, onBeforeRouteLeave } from "vue-router";
import { useInfiniteQuery, useQueryClient } from "@tanstack/vue-query";
import { usePatchFeedEcho } from "@/composables/usePatchFeedEcho";
import { FeedEcho } from "@/types/types";
import BaseEmptyList from "@/components/BaseEmptyList.vue";
import BaseEchoListItem from "@/components/BaseEchoListItem.vue";
import { watch } from "vue";
import BaseButtonBack from "@/components/BaseButtonBack.vue";
import BaseInfiniteScroll from "@/components/BaseInfiniteScroll.vue";
import BaseListSkeleton from "@/components/BaseListSkeleton.vue";
import BaseEchoListItemSkeleton from "@/components/BaseEchoListItemSkeleton.vue";
import { wrapInput } from "@/utils/zomeCall";

const route = useRoute();
const client = (inject("client") as ComputedRef<AppClient>).value;
const cellsReady = useCellsReady();
const queryClient = useQueryClient();
const { patchFeedEcho } = usePatchFeedEcho();
const tag = computed(() => `${route.meta.tag}${route.params.tag}`);

const pageLimit = 5;

const fetchCashtagEchoes = async (params: any) =>
  client.callZome({
    role_name: "eko",
    zome_name: "echoes",
    fn_name: "get_echoes_for_cashtag_with_context",
    payload: wrapInput({
      cashtag: tag.value,
      page: {
        limit: pageLimit,
        ...params.pageParam,
      },
    }),
  });

const queryKey = ["echoes", "get_echoes_for_cashtag_with_context", tag];

const patchEcho = (updatedEcho: FeedEcho) => {
  patchFeedEcho(queryKey, updatedEcho);
};

const { data, error, fetchNextPage, hasNextPage, isInitialLoading } =
  useInfiniteQuery({
    queryKey,
    queryFn: fetchCashtagEchoes,
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
