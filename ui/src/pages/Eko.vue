<template>
  <div class="w-full">
    <BasePageHeader />

    <EkoBatch v-if="feedStrategy.strategy === 'batch'" />
    <EkoProgressive v-else />
  </div>
</template>

<script setup lang="ts">
import { useFeedStrategyStore } from "@/stores/feedStrategy";
import EkoBatch from "@/components/EkoBatch.vue";
import EkoProgressive from "@/components/EkoProgressive.vue";
const feedStrategy = useFeedStrategyStore();
</script>
