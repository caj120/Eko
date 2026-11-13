<template>
  <div class="w-full">
    <div class="flex justify-start items-center space-x-2 mb-8">
      <BaseButtonBack />

      <h1 class="text-2xl font-title font-bold tracking-tighter">yarn</h1>
    </div>

    <div>
      <BaseEchoListItem
        v-if="echo"
        :feed-echo="echo"
        :disable-truncate-content="true"
        class="bg-base-200 rounded-3xl mb-8 !cursor-default"
        @echo-deleted="patchRootEcho"
        @echo-likeed="patchRootEcho"
        @echo-pinned="patchRootEcho"
        @echo-unlikeed="patchRootEcho"
        @echo-unpinned="patchRootEcho"
        @reecho-created="patchRootEcho"
        @quote-created="patchRootEcho"
        @reply-created="patchRootEcho"
      />
      <BaseEchoListItemSkeleton v-else-if="isInitialLoadingEcho" />
    </div>

    <h2 class="text-xl font-title font-bold tracking-tighter mb-2">replies</h2>
    <BaseInfiniteScroll
      v-if="replies && replies.pages.length > 0 && replies.pages[0].length > 0"
      @load-next="fetchNextPageReplies"
    >
      <template v-for="(page, i) in replies.pages" :key="i">
        <template v-for="(reply, j) of page" :key="j">
          <BaseEchoListItem
            :feed-echo="reply"
            :enable-yarn-link="false"
            @echo-deleted="patchReply"
            @echo-likeed="patchReply"
            @echo-pinned="patchReply"
            @echo-unlikeed="patchReply"
            @echo-unpinned="patchReply"
            @reecho-created="patchReply"
            @quote-created="patchReply"
            @reply-created="patchReply"
          />
          <hr v-if="j !== page.length - 1" class="border-base-300" />
        </template>
      </template>
    </BaseInfiniteScroll>
    <BaseListSkeleton v-else-if="isInitialLoadingReplies" :count="4">
      <BaseEchoListItemSkeleton />
    </BaseListSkeleton>
    <BaseEmptyList v-else />
  </div>
</template>

<script setup lang="ts">
import BaseEchoListItem from "@/components/BaseEchoListItem.vue";
import BaseEchoListItemSkeleton from "@/components/BaseEchoListItemSkeleton.vue";
import { FeedEcho, PaginationDirectionName } from "@/types/types";
import { usePatchFeedEcho } from "@/composables/usePatchFeedEcho";
import { decodeHashFromBase64 } from "@holochain/client";
import { ComputedRef, computed, inject, watch } from "vue";
import { useCellsReady } from "@/composables/useCellsReady";
import { useRoute, onBeforeRouteLeave } from "vue-router";
import { AppClient } from "@holochain/client";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import BaseButtonBack from "@/components/BaseButtonBack.vue";
import BaseListSkeleton from "@/components/BaseListSkeleton.vue";
import BaseInfiniteScroll from "@/components/BaseInfiniteScroll.vue";
import { wrapInput } from "@/utils/zomeCall";

const client = (inject("client") as ComputedRef<AppClient>).value;
const cellsReady = useCellsReady();
const route = useRoute();
const queryClient = useQueryClient();
const { patchFeedEcho } = usePatchFeedEcho();

const pageLimit = 10;

const actionHash = computed(() => {
  const hash = route.params.actionHash as string;
  return hash ? decodeHashFromBase64(hash) : undefined;
});
const actionHashB64 = computed(() => route.params.actionHash);
const hasActionHash = computed(() => actionHash.value !== undefined);

const fetchEcho = () => {
  if (!actionHash.value) return null;
  return client.callZome({
    role_name: "eko",
    zome_name: "echoes",
    fn_name: "get_echo_with_context",
    payload: wrapInput(actionHash.value),
  });
};

const echoQueryKey = ["echoes", "get_echo_with_context", actionHashB64];

const patchRootEcho = (updatedEcho: FeedEcho) => {
  queryClient.setQueryData(echoQueryKey, updatedEcho);
};

const {
  data: echo,
  error: echoError,
  isInitialLoading: isInitialLoadingEcho,
} = useQuery({
  queryKey: echoQueryKey,
  queryFn: fetchEcho,
  enabled: computed(() => cellsReady.value && hasActionHash.value),
  refetchInterval: 1000 * 60 * 2, // 2 minutes
});
watch(echoError, console.error);

const fetchReplies = (params: any) => {
  if (!echo?.value?.action_hash) return [];
  return client.callZome({
    role_name: "eko",
    zome_name: "echoes",
    fn_name: "get_responses_for_echo_with_context",
    payload: wrapInput({
      original_echo_hash: echo.value.action_hash,
      page: {
        limit: pageLimit,
        direction: PaginationDirectionName.Ascending,
        ...params.pageParam,
      },
    }),
  });
};

const hasEcho = computed(() => echo.value !== undefined);

const repliesQueryKey = ["echoes", "get_responses_for_echo_with_context", actionHashB64];

const patchReply = (updatedEcho: FeedEcho) => {
  patchFeedEcho(repliesQueryKey, updatedEcho);
};

const {
  data: replies,
  error: errorReplies,
  fetchNextPage,
  hasNextPage,
  isInitialLoading: isInitialLoadingReplies,
} = useInfiniteQuery({
  queryKey: repliesQueryKey,
  queryFn: fetchReplies,
  enabled: computed(() => cellsReady.value && hasEcho.value),
  getNextPageParam: (lastPage) => {
    if (lastPage.length === 0) return;
    if (lastPage.length < pageLimit) return;

    return { after_hash: lastPage[lastPage.length - 1].action_hash };
  },
  refetchInterval: 1000 * 60 * 2, // 2 minutes
  refetchOnMount: true,
});
watch(errorReplies, console.error);

const fetchNextPageReplies = async (done: (hasMore?: boolean) => void) => {
  await fetchNextPage();
  done(hasNextPage?.value);
};


onBeforeRouteLeave(() => {
  if (replies.value && replies.value.pages.length > 1) {
    queryClient.setQueryData(
      repliesQueryKey,
      (d: any) => ({
        pages: [d.pages[0]],
        pageParams: [d.pageParams[0]],
      })
    );
  }
});
</script>
