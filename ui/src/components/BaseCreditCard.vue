<template>
  <div class="bg-base-200/60 border-l-4 border-primary rounded-r-2xl p-4">
    <div class="flex justify-between items-start">
      <div class="flex items-center space-x-2 min-w-0">
        <BaseAgentProfileLinkAvatar :agent-pub-key="credit.author" />
        <RouterLink
          :to="{
            name: ROUTES.profile,
            params: { agentPubKey: encodeHashToBase64(credit.author) },
          }"
        >
          <BaseAgentProfileName :agent-pub-key="credit.author" />
        </RouterLink>
      </div>
      <div class="text-xs">
        <BaseTimestamp :timestamp="credit.timestamp" />
      </div>
    </div>

    <p class="mt-3 break-words font-serif text-base leading-relaxed">
      “{{ credit.credit.contribution }}”
    </p>

    <div class="mt-3 flex justify-between items-center text-xs">
      <div class="flex items-center space-x-2">
        <RouterLink
          v-if="credit.credit.attached_to"
          class="link"
          :to="{
            name: ROUTES.yarn,
            params: {
              actionHash: encodeHashToBase64(credit.credit.attached_to),
            },
          }"
        >
          on an echo
        </RouterLink>
      </div>
      <button
        v-if="isMine"
        class="btn btn-ghost btn-xs"
        :disabled="retracting"
        @click="retract"
      >
        Retract
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ComputedRef, inject, ref } from "vue";
import { AppClient, encodeHashToBase64 } from "@holochain/client";
import isEqual from "lodash/isEqual";
import { ROUTES } from "@/router";
import { CreditWithContext } from "@/types/types";
import BaseAgentProfileLinkAvatar from "@/components/BaseAgentProfileLinkAvatar.vue";
import BaseAgentProfileName from "@/components/BaseAgentProfileName.vue";
import BaseTimestamp from "@/components/BaseTimestamp.vue";
import { useToasts } from "@/stores/toasts";

const props = defineProps<{ credit: CreditWithContext }>();
const emit = defineEmits(["retracted"]);

const client = (inject("client") as ComputedRef<AppClient>).value;
const { showMessage, showError } = useToasts();
const retracting = ref(false);

const isMine = computed(() => isEqual(client.myPubKey, props.credit.author));

const retract = async () => {
  retracting.value = true;
  try {
    await client.callZome({
      role_name: "eko",
      zome_name: "credits",
      fn_name: "delete_credit",
      payload: props.credit.action_hash,
    });
    showMessage("Credit retracted");
    emit("retracted");
  } catch (e) {
    showError(e);
  } finally {
    retracting.value = false;
  }
};
</script>
