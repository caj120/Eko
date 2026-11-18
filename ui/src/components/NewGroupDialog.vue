<template>
  <BaseDialog
    :model-value="modelValue"
    dialog-panel-class="md:w-1/2 bg-base-100"
    @update:model-value="(val: boolean) => emit('update:model-value', val)"
  >
    <div class="text-left p-4" :data-theme="themeStore.active">
      <h2 class="text-3xl font-title font-bold tracking-tighter mb-4">
        new group
      </h2>

      <label class="block text-sm font-bold mb-1" for="group-title">Name</label>
      <input
        id="group-title"
        v-model="title"
        class="input input-bordered w-full"
        maxlength="80"
        placeholder="Saturday food pantry"
      />

      <div class="text-sm font-bold mt-4 mb-1">
        People you follow
        <span class="font-normal opacity-60">
          (pick 2 to {{ GROUP_MAX_MEMBERS - 1 }})
        </span>
      </div>
      <div v-if="isLoading" class="text-sm opacity-60">Loading...</div>
      <div v-else-if="!following || following.length === 0" class="text-sm opacity-60">
        Follow some people first, then you can add them here.
      </div>
      <div v-else class="max-h-56 overflow-y-auto space-y-1">
        <label
          v-for="agent in following"
          :key="encodeHashToBase64(agent)"
          class="flex items-center space-x-3 cursor-pointer py-1"
        >
          <input
            v-model="selected"
            type="checkbox"
            class="checkbox checkbox-sm"
            :value="encodeHashToBase64(agent)"
          />
          <BaseAgentProfileName :agent-pub-key="agent" />
        </label>
      </div>

      <label class="block text-sm font-bold mt-4 mb-1" for="group-first">
        First message
      </label>
      <textarea
        id="group-first"
        v-model="firstMessage"
        class="textarea textarea-bordered w-full h-20"
        :maxlength="MESSAGE_MAX_CHARS"
        placeholder="Doors open at 9."
      ></textarea>

      <p class="text-xs opacity-60 mt-3">
        Messages go straight to each person and are kept on your devices, not
        on a shared server. Members cannot be added later; start a new group
        instead.
      </p>

      <div class="flex justify-end space-x-2 mt-4">
        <button class="btn btn-ghost" @click="emit('update:model-value', false)">
          Cancel
        </button>
        <button class="btn btn-primary" :disabled="!canSubmit || saving" @click="submit">
          {{ saving ? "Creating..." : "Create group" }}
        </button>
      </div>
    </div>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, ComputedRef, inject, ref, watch } from "vue";
import {
  AgentPubKey,
  AppClient,
  decodeHashFromBase64,
  encodeHashToBase64,
} from "@holochain/client";
import { useQuery } from "@tanstack/vue-query";
import BaseDialog from "@/components/BaseDialog.vue";
import BaseAgentProfileName from "@/components/BaseAgentProfileName.vue";
import { useThemeStore } from "@/stores/theme";
import { useToasts } from "@/stores/toasts";
import { useCellsReady } from "@/composables/useCellsReady";
import { wrapInput } from "@/utils/zomeCall";
import {
  ConversationView,
  GROUP_MAX_MEMBERS,
  MESSAGE_MAX_CHARS,
} from "@/types/messages";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits(["update:model-value", "created"]);

const client = (inject("client") as ComputedRef<AppClient>).value;
const cellsReady = useCellsReady();
const themeStore = useThemeStore();
const { showError } = useToasts();

const title = ref("");
const firstMessage = ref("");
const selected = ref<string[]>([]);
const saving = ref(false);

const { data: following, isLoading } = useQuery({
  queryKey: ["messages", "following", encodeHashToBase64(client.myPubKey)],
  queryFn: (): Promise<AgentPubKey[]> =>
    client.callZome({
      role_name: "eko",
      zome_name: "echoes",
      fn_name: "get_creators_for_follower",
      payload: wrapInput({ follower: client.myPubKey }),
    }),
  enabled: cellsReady,
});

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      title.value = "";
      firstMessage.value = "";
      selected.value = [];
    }
  }
);

const canSubmit = computed(
  () =>
    title.value.trim().length > 0 &&
    firstMessage.value.trim().length > 0 &&
    selected.value.length >= 2 &&
    selected.value.length <= GROUP_MAX_MEMBERS - 1
);

const submit = async () => {
  saving.value = true;
  try {
    const conversation: ConversationView = await client.callZome({
      role_name: "eko",
      zome_name: "messages",
      fn_name: "create_group",
      payload: {
        title: title.value.trim(),
        members: selected.value.map((b64) => decodeHashFromBase64(b64)),
        first_message: firstMessage.value.trim(),
      },
    });
    emit("created", conversation);
    emit("update:model-value", false);
  } catch (e) {
    showError(e);
  } finally {
    saving.value = false;
  }
};
</script>
