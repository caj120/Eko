<template>
  <section class="my-8 px-4">
    <div class="flex justify-between items-center mb-4">
      <div>
        <h2 class="text-2xl font-title tracking-tight">Track record</h2>
        <div class="text-xs opacity-70 font-mono">
          {{ distinctCount ?? 0 }} distinct
          {{ distinctCount === 1 ? "person" : "people" }} credited this agent
        </div>
      </div>
      <button
        v-if="!isMe"
        class="btn btn-sm btn-primary rounded-3xl px-4"
        @click="openCredit"
      >
        Give credit
      </button>
    </div>

    <div v-if="isLoading" class="animate-pulse bg-base-200/75 rounded-2xl h-20"></div>
    <div v-else-if="!credits || credits.length === 0" class="text-sm opacity-60">
      No credits yet.
    </div>
    <div v-else class="space-y-3">
      <BaseCreditCard
        v-for="c in credits"
        :key="encodeHashToBase64(c.action_hash)"
        :credit="c"
        @retracted="refresh"
      />
    </div>
  </section>

  <CreateProfileIfNotFoundDialog
    v-model="showProfileDialog"
    @profile-created="openCredit"
  />
  <CreditDialog
    v-model="showCreditDialog"
    :recipient="agentPubKey"
    @credit-created="refresh"
  />
</template>

<script setup lang="ts">
import { computed, ComputedRef, inject, ref, watch } from "vue";
import { AgentPubKey, AppClient, encodeHashToBase64 } from "@holochain/client";
import { Profile } from "@holochain-open-dev/profiles";
import { useQuery } from "@tanstack/vue-query";
import isEqual from "lodash/isEqual";
import { useCellsReady } from "@/composables/useCellsReady";
import { wrapInput } from "@/utils/zomeCall";
import { CreditWithContext } from "@/types/types";
import BaseCreditCard from "@/components/BaseCreditCard.vue";
import CreditDialog from "@/components/CreditDialog.vue";
import CreateProfileIfNotFoundDialog from "@/components/CreateProfileIfNotFoundDialog.vue";

const props = defineProps<{ agentPubKey: AgentPubKey }>();

const client = (inject("client") as ComputedRef<AppClient>).value;
const myProfile = inject("myProfile") as ComputedRef<Profile>;
const cellsReady = useCellsReady();

const showCreditDialog = ref(false);
const showProfileDialog = ref(false);

const keyB64 = computed(() => encodeHashToBase64(props.agentPubKey));
const isMe = computed(() => isEqual(client.myPubKey, props.agentPubKey));

const {
  data: credits,
  isLoading,
  error: creditsError,
  refetch: refetchCredits,
} = useQuery({
  queryKey: ["credits", "get_credits_for_recipient", keyB64],
  queryFn: (): Promise<CreditWithContext[]> =>
    client.callZome({
      role_name: "eko",
      zome_name: "credits",
      fn_name: "get_credits_for_recipient",
      payload: wrapInput(props.agentPubKey),
    }),
  enabled: cellsReady,
});
watch(creditsError, console.error);

const { data: distinctCount, refetch: refetchDistinct } = useQuery({
  queryKey: ["credits", "count_distinct_crediters", keyB64],
  queryFn: (): Promise<number> =>
    client.callZome({
      role_name: "eko",
      zome_name: "credits",
      fn_name: "count_distinct_crediters",
      payload: wrapInput(props.agentPubKey),
    }),
  enabled: cellsReady,
});

const refresh = () => {
  refetchCredits();
  refetchDistinct();
};

const openCredit = () => {
  if (!myProfile.value) {
    showProfileDialog.value = true;
    return;
  }
  showProfileDialog.value = false;
  showCreditDialog.value = true;
};
</script>
