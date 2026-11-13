<template>
  <div>
    <BaseEchoContent :echo="(embedEcho.echo as Echo)" class="cursor-pointer mb-2" />
    <BaseAgentProfile
      :agent-pub-key="embedEcho.action.author"
      class="flex justify-end"
    />
  </div>
</template>

<script setup lang="ts">
import { EmbedEcho } from "@/types/types";
import { Echo } from "@/types/types";
import BaseEchoContent from "@/components/BaseEchoContent.vue";
import BaseAgentProfile from "@/components/BaseAgentProfile.vue";

defineProps<{
  embedEcho: EmbedEcho;
}>();
</script>

<style scoped></style>
