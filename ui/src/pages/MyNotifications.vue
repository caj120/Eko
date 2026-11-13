<template>
  <div :style-fn="pageHeightCorrection">
    <BasePageHeader>notifications</BasePageHeader>

    <BaseInfiniteScroll
      v-if="
        data && data.pages && data.pages.length > 0 && data.pages[0].length > 0
      "
      @load-next="fetchNextPageInfiniteScroll"
    >
      <template v-for="(page, i) in data?.pages" :key="i">
        <template v-for="(notification, j) of page" :key="j">
          <BaseNotification
            v-observe-visibility="{
              callback: () => markRead(toRaw(notification)),
              once: true,
            }"
            :notification="notification"
            @echo-deleted="patchNotificationEcho"
            @echo-likeed="patchNotificationEcho"
            @echo-pinned="patchNotificationEcho"
            @echo-unlikeed="patchNotificationEcho"
            @echo-unpinned="patchNotificationEcho"
            @reecho-created="patchNotificationEcho"
            @quote-created="patchNotificationEcho"
            @reply-created="patchNotificationEcho"
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
import { AppClient, encodeHashToBase64, ActionHash } from "@holochain/client";
import { inject, ComputedRef, watch, toRaw, computed } from "vue";
import { useCellsReady } from "@/composables/useCellsReady";
import { onBeforeRouteLeave } from "vue-router";
import { pageHeightCorrection } from "@/utils/page-layout";
import BaseNotification from "@/components/BaseNotification.vue";
import BaseEmptyList from "@/components/BaseEmptyList.vue";
import { useInfiniteQuery, useQueryClient } from "@tanstack/vue-query";
import { makeUseNotificationsReadStore } from "@/stores/notificationsRead";
import { FeedEcho, PaginationDirectionName, Notification } from "@/types/types";
import BaseListSkeleton from "@/components/BaseListSkeleton.vue";
import BaseEchoListItemSkeleton from "@/components/BaseEchoListItemSkeleton.vue";
import BaseInfiniteScroll from "@/components/BaseInfiniteScroll.vue";
import { wrapInput } from "@/utils/zomeCall";

const client = (inject("client") as ComputedRef<AppClient>).value;
const cellsReady = useCellsReady();
const useNotificationsReadStore = makeUseNotificationsReadStore(client);
const { markRead, addNotificationStatus } = useNotificationsReadStore();
const queryClient = useQueryClient();
const myPubKeyB64 = computed(() => encodeHashToBase64(client.myPubKey));

const pageLimit = 10;

const fetchNotifications = async (params: any) => {
  const res: Notification[] = await client.callZome({
    role_name: "eko",
    zome_name: "echoes",
    fn_name: "get_notifications_for_agent",
    payload: wrapInput({
      agent: client.myPubKey,
      page: {
        limit: pageLimit,
        direction: PaginationDirectionName.Descending,
        ...params.pageParam,
      },
    }),
  });
  res.forEach((n) => addNotificationStatus(n, true));
  return res;
};

const notificationsQueryKey = ["echoes", "get_notifications_for_agent", myPubKeyB64];

const patchNotificationEcho = (updatedEcho: FeedEcho) => {
  const targetHash = encodeHashToBase64(updatedEcho.action_hash);
  queryClient.setQueryData(notificationsQueryKey, (old: any) => {
    if (!old?.pages) return old;
    return {
      ...old,
      pages: old.pages.map((page: Notification[]) =>
        page.map((n) =>
          n.feed_echo && encodeHashToBase64(n.feed_echo.action_hash) === targetHash
            ? { ...n, feed_echo: updatedEcho }
            : n
        )
      ),
    };
  });
};

const { data, error, fetchNextPage, hasNextPage, isInitialLoading } =
  useInfiniteQuery({
    queryKey: notificationsQueryKey,
    queryFn: fetchNotifications,
    getNextPageParam: (lastPage) => {
      if (lastPage.length === 0) return;
      if (lastPage.length < pageLimit) return;

      return { after_timestamp: lastPage[lastPage.length - 1].timestamp };
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
      notificationsQueryKey,
      (d: any) => ({
        pages: [d.pages[0]],
        pageParams: [d.pageParams[0]],
      })
    );
  }
});
</script>
