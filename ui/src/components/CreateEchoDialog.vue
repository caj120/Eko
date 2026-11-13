<template>
  <BaseDialog
    :model-value="modelValue"
    :initial-focus-ref="
      typeof echoType === 'object' && EchoTypeName.Reecho in echoType
        ? createEchoInputRef?.$refs.createButtonInput
        : createEchoInputRef?.$refs.echoContainerInput
    "
    @update:model-value="(val: boolean) => emit('update:model-value', val)"
  >
    <profiles-context :store="profilesStore">
      <div
        v-if="
          typeof echoType === 'object' &&
          (EchoTypeName.Reply in echoType || EchoTypeName.Quote in echoType)
        "
        class="font-title text-xl flex justify-start items-center mr-2 mb-4"
      >
        <div v-if="EchoTypeName.Reply in echoType" class="mr-2">reply to</div>
        <div v-else-if="EchoTypeName.Quote in echoType" class="mr-2">quote</div>

        <BaseAgentProfileName
          v-if="originalEcho"
          :agentPubKey="originalEcho.action.author"
        />
      </div>

      <div
        v-if="
          typeof echoType === 'object' &&
          (EchoTypeName.Reply in echoType ||
            EchoTypeName.Quote in echoType ||
            EchoTypeName.Reecho in echoType) &&
          originalEcho
        "
        class="bg-base-200 rounded-3xl mb-4 mx-4"
      >
        <BaseEchoListItem
          :feed-echo="originalEcho"
          :show-buttons="false"
          :disable-truncate-content="true"
        />
      </div>

      <CreateEchoInput
        ref="createEchoInputRef"
        :echo-type="echoType"
        @echo-created="onCreateEcho"
      />
    </profiles-context>
  </BaseDialog>
</template>

<script setup lang="ts">
import { FeedEcho, EchoType, EchoTypeName } from "@/types/types";
import CreateEchoInput from "@/components/CreateEchoInput.vue";
import BaseAgentProfileName from "@/components/BaseAgentProfileName.vue";
import BaseDialog from "@/components/BaseDialog.vue";
import { ProfilesStore } from "@holochain-open-dev/profiles";
import { ComputedRef, inject, ref } from "vue";
import { ROUTES } from "@/router";
import { useRouter } from "vue-router";
import { setHomeRedirect } from "@/utils/homeRedirect";

withDefaults(
  defineProps<{
    modelValue: boolean;
    echoType: EchoType;
    originalEcho?: FeedEcho;
  }>(),
  {
    modelValue: false,
    originalEcho: undefined,
  }
);
const emit = defineEmits(["echo-created", "update:model-value"]);
const profilesStore = (inject("profilesStore") as ComputedRef<ProfilesStore>)
  .value;
const router = useRouter();

const createEchoInputRef = ref();

const onCreateEcho = (val: FeedEcho) => {
  setHomeRedirect(false);

  if (val.echo.echo_type === EchoTypeName.Original) {
    router.push({ name: ROUTES.feed });
  }
  emit("echo-created", val);
  emit("update:model-value", false);
};
</script>

<style scoped></style>
