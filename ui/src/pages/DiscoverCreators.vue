<template>
  <div class="w-full">
    <div class="mb-8 flex justify-between items-center">
      <BasePageHeader class="!mb-0">explore</BasePageHeader>

      <button
        class="btn btn-xs flex items-center justify-start space-x-1"
        :disabled="isShuffling"
        @click="shuffle()"
      >
        <span v-if="isShuffling" class="loading loading-spinner loading-xs"></span>
        <IconDiceOutline v-else />
        <div>Shuffle</div>
      </button>
    </div>

    <BaseList
      title="random echoes"
      class="mb-8"
      :items="randomEchoes"
      :is-loading="isLoadingRandomEchoHashes || isFetchingRandomEchoes"
    >
      <template #default="{ item }">
        <BaseEchoListItem
          :feed-echo="item"
          @echo-deleted="patchRandomEcho"
          @echo-likeed="patchRandomEcho"
          @echo-unlikeed="patchRandomEcho"
          @echo-pinned="patchRandomEcho"
          @echo-unpinned="patchRandomEcho"
          @reecho-created="patchRandomEcho"
          @reply-created="patchRandomEcho"
          @quote-created="patchRandomEcho"
        />
      </template>
      <template #loading>
        <BaseListSkeleton :count="4">
          <BaseEchoListItemSkeleton />
        </BaseListSkeleton>
      </template>
    </BaseList>

    <RandomEchoWithTagList v-if="tag1 !== undefined" :tag="tag1" />
    <RandomEchoWithTagList v-if="tag2 !== undefined" :tag="tag2" />
    <RandomEchoWithTagList v-if="tag3 !== undefined" :tag="tag3" />
  </div>
</template>

<script setup lang="ts">
import { ComputedRef, computed, inject, onMounted, ref, toRaw, watch } from "vue";
import { useCellsReady } from "@/composables/useCellsReady";
import { AppClient } from "@holochain/client";
import BaseList from "@/components/BaseList.vue";
import { FeedEcho } from "@/types/types";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { usePatchFeedEcho } from "@/composables/usePatchFeedEcho";
import IconDiceOutline from "~icons/ion/dice-outline";
import { ActionHash } from "@holochain/client";
import BaseListSkeleton from "@/components/BaseListSkeleton.vue";
import BaseEchoListItemSkeleton from "@/components/BaseEchoListItemSkeleton.vue";
import { wrapInput } from "@/utils/zomeCall";

const client = (inject("client") as ComputedRef<AppClient>).value;
const cellsReady = useCellsReady();
const { patchFeedEcho } = usePatchFeedEcho();

const fetchRandomEchoHashes = (): Promise<ActionHash[]> =>
  client.callZome({
    role_name: "eko",
    zome_name: "echoes",
    fn_name: "get_random_echo_hashes",
    payload: wrapInput(3),
  });

const fetchEchoesWithContext = async (hashes: ActionHash[]): Promise<FeedEcho[]> =>
  client.callZome({
    role_name: "eko",
    zome_name: "echoes",
    fn_name: "get_batch_echoes_with_context",
    payload: wrapInput(hashes),
  });

const {
  data: randomEchoHashes,
  error: errorRandomEchoHashes,
  isLoading: isLoadingRandomEchoHashes,
  refetch: refetchRandomEchoHashes,
} = useQuery({
  queryKey: ["echoes", "get_random_echo_hashes"],
  queryFn: () => fetchRandomEchoHashes(),
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
  enabled: cellsReady,
});
watch(errorRandomEchoHashes, console.error);

const hasRandomEchoHashes = computed(
  () => randomEchoHashes.value !== undefined && randomEchoHashes.value.length > 0
);

const randomEchoesQueryKey = ["echoes", "get_random_echo_hashes", "get_batch_echoes_with_context"];

const patchRandomEcho = (updatedEcho: FeedEcho) => {
  patchFeedEcho(randomEchoesQueryKey, updatedEcho);
};

const {
  data: randomEchoes,
  error: errorRandomEchoes,
  refetch: refetchRandomEchoes,
  isFetching: isFetchingRandomEchoes,
} = useQuery({
  queryKey: randomEchoesQueryKey,
  enabled: computed(() => cellsReady.value && hasRandomEchoHashes.value),
  queryFn: () =>
    fetchEchoesWithContext(toRaw(randomEchoHashes.value as ActionHash[])),
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
});
watch(errorRandomEchoes, console.error);

const fetchRandomTags = (): Promise<string[]> => {
  return client.callZome({
    role_name: "eko",
    zome_name: "echoes",
    fn_name: "get_random_tags",
    payload: wrapInput(4),
  });
};

const {
  data: randomTags,
  error: errorRandomTags,
  refetch: refetchRandomTags,
} = useQuery({
  queryKey: ["echoes", "get_random_tags"],
  queryFn: fetchRandomTags,
  initialData: [],
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
  enabled: cellsReady,
});
watch(errorRandomTags, console.error);

onMounted(async () => {
  if (randomEchoes.value === undefined || randomEchoes.value.length === 0) {
    await refetchEchoes();
  }
  if (randomTags.value === undefined || randomTags.value.length === 0) {
    refetchRandomTags();
  }
});

const tag1 = computed(() =>
  randomTags.value ? randomTags.value[0] : undefined
);
const tag2 = computed(() =>
  randomTags.value ? randomTags.value[1] : undefined
);
const tag3 = computed(() =>
  randomTags.value ? randomTags.value[2] : undefined
);

const isShuffling = ref(false);

const shuffle = async () => {
  isShuffling.value = true;
  try {
    await refetchEchoes();
    await refetchRandomTags();
  } finally {
    isShuffling.value = false;
  }
};

const refetchEchoes = async () => {
  await refetchRandomEchoHashes();
  if (hasRandomEchoHashes.value) {
    refetchRandomEchoes();
  }
};
</script>
