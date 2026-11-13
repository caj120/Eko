<template>
  <BaseList
    class="mb-8"
    :title="`echoes about ${tag}`"
    :items="randomEchoesWithTag"
    :is-loading="isLoadingRandomEchoHashesWithTag || isFetchingRandomEchoesWithTag"
  >
    <template #default="{ item }">
      <BaseEchoListItem
        :feed-echo="item"
        @echo-deleted="patchEcho"
        @echo-likeed="patchEcho"
        @echo-unlikeed="patchEcho"
        @echo-pinned="patchEcho"
        @echo-unpinned="patchEcho"
        @reecho-created="patchEcho"
        @reply-created="patchEcho"
        @quote-created="patchEcho"
      />
    </template>
    <template #loading>
      <BaseListSkeleton :count="4">
        <BaseEchoListItemSkeleton />
      </BaseListSkeleton>
    </template>
  </BaseList>
</template>

<script setup lang="ts">
import { AppClient, ActionHash } from "@holochain/client";
import { ComputedRef, Ref, computed, inject, toRaw, watch } from "vue";
import { useCellsReady } from "@/composables/useCellsReady";
import { useQuery } from "@tanstack/vue-query";
import { usePatchFeedEcho } from "@/composables/usePatchFeedEcho";
import { FeedEcho } from "@/types/types";
import { wrapInput } from "@/utils/zomeCall";

const client = (inject("client") as ComputedRef<AppClient>).value;
const cellsReady = useCellsReady();
const { patchFeedEcho } = usePatchFeedEcho();

const props = defineProps<{
  tag: string;
}>();

const tagRef = computed(() => props.tag);

const fetchRandomEchoHashesWithTag = (): Promise<ActionHash[]> =>
  client.callZome({
    role_name: "eko",
    zome_name: "echoes",
    fn_name: "get_random_echo_hashes_for_tag",
    payload: wrapInput({
      tag: props.tag,
      count: 3,
    }),
  });

const {
  data: randomEchoHashesWithTag,
  error: errorRandomEchoHashesWithTag,
  isLoading: isLoadingRandomEchoHashesWithTag,
  refetch: refetchRandomEchoHashesWithTag,
} = useQuery({
  queryKey: ["echoes", "get_random_echo_hashes_for_tag", tagRef],
  queryFn: fetchRandomEchoHashesWithTag,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
  enabled: cellsReady,
});
watch(errorRandomEchoHashesWithTag, console.error);
const hasRandomEchoHashesWithTag = computed(() =>
  randomEchoHashesWithTag.value
    ? (randomEchoHashesWithTag as Ref<ActionHash[]>).value.length > 0
    : false
);

const fetchEchoesWithContext = async (): Promise<FeedEcho[]> =>
  client.callZome({
    role_name: "eko",
    zome_name: "echoes",
    fn_name: "get_batch_echoes_with_context",
    payload: wrapInput(toRaw(randomEchoHashesWithTag.value)),
  });

const randomEchoesWithTagQueryKey = [
  "echoes",
  "get_random_echo_hashes_for_tag",
  tagRef,
  "get_batch_echoes_with_context",
];

const patchEcho = (updatedEcho: FeedEcho) => {
  patchFeedEcho(randomEchoesWithTagQueryKey, updatedEcho);
};

const {
  data: randomEchoesWithTag,
  error: errorRandomEchoesWithTag,
  isFetching: isFetchingRandomEchoesWithTag,
  refetch: refetchRandomEchoesWithTag,
} = useQuery({
  queryKey: randomEchoesWithTagQueryKey,
  queryFn: fetchEchoesWithContext,
  enabled: computed(() => cellsReady.value && hasRandomEchoHashesWithTag.value),
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
});
watch(errorRandomEchoesWithTag, console.error);

watch(props, () => {
  refetchRandomEchoHashesWithTag();
});

watch(randomEchoHashesWithTag, () => {
  if (hasRandomEchoHashesWithTag.value) {
    refetchRandomEchoesWithTag();
  }
});
</script>
