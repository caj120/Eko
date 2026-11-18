<template>
  <!-- Someone is calling -->
  <div
    v-if="store.incoming"
    class="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md rounded-2xl bg-base-100 border border-base-300 shadow-xl p-4"
  >
    <div class="text-xs opacity-60 mb-1">
      Incoming {{ modeLabel(store.incoming.mode) }}
    </div>
    <BaseAgentProfileName :agent-pub-key="store.incoming.from" />
    <div class="flex justify-end space-x-2 mt-3">
      <button class="btn btn-sm btn-ghost" @click="decline">Decline</button>
      <button class="btn btn-sm btn-primary" @click="accept">Join</button>
    </div>
  </div>

  <!-- In a call -->
  <div
    v-if="store.call"
    class="fixed inset-0 z-40 bg-neutral text-neutral-content flex flex-col"
  >
    <div class="p-4 text-sm flex justify-between items-center">
      <div>{{ modeLabel(store.call.mode) }}</div>
      <div class="opacity-70 text-xs">
        {{ peerKeys.length === 0 ? "Waiting for others to join" : `${peerKeys.length} connected` }}
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-4">
      <div
        class="grid gap-3"
        :class="peerKeys.length > 1 ? 'grid-cols-2' : 'grid-cols-1'"
      >
        <PeerVideo
          v-for="b64 in peerKeys"
          :key="b64"
          :stream="store.peers[b64].stream"
        >
          <BaseAgentProfileName
            :agent-pub-key="decodeHashFromBase64(b64)"
          />
        </PeerVideo>
      </div>
    </div>

    <!-- You, in the corner, muted so you never hear yourself -->
    <div
      v-if="store.localStream && store.call.mode !== 'Audio'"
      class="absolute bottom-28 right-4 w-28"
    >
      <PeerVideo :stream="store.localStream" muted>You</PeerVideo>
    </div>

    <div class="p-6 flex justify-center items-center space-x-4">
      <button
        v-if="store.localStream"
        class="btn btn-circle"
        :class="store.muted ? 'btn-error' : 'btn-ghost bg-base-100/10'"
        :title="store.muted ? 'Unmute' : 'Mute'"
        @click="store.toggleMute()"
      >
        <IconMicOff v-if="store.muted" class="w-6 h-6" />
        <IconMic v-else class="w-6 h-6" />
      </button>
      <button
        v-if="store.localStream && store.call.mode !== 'Audio'"
        class="btn btn-circle"
        :class="store.cameraOff ? 'btn-error' : 'btn-ghost bg-base-100/10'"
        :title="store.cameraOff ? 'Camera on' : 'Camera off'"
        @click="store.toggleCamera()"
      >
        <IconVideoOff v-if="store.cameraOff" class="w-6 h-6" />
        <IconVideo v-else class="w-6 h-6" />
      </button>
      <button class="btn btn-circle btn-error" title="Leave" @click="leave">
        <IconHangUp class="w-6 h-6" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { decodeHashFromBase64 } from "@holochain/client";
import { useMessagingStore } from "@/stores/messaging";
import { useToasts } from "@/stores/toasts";
import { CallMode } from "@/types/messages";
import BaseAgentProfileName from "@/components/BaseAgentProfileName.vue";
import PeerVideo from "@/components/PeerVideo.vue";
import IconMic from "~icons/ion/mic-outline";
import IconMicOff from "~icons/ion/mic-off-outline";
import IconVideo from "~icons/ion/videocam-outline";
import IconVideoOff from "~icons/ion/videocam-off-outline";
import IconHangUp from "~icons/ion/close";

const store = useMessagingStore();
const { showError } = useToasts();

const peerKeys = computed(() => Object.keys(store.peers));

const modeLabel = (mode: CallMode) =>
  mode === "Video" ? "video call" : mode === "Audio" ? "audio call" : "broadcast";

const accept = async () => {
  try {
    await store.acceptIncoming();
  } catch (e) {
    showError(e);
  }
};
const decline = async () => {
  try {
    await store.declineIncoming();
  } catch (e) {
    showError(e);
  }
};
const leave = async () => {
  try {
    await store.leave();
  } catch (e) {
    showError(e);
  }
};
</script>
