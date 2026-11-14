<template>
  <BaseDialog
    :model-value="modelValue"
    dialog-panel-class="md:w-1/2 bg-base-100"
    @update:model-value="(val: boolean) => emit('update:model-value', val)"
  >
    <div class="text-left p-4" :data-theme="themeStore.active">
      <h2 class="text-3xl font-title font-bold tracking-tighter mb-2">
        give credit
      </h2>
      <div class="mb-4 text-sm opacity-75 flex space-x-1">
        <span>To</span>
        <BaseAgentProfileName :agent-pub-key="recipient" />
      </div>

      <label class="block text-sm font-bold mb-1" for="credit-contribution">
        What did they contribute?
      </label>
      <textarea
        id="credit-contribution"
        v-model="contribution"
        class="textarea textarea-bordered w-full h-28"
        :maxlength="CREDIT_MAX_CHARS"
        placeholder="Ran the weekly food pantry for a year."
      ></textarea>
      <div class="text-xs font-mono text-right opacity-60">
        {{ contribution.trim().length }} / {{ CREDIT_MAX_CHARS }}
      </div>

      <details class="mt-2">
        <summary class="text-sm cursor-pointer">
          Reference a Credits NFT (optional)
        </summary>
        <div class="flex space-x-2 mt-2">
          <input
            v-model="tokenId"
            class="input input-bordered input-sm flex-1"
            placeholder="Token number, e.g. 77449"
          />
        </div>
        <p class="text-xs opacity-60 mt-1">
          This is a claim you are making. Eko cannot verify it, and others
          will see it as your claim.
        </p>
      </details>

      <p class="text-xs opacity-60 mt-4">
        A credit is signed by you and cannot be edited by them. Only you can
        retract it.
      </p>

      <div class="flex justify-end space-x-2 mt-4">
        <button class="btn btn-ghost" @click="emit('update:model-value', false)">
          Cancel
        </button>
        <button
          class="btn btn-primary"
          :disabled="!canSubmit || saving"
          @click="submit"
        >
          {{ saving ? "Signing..." : "Sign credit" }}
        </button>
      </div>
    </div>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, ComputedRef, inject, ref, watch } from "vue";
import { ActionHash, AgentPubKey, AppClient } from "@holochain/client";
import BaseDialog from "@/components/BaseDialog.vue";
import BaseAgentProfileName from "@/components/BaseAgentProfileName.vue";
import { useThemeStore } from "@/stores/theme";
import { useToasts } from "@/stores/toasts";
import { CREDIT_MAX_CHARS, CREDIT_MIN_CHARS } from "@/types/types";

const props = defineProps<{
  modelValue: boolean;
  recipient: AgentPubKey;
  attachedTo?: ActionHash | null;
}>();
const emit = defineEmits(["update:model-value", "credit-created"]);

const client = (inject("client") as ComputedRef<AppClient>).value;
const themeStore = useThemeStore();
const { showMessage, showError } = useToasts();

const contribution = ref("");
const tokenId = ref("");
const saving = ref(false);

const canSubmit = computed(() => {
  const n = contribution.value.trim().length;
  return n >= CREDIT_MIN_CHARS && n <= CREDIT_MAX_CHARS;
});

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      contribution.value = "";
      tokenId.value = "";
    }
  }
);

const submit = async () => {
  saving.value = true;
  try {
    const token = tokenId.value.trim();
    await client.callZome({
      role_name: "eko",
      zome_name: "credits",
      fn_name: "create_credit",
      payload: {
        recipient: props.recipient,
        contribution: contribution.value.trim(),
        credit_ref: token
          ? { collection: "credits", token_id: token, chain: null }
          : null,
        attached_to: props.attachedTo ?? null,
      },
    });
    showMessage("Credit signed");
    emit("credit-created");
    emit("update:model-value", false);
  } catch (e) {
    showError(e);
  } finally {
    saving.value = false;
  }
};
</script>
