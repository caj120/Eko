<template>
  <div class="w-full">
    <!-- Conversation list -->
    <template v-if="!activeKey">
      <div class="mb-6 flex justify-between items-center">
        <BasePageHeader class="!mb-0">messages</BasePageHeader>
        <button
          class="btn btn-sm btn-primary rounded-3xl px-4"
          @click="showNewGroup = true"
        >
          New group
        </button>
      </div>

      <div v-if="loadingConversations" class="animate-pulse bg-base-200/75 rounded-2xl h-20"></div>
      <div
        v-else-if="!conversations || conversations.length === 0"
        class="text-sm opacity-70 px-4"
      >
        No conversations yet. Open someone's profile and tap Message, or start
        a group.
      </div>
      <div v-else class="space-y-2">
        <button
          v-for="c in conversations"
          :key="c.key"
          class="w-full text-left rounded-2xl bg-base-200/60 hover:bg-base-200 px-4 py-3"
          @click="openConversation(c.key)"
        >
          <div class="flex justify-between items-baseline">
            <div class="font-bold">
              <template v-if="c.kind === 'Group'">{{ c.title }}</template>
              <BaseAgentProfileName v-else :agent-pub-key="otherMember(c)" />
            </div>
            <div class="text-xs opacity-60 font-mono">
              {{ formatTime(c.last_message?.sent_at ?? c.created_at) }}
            </div>
          </div>
          <div class="text-sm opacity-70 truncate">
            <span v-if="!c.accepted" class="badge badge-warning badge-sm mr-2">request</span>
            {{ c.last_message?.body ?? "No messages yet" }}
          </div>
        </button>
      </div>
    </template>

    <!-- One conversation -->
    <template v-else>
      <div class="mb-4 flex items-center justify-between space-x-2">
        <div class="flex items-center space-x-2 min-w-0">
          <button class="btn btn-sm btn-circle btn-ghost" title="Back" @click="goBack">
            <IconBack class="w-5 h-5" />
          </button>
          <div class="font-title text-2xl tracking-tight truncate">
            <template v-if="!active">...</template>
            <template v-else-if="active.kind === 'Group'">{{ active.title }}</template>
            <BaseAgentProfileName v-else :agent-pub-key="otherMember(active)" />
          </div>
        </div>
        <div v-if="active && active.accepted" class="flex items-center space-x-1">
          <button class="btn btn-sm btn-circle btn-ghost" title="Video call" @click="call('Video')">
            <IconVideo class="w-5 h-5" />
          </button>
          <button class="btn btn-sm btn-circle btn-ghost" title="Audio call" @click="call('Audio')">
            <IconCall class="w-5 h-5" />
          </button>
          <button
            v-if="active.kind === 'Group'"
            class="btn btn-sm btn-circle btn-ghost"
            title="Broadcast: you send, they watch"
            @click="call('Broadcast')"
          >
            <IconBroadcast class="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        v-if="active && !active.accepted"
        class="rounded-2xl bg-warning/20 p-4 mb-4 text-sm flex items-center justify-between"
      >
        <span>This conversation was started by someone else.</span>
        <button class="btn btn-sm btn-primary" @click="accept">Accept</button>
      </div>

      <div class="space-y-2 max-h-[55vh] overflow-y-auto px-1">
        <div v-if="loadingThread" class="animate-pulse bg-base-200/75 rounded-2xl h-16"></div>
        <div v-else-if="!thread || thread.length === 0" class="text-sm opacity-60">
          No messages yet.
        </div>
        <div
          v-for="m in thread ?? []"
          :key="encodeHashToBase64(m.id.hash)"
          class="flex"
          :class="isMine(m) ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[80%] rounded-2xl px-4 py-2"
            :class="isMine(m) ? 'bg-primary text-primary-content' : 'bg-base-200'"
          >
            <div
              v-if="!isMine(m) && active?.kind === 'Group'"
              class="text-xs font-bold opacity-70"
            >
              <BaseAgentProfileName :agent-pub-key="m.from" />
            </div>
            <div class="whitespace-pre-wrap break-words font-serif">{{ m.body }}</div>
            <div class="text-[10px] opacity-60 text-right font-mono">
              {{ formatTime(m.sent_at) }}
              <span v-if="m.pending.length > 0">
                · waiting for {{ m.pending.length }} to come online
              </span>
            </div>
          </div>
        </div>
        <div ref="bottom"></div>
      </div>

      <div v-if="active && active.accepted" class="mt-4 flex items-end space-x-2">
        <textarea
          v-model="draft"
          class="textarea textarea-bordered flex-1 h-14"
          :maxlength="MESSAGE_MAX_CHARS"
          placeholder="Write a message"
          @keydown.enter.exact.prevent="send"
        ></textarea>
        <button class="btn btn-primary btn-circle" :disabled="sending || !draft.trim()" title="Send" @click="send">
          <IconSend class="w-5 h-5" />
        </button>
      </div>
    </template>
  </div>

  <NewGroupDialog v-model="showNewGroup" @created="onGroupCreated" />
</template>

<script setup lang="ts">
import { computed, ComputedRef, inject, nextTick, ref, watch } from "vue";
import { AgentPubKey, AppClient, encodeHashToBase64 } from "@holochain/client";
import { useQuery } from "@tanstack/vue-query";
import { useRoute, useRouter } from "vue-router";
import isEqual from "lodash/isEqual";
import dayjs from "dayjs";
import { ROUTES } from "@/router";
import { useCellsReady } from "@/composables/useCellsReady";
import { useToasts } from "@/stores/toasts";
import { useMessagingStore } from "@/stores/messaging";
import BasePageHeader from "@/components/BasePageHeader.vue";
import BaseAgentProfileName from "@/components/BaseAgentProfileName.vue";
import NewGroupDialog from "@/components/NewGroupDialog.vue";
import {
  CallMode,
  ConversationView,
  MESSAGE_MAX_CHARS,
  MessageView,
} from "@/types/messages";
import IconBack from "~icons/ion/arrow-back";
import IconVideo from "~icons/ion/videocam-outline";
import IconCall from "~icons/ion/call-outline";
import IconBroadcast from "~icons/ion/radio-outline";
import IconSend from "~icons/ion/send";

const client = (inject("client") as ComputedRef<AppClient>).value;
const cellsReady = useCellsReady();
const route = useRoute();
const router = useRouter();
const { showError } = useToasts();
const messaging = useMessagingStore();

const activeKey = computed(() => {
  const key = route.params.key;
  return typeof key === "string" && key.length > 0 ? key : undefined;
});

const showNewGroup = ref(false);
const draft = ref("");
const sending = ref(false);
const bottom = ref<HTMLElement | null>(null);

const zome = (fn_name: string, payload: unknown = null) =>
  client.callZome({ role_name: "eko", zome_name: "messages", fn_name, payload });

const {
  data: conversations,
  isLoading: loadingConversations,
  refetch: refetchConversations,
} = useQuery({
  queryKey: ["messages", "conversations"],
  queryFn: (): Promise<ConversationView[]> => zome("get_my_conversations"),
  enabled: cellsReady,
  refetchInterval: 20000,
});

watch(conversations, (list) => {
  list?.forEach((c) => messaging.rememberMembers(c.key, c.members));
});

const {
  data: thread,
  isLoading: loadingThread,
  refetch: refetchThread,
} = useQuery({
  queryKey: ["messages", "thread", activeKey],
  queryFn: (): Promise<MessageView[]> => zome("get_messages", activeKey.value),
  enabled: computed(() => cellsReady.value && activeKey.value !== undefined),
  refetchInterval: 20000,
});

const active = computed(() =>
  conversations.value?.find((c) => c.key === activeKey.value)
);

watch(thread, async () => {
  await nextTick();
  bottom.value?.scrollIntoView({ block: "end" });
});

const otherMember = (c: ConversationView): AgentPubKey =>
  c.members.find((m) => !isEqual(m, client.myPubKey)) ?? c.members[0];

const isMine = (m: MessageView) => isEqual(m.from, client.myPubKey);

const formatTime = (micros: number) => {
  const t = dayjs(Math.floor(micros / 1000));
  return t.isSame(dayjs(), "day") ? t.format("HH:mm") : t.format("MMM D");
};

const openConversation = (key: string) =>
  router.push({ name: ROUTES.messages, params: { key } });
const goBack = () => router.push({ name: ROUTES.messages, params: {} });

const onGroupCreated = (c: ConversationView) => {
  refetchConversations();
  openConversation(c.key);
};

const accept = async () => {
  try {
    await zome("accept_conversation", activeKey.value);
    await refetchConversations();
  } catch (e) {
    showError(e);
  }
};

const send = async () => {
  const body = draft.value.trim();
  if (!body || !activeKey.value || sending.value) return;
  sending.value = true;
  try {
    await zome("send_message", {
      conversation_key: activeKey.value,
      body,
      reply_to: null,
    });
    draft.value = "";
    await Promise.all([refetchThread(), refetchConversations()]);
  } catch (e) {
    showError(e);
  } finally {
    sending.value = false;
  }
};

const call = async (mode: CallMode) => {
  const c = active.value;
  if (!c) return;
  try {
    await messaging.startCall(c.key, c.members, mode);
  } catch (e) {
    showError(e);
  }
};
</script>
