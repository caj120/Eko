<template>
  <div class="mt-4">
    <!-- Profile header: skeleton while loading, real content when ready -->
    <BaseAgentProfileDetailSkeleton
      v-if="isLoadingProfile"
      class="bg-base-200/75 rounded-3xl animate-pulse"
    />
    <template v-else-if="agentPubKey">
      <BaseAgentProfileDetail
        :key="profileVersion"
        :profile="profile ?? undefined"
        :joined-timestamp="joinedTimestamp"
        :agentPubKey="agentPubKey"
        :creators-count="creatorsCount || 0"
        :followers-count="followersCount || 0"
        class="bg-base-200/75 rounded-3xl"
        style="-webkit-backdrop-filter: blur(10px)"
        enable-copy-agent-pub-key
        enable-lightbox-on-avatar-click
        @click-edit-profile="showEditProfileDialog = true"
        @click-followers="
          () => {
            if (followersCount && followersCount > 0)
              showFollowersListDialog = true;
          }
        "
        @click-creators="
          () => {
            if (creatorsCount && creatorsCount > 0)
              showCreatorsListDialog = true;
          }
        "
        @toggle-follow="refetchFollowersCount"
      />
      <EditAgentProfileDialog
        v-if="profile"
        v-model="showEditProfileDialog"
        :profile="profile"
        @profile-updated="() => refreshProfile()"
      />
    </template>

    <!-- Pinned echoes: loads independently with skeleton -->
    <BaseList
      class="my-8 px-4"
      title="pinned"
      :items="pinnedEchoes"
      :is-loading="isLoadingPinnedEchoes"
      :show-empty-list="false"
    >
      <template #loading>
        <BaseListSkeleton :count="2">
          <BaseEchoListItemSkeleton />
        </BaseListSkeleton>
      </template>
      <template #default="{ item }">
        <BaseEchoListItem
          :feed-echo="item"
          @echo-pinned="patchPinnedAndRefresh"
          @echo-unpinned="patchPinnedAndRefresh"
          @echo-deleted="patchPinnedAndRefresh"
          @echo-likeed="patchPinnedEcho"
          @echo-unlikeed="patchPinnedEcho"
          @reply-created="patchPinnedEcho"
          @reecho-created="patchPinnedEcho"
          @quote-created="patchPinnedEcho"
        />
      </template>
    </BaseList>

    <!-- Authored echoes: loads independently with skeleton -->
    <BaseList
      class="my-8 px-4"
      title="echoes"
      :items="authoredEchoes"
      :is-loading="isLoadingAuthoredEchoes"
      :enable-more-button="authoredEchoes && authoredEchoes.length >= pageLimit"
      @click-more="
        router.push({
          name: 'authoredEchoes',
          params: {
            agentPubKey: route.params.agentPubKey,
          },
        })
      "
    >
      <template #loading>
        <BaseListSkeleton :count="3">
          <BaseEchoListItemSkeleton />
        </BaseListSkeleton>
      </template>
      <template #default="{ item }">
        <BaseEchoListItem
          :feed-echo="item"
          @echo-pinned="patchAuthoredAndRefreshPins"
          @echo-unpinned="patchAuthoredAndRefreshPins"
          @echo-deleted="patchAuthoredAndRefreshPins"
          @echo-likeed="patchAuthoredEcho"
          @echo-unlikeed="patchAuthoredEcho"
          @reply-created="patchAuthoredEcho"
          @reecho-created="patchAuthoredEcho"
          @quote-created="patchAuthoredEcho"
        />
      </template>
    </BaseList>
  </div>
  <FollowersListDialog
    v-if="agentPubKey"
    v-model="showFollowersListDialog"
    :agent-pub-key="agentPubKey"
  />
  <CreatorsListDialog
    v-if="agentPubKey"
    v-model="showCreatorsListDialog"
    :agent-pub-key="agentPubKey"
  />
</template>

<script setup lang="ts">
import { decodeHashFromBase64 } from "@holochain/client";
import { ComputedRef, computed, inject, nextTick, onActivated, ref, watch } from "vue";
import { useCellsReady } from "@/composables/useCellsReady";
import { useProfile } from "@/composables/useProfile";
import { useRoute, useRouter } from "vue-router";
import BaseList from "@/components/BaseList.vue";
import { AppClient } from "@holochain/client";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import BaseAgentProfileDetail from "@/components/BaseAgentProfileDetail.vue";
import BaseAgentProfileDetailSkeleton from "@/components/BaseAgentProfileDetailSkeleton.vue";
import BaseListSkeleton from "@/components/BaseListSkeleton.vue";
import BaseEchoListItemSkeleton from "@/components/BaseEchoListItemSkeleton.vue";
import EditAgentProfileDialog from "@/components/EditAgentProfileDialog.vue";
import FollowersListDialog from "@/components/FollowersListDialog.vue";
import CreatorsListDialog from "@/components/CreatorsListDialog.vue";
import { wrapInput } from "@/utils/zomeCall";
import { usePatchFeedEcho } from "@/composables/usePatchFeedEcho";
import { FeedEcho } from "@/types/types";

const client = (inject("client") as ComputedRef<AppClient>).value;
const cellsReady = useCellsReady();
const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const { patchFeedEcho } = usePatchFeedEcho();

const agentPubKey = computed(() => {
  const key = route.params.agentPubKey as string;
  return key ? decodeHashFromBase64(key) : undefined;
});
const showEditProfileDialog = ref(false);
const showFollowersListDialog = ref(false);
const showCreatorsListDialog = ref(false);
const agentPubKeyB64 = computed(() => route.params.agentPubKey);
const hasAgentPubKeyB64 = computed(() => agentPubKeyB64.value !== undefined);
const pageLimit = 5;

const fetchAuthoredEchoes = () => {
  if (!agentPubKey.value) return [];
  return client.callZome({
    role_name: "eko",
    zome_name: "echoes",
    fn_name: "get_agent_echoes_with_context",
    payload: wrapInput({
      agent: agentPubKey.value,
      page: {
        limit: pageLimit,
      },
    }),
  });
};

const authoredEchoesQueryKey = ["profiles", "get_agent_echoes_with_context", agentPubKeyB64];

const patchAuthoredEcho = (updatedEcho: FeedEcho) => {
  patchFeedEcho(authoredEchoesQueryKey, updatedEcho);
};

const {
  data: authoredEchoes,
  isLoading: isLoadingAuthoredEchoes,
  error: errorAuthoredEchoes,
  refetch: refetchAuthoredEchoes,
} = useQuery({
  queryKey: authoredEchoesQueryKey,
  queryFn: fetchAuthoredEchoes,
  enabled: computed(() => cellsReady.value && hasAgentPubKeyB64.value),
});
watch(errorAuthoredEchoes, console.error);

const fetchPinnedEchoes = () => {
  if (!agentPubKey.value) return [];
  return client.callZome({
    role_name: "eko",
    zome_name: "echoes",
    fn_name: "get_echoes_for_pinner_with_context",
    payload: wrapInput(agentPubKey.value),
  });
};

const pinnedEchoesQueryKey = ["profiles", "get_echoes_for_pinner_with_context", agentPubKeyB64];

const patchPinnedEcho = (updatedEcho: FeedEcho) => {
  patchFeedEcho(pinnedEchoesQueryKey, updatedEcho);
};

const {
  data: pinnedEchoes,
  isLoading: isLoadingPinnedEchoes,
  error: errorPinnedEchoes,
  refetch: refetchPinnedEchoes,
} = useQuery({
  queryKey: pinnedEchoesQueryKey,
  queryFn: fetchPinnedEchoes,
  enabled: computed(() => cellsReady.value && hasAgentPubKeyB64.value),
});
watch(errorPinnedEchoes, console.error);

const patchPinnedAndRefresh = (m: FeedEcho) => {
  patchPinnedEcho(m);
  patchAuthoredEcho(m);
  refetchPinnedEchoes();
};

const patchAuthoredAndRefreshPins = (m: FeedEcho) => {
  patchAuthoredEcho(m);
  refetchPinnedEchoes();
};

const {
  profile,
  isLoading: isLoadingProfile,
  profileVersion,
  refresh: refreshProfile,
} = useProfile(agentPubKey);

const fetchJoinedTimestamp = () => {
  if (!agentPubKey.value) return null;
  return client.callZome({
    role_name: "eko",
    zome_name: "profiles",
    fn_name: "get_joining_timestamp_for_agent",
    payload: wrapInput(agentPubKey.value),
  });
};

const {
  data: joinedTimestamp,
  error: errorJoinedTimestamp,
} = useQuery({
  queryKey: ["profiles", "get_joining_timestamp_for_agent", agentPubKeyB64],
  queryFn: fetchJoinedTimestamp,
  staleTime: Infinity,
  cacheTime: Infinity,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  enabled: computed(() => cellsReady.value && hasAgentPubKeyB64.value),
});
watch(errorJoinedTimestamp, console.error);

const fetchCreatorsCount = async (): Promise<number> => {
  if (!agentPubKey.value) return 0;
  return client.callZome({
    role_name: "eko",
    zome_name: "echoes",
    fn_name: "count_creators_for_follower",
    payload: wrapInput(agentPubKey.value),
  });
};

const {
  data: creatorsCount,
  error: errorCreatorsCount,
  refetch: refetchCreatorsCount,
} = useQuery({
  queryKey: ["follows", "count_creators_for_follower", agentPubKeyB64],
  queryFn: fetchCreatorsCount,
  enabled: computed(() => cellsReady.value && hasAgentPubKeyB64.value),
});
watch(errorCreatorsCount, console.error);

const fetchFollowersCount = async (): Promise<number> => {
  if (!agentPubKey.value) return 0;
  return client.callZome({
    role_name: "eko",
    zome_name: "echoes",
    fn_name: "count_followers_for_creator",
    payload: wrapInput(agentPubKey.value),
  });
};

const {
  data: followersCount,
  error: errorFollowersCount,
  refetch: refetchFollowersCount,
} = useQuery({
  queryKey: ["follows", "count_followers_for_creator", agentPubKeyB64],
  queryFn: fetchFollowersCount,
  enabled: computed(() => cellsReady.value && hasAgentPubKeyB64.value),
});
watch(errorFollowersCount, console.error);

watch(
  () => route.params.agentPubKey,
  (newKey) => {
    console.log("agentPubKey route param changed:", newKey);
    if (!newKey) return;
    nextTick(() => {
      refreshProfile();
      refetchAuthoredEchoes();
      refetchPinnedEchoes();
      refetchFollowersCount();
      refetchCreatorsCount();
    });
  }
);

// Refresh profile when navigating to this page (including via KeepAlive reactivation)
onActivated(() => refreshProfile());
</script>
