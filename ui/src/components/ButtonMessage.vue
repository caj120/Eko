<template>
  <button
    class="btn btn-sm btn-outline rounded-3xl px-4"
    :class="{ 'md:btn-md': big }"
    :disabled="opening"
    @click.stop.prevent="open"
  >
    Message
  </button>
</template>

<script setup lang="ts">
import { ComputedRef, inject, ref } from "vue";
import { AgentPubKey, AppClient } from "@holochain/client";
import { useRouter } from "vue-router";
import { ROUTES } from "@/router";
import { useToasts } from "@/stores/toasts";
import { ConversationView } from "@/types/messages";

const props = withDefaults(
  defineProps<{ agentPubKey: AgentPubKey; big?: boolean }>(),
  { big: true }
);

const client = (inject("client") as ComputedRef<AppClient>).value;
const router = useRouter();
const { showError } = useToasts();
const opening = ref(false);

const open = async () => {
  opening.value = true;
  try {
    const conversation: ConversationView = await client.callZome({
      role_name: "eko",
      zome_name: "messages",
      fn_name: "open_direct",
      payload: props.agentPubKey,
    });
    router.push({ name: ROUTES.messages, params: { key: conversation.key } });
  } catch (e) {
    showError(e);
  } finally {
    opening.value = false;
  }
};
</script>
