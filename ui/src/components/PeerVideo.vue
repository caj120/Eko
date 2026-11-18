<template>
  <div class="relative rounded-2xl overflow-hidden bg-neutral aspect-video">
    <video
      ref="el"
      autoplay
      playsinline
      :muted="muted"
      class="w-full h-full object-cover"
    ></video>
    <div
      class="absolute bottom-2 left-2 text-xs px-2 py-1 rounded-full bg-neutral/70 text-neutral-content"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watchEffect } from "vue";

const props = withDefaults(
  defineProps<{ stream: MediaStream | null; muted?: boolean }>(),
  { muted: false }
);

const el = ref<HTMLVideoElement | null>(null);
watchEffect(() => {
  if (el.value) el.value.srcObject = props.stream;
});
</script>
