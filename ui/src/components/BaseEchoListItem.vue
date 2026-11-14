<template>
  <div
    class="flex flex-col justify-start items-start cursor-pointer"
    @click.passive="navigateToYarn(feedEcho.action_hash)"
  >
    <div
      v-if="isResponseType && showYarnLink"
      class="flex justify-between items-center w-full pt-4 px-4"
    >
      <Component
        :is="enableYarnLink && feedEcho.original_echo ? 'RouterLink' : 'span'"
        :class="{
          'flex justify-start items-center space-x-1 bg-base-200 font-bold px-2 py-1 text-xs rounded-lg uppercase cursor-default':
            !enableYarnLink || !feedEcho.original_echo,
          'btn btn-xs': enableYarnLink && feedEcho.original_echo,
        }"
        :to="feedEcho.original_echo ? {
          name: ROUTES.yarn,
          params: {
            actionHash: encodeHashToBase64(feedEcho.original_echo.action_hash),
          },
        } : undefined"
        @click.stop.prevent
      >
        <div
          :class="{
            'text-primary': enableYarnLink && feedEcho.original_echo,
          }"
        >
          {{ responseLabel }}
        </div>
        <template v-if="feedEcho.original_echo">
          <BaseAgentProfileName
            :agentPubKey="feedEcho.original_echo.action.author"
          />

          <div
            v-if="feedEcho.original_echo.deleted_timestamp !== null"
            class="text-bold text-primary"
          >
            (Deleted)
          </div>
        </template>
        <span v-else class="italic opacity-50">unavailable</span>
      </Component>

      <div class="font-mono text-xs">
        <BaseTimestamp :timestamp="feedEcho.action.timestamp" />
      </div>
    </div>

    <div class="w-full flex justify-start items-start space-x-4 p-4">
      <BaseAgentProfileLinkAvatar :agentPubKey="feedEcho.action.author" />

      <div class="min-w-0 flex-1 w-full break-words">
        <div class="w-full flex justify-between items-center">
          <RouterLink
            :to="{
              name: ROUTES.profile,
              params: {
                agentPubKey: encodeHashToBase64(feedEcho.action.author),
              },
            }"
            @click.stop.prevent
          >
            <BaseAgentProfileName
              :agentPubKey="feedEcho.action.author"
            />
          </RouterLink>

          <div v-if="!feedEcho.original_echo" class="font-mono text-xs">
            <BaseTimestamp :timestamp="feedEcho.action.timestamp" />
          </div>
        </div>

        <div class="my-2 w-full">
          <BaseEchoContent
            v-if="
              (!isDeleted || showIfDeleted) && isReecho && feedEcho.original_echo
            "
            :echo="(feedEcho.original_echo.echo as Echo)"
            :disable-truncate="disableTruncateContent"
          />

          <div
            v-else-if="
              (!isDeleted || showIfDeleted) && isQuote && feedEcho.original_echo
            "
            class="w-full"
          >
            <BaseEchoContent
              :echo="(feedEcho.echo as Echo)"
              :disable-truncate="disableTruncateContent"
            />

            <div class="flex justify-start my-4">
              <div class="flex items-start">
                <IconFormatQuoteOpen class="text-base-300 text-2xl" />
              </div>
              <div class="min-w-0 flex-1 bg-base-200 p-2 rounded-md">
                <BaseEmbedEcho :embed-echo="feedEcho.original_echo" />
              </div>
              <div class="flex justify-end items-end">
                <IconFormatQuoteClose class="text-base-300 text-2xl" />
              </div>
            </div>
          </div>

          <div
            v-else-if="
              (!isDeleted || showIfDeleted) &&
              isResponseType &&
              !feedEcho.original_echo
            "
            class="w-full"
          >
            <BaseEchoContent
              v-if="!isReecho"
              :echo="(feedEcho.echo as Echo)"
              :disable-truncate="disableTruncateContent"
            />
            <div
              class="bg-base-200 rounded-md p-3 my-2 text-base-content/50 italic text-sm"
            >
              Referenced echo is currently unavailable
            </div>
          </div>

          <div v-else-if="isDeleted" class="w-full">
            <a
              v-if="!showIfDeleted"
              class="btn btn-sm w-full"
              @click.stop.prevent="showIfDeleted = true"
            >
              Show Content
            </a>
            <BaseEchoContent
              v-if="showIfDeleted"
              :echo="(feedEcho.echo as Echo)"
              :disable-truncate="disableTruncateContent"
            />
          </div>

          <BaseEchoContent
            v-else
            :echo="(feedEcho.echo as Echo)"
            :disable-truncate="disableTruncateContent"
          />
        </div>

        <div class="flex justify-between">
          <div
            v-if="(!isDeleted || showIfDeleted) && showButtons"
            class="flex justify-between items-center"
            style="width: 100%"
          >
            <div class="flex justify-start items-center space-x-2">
              <button
                v-tooltip.bottom="{
                  disabled: isDeleted,
                  content: 'Reply to echo',
                  popperClass: 'text-xs',
                  triggers: ['hover'],
                }"
                :disable="isDeleted"
                class="flex justify-start items-center space-x-1 p-2"
                :class="{
                  'text-green-400 hover:text-green-600': feedEcho.is_replied,
                  'text-base-300 hover:text-neutral': !feedEcho.is_replied,
                }"
                @click.stop.prevent="
                  openCreateEchoDialog(
                    { [EchoTypeName.Reply]: feedEcho.action_hash },
                    toRaw(feedEcho),
                    () => {
                      onCreateReply(toRaw(feedEcho));
                    }
                  )
                "
              >
                <IconArrowUndoSharp class="w-4 h-4" />
                <span v-if="feedEcho.replies_count > 0">
                  {{ feedEcho.replies_count }}
                </span>
              </button>

              <button
                v-tooltip.bottom="{
                  disabled: isDeleted,
                  content: 'Quote echo',
                  popperClass: 'text-xs',
                  triggers: ['hover'],
                }"
                :disable="isDeleted"
                class="flex justify-start items-center space-x-1 p-2"
                :class="{
                  'text-green-400 hover:text-green-600': feedEcho.is_quoted,
                  'text-base-300 hover:text-neutral': !feedEcho.is_quoted,
                }"
                @click.stop.prevent="
                  openCreateEchoDialog(
                    { [EchoTypeName.Quote]: feedEcho.action_hash },
                    toRaw(feedEcho),
                    () => {
                      onCreateQuote(toRaw(feedEcho));
                    }
                  )
                "
              >
                <IconFormatQuote class="w-4 h-4" />
                <span v-if="feedEcho.quotes_count > 0">
                  {{ feedEcho.quotes_count }}
                </span>
              </button>

              <button
                v-tooltip.bottom="{
                  disabled: isDeleted,
                  content: 'Reecho echo',
                  popperClass: 'text-xs',
                  triggers: ['hover'],
                }"
                :disabled="isDeleted || feedEcho.is_reechoed"
                class="flex justify-start items-center space-x-1 p-2"
                :class="{
                  'text-green-400 cursor-default': feedEcho.is_reechoed,
                  'text-base-300 hover:text-neutral': !feedEcho.is_reechoed,
                }"
                @click.stop.prevent="
                  openCreateEchoDialog(
                    { [EchoTypeName.Reecho]: feedEcho.action_hash },
                    toRaw(feedEcho),
                    () => {
                      onCreateReecho(toRaw(feedEcho));
                    }
                  )
                "
              >
                <IconRepeatBold class="w-4 h-4" />
                <div v-if="feedEcho.reechos_count > 0" class="text-xs">
                  {{ feedEcho.reechos_count }}
                </div>
              </button>

              <button
                v-tooltip.bottom="{
                  disabled: isDeleted,
                  content: `${feedEcho.is_likeed ? 'Unlike' : 'Like'} echo`,
                  popperClass: 'text-xs',
                  triggers: ['hover'],
                }"
                class="flex justify-start items-center space-x-1 p-2"
                :class="{
                  'text-red-500 hover:text-red-600': feedEcho.is_likeed && !isUpdatingLike,
                  'text-base-300 hover:text-red-500': !feedEcho.is_likeed && !isUpdatingLike,
                  'text-yellow-400 animate-pulse cursor-wait': isUpdatingLike,
                }"
                :disabled="isUpdatingLike || isDeleted"
                @click.stop.prevent="toggleLikeEcho"
              >
                <BaseIconTongue class="w-4 h-4" />
                <div v-if="feedEcho.likes_count > 0" class="text-xs">
                  {{ feedEcho.likes_count }}
                </div>
              </button>

              <button
                v-if="!isAuthoredByMe && !isDeleted"
                v-tooltip.bottom="{
                  content: 'Give credit to the author',
                  popperClass: 'text-xs',
                  triggers: ['hover'],
                }"
                class="flex justify-start items-center space-x-1 p-2 text-base-300 hover:text-primary"
                @click.stop.prevent="openCredit"
              >
                <IconHandHeart class="w-4 h-4" />
              </button>
            </div>
            <div class="flex justify-start items-center space-x-2">
              <button
                v-tooltip.bottom="{
                  disabled: isDeleted,
                  content: `${feedEcho.is_pinned ? 'Unpin' : 'Pin'} echo`,
                  popperClass: 'text-xs',
                  triggers: ['hover'],
                }"
                :disabled="(isDeleted && !feedEcho.is_pinned) || isUpdatingPin"
                class="flex justify-start items-center space-x-1 p-2"
                :class="{
                  'text-green-400 hover:text-green-600': feedEcho.is_pinned && !isUpdatingPin,
                  'text-base-300 hover:text-neutral': !feedEcho.is_pinned && !isUpdatingPin,
                  'text-yellow-400 animate-pulse cursor-wait': isUpdatingPin,
                }"
                @click.stop.prevent="togglePinEcho"
              >
                <IconSharpPinOff
                  v-if="feedEcho.is_pinned"
                  class="w-4 h-4"
                />
                <IconSharpPushPin v-else class="w-4 h-4" />
              </button>

              <button
                v-if="isAuthoredByMe"
                v-tooltip.bottom="{
                  disabled: isDeleted,
                  content: 'Delete echo',
                  popperClass: 'text-xs',
                  triggers: ['hover'],
                }"
                :disable="isDeleted"
                class="flex justify-start items-center space-x-1 text-base-300 hover:text-neutral p-2"
                @click.stop.prevent="
                  openConfirmDialog(
                    `<div class='prose'>
                      <b>Are you sure you want to delete this echo?</b>
                      <p>
                        Note that other peers may still have copies of the data,
                        and you can't force them to delete it.
                      </p>
                    </div>`,
                    'Delete Echo',
                    'Delete',
                    deleteEcho
                  )
                "
              >
                <IconTrashSharp class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div
          v-if="feedEcho.deleted_timestamp !== null"
          class="text-error font-mono flex items-center justify-end w-full space-x-2"
        >
          <div>Deleted</div>
          <BaseTimestamp :timestamp="feedEcho.deleted_timestamp" />
        </div>
      </div>
    </div>
    <CreditDialog
      v-model="showCreditDialog"
      :recipient="feedEcho.action.author"
      :attached-to="feedEcho.action_hash"
      @click.stop
    />
  </div>
</template>

<script setup lang="ts">
import { ROUTES } from "@/router";
import { Echo, FeedEcho, EchoTypeName } from "@/types/types";
import { Profile } from "@holochain-open-dev/profiles";
import { ActionHash, encodeHashToBase64 } from "@holochain/client";
import { computed, ComputedRef, inject, ref, toRaw } from "vue";
import BaseAgentProfileLinkAvatar from "@/components/BaseAgentProfileLinkAvatar.vue";
import BaseEchoContent from "@/components/BaseEchoContent.vue";
import isEqual from "lodash/isEqual";
import { useRouter } from "vue-router";
import { AppClient } from "@holochain/client";
import BaseTimestamp from "@/components/BaseTimestamp.vue";
import dayjs from "dayjs";
import BaseEmbedEcho from "@/components/BaseEmbedEcho.vue";
import IconFormatQuoteOpen from "~icons/mdi/format-quote-open";
import IconFormatQuoteClose from "~icons/mdi/format-quote-close";
import IconArrowUndoSharp from "~icons/ion/arrow-undo-sharp";
import IconRepeatBold from "~icons/ph/repeat-bold";
import IconFormatQuote from "~icons/material-symbols/format-quote";
import IconTrashSharp from "~icons/ion/trash-sharp";
import IconSharpPinOff from "~icons/ic/sharp-pin-off";
import IconSharpPushPin from "~icons/ic/sharp-push-pin";
import BaseIconTongue from "@/components/BaseIconTongue.vue";
import IconHandHeart from "~icons/mdi/hand-heart-outline";
import CreditDialog from "@/components/CreditDialog.vue";
import BaseAgentProfileName from "@/components/BaseAgentProfileName.vue";
import { useToasts } from "@/stores/toasts";
import { useCreateEchoDialogStore } from "@/stores/createEchoDialog";
import { useCreateProfileDialogStore } from "@/stores/createProfileDialog";
import { useConfirmDialogStore } from "@/stores/confirmDialog";

const props = withDefaults(
  defineProps<{
    feedEcho: FeedEcho;
    showYarnLink?: boolean;
    enableYarnLink?: boolean;
    showIfDeletedDefault?: boolean;
    showButtons?: boolean;
    disableTruncateContent?: boolean;
  }>(),
  {
    showYarnLink: true,
    enableYarnLink: true,
    showIfDeletedDefault: false,
    showButtons: true,
    disableTruncateContent: false,
  }
);
const emit = defineEmits([
  "reecho-created",
  "quote-created",
  "reply-created",
  "echo-likeed",
  "echo-unlikeed",
  "echo-deleted",
  "echo-pinned",
  "echo-unpinned",
]);
const router = useRouter();
const client = (inject("client") as ComputedRef<AppClient>).value;
const myProfile = inject("myProfile") as ComputedRef<Profile>;
const { showMessage, showError } = useToasts();
const { openCreateEchoDialog, closeCreateEchoDialog } = useCreateEchoDialogStore();
const { openCreateProfileDialog } = useCreateProfileDialogStore();
const { openConfirmDialog } = useConfirmDialogStore();

const showIfDeleted = ref(props.showIfDeletedDefault);
const isUpdatingPin = ref(false);
const isUpdatingLike = ref(false);
const showCreditDialog = ref(false);

const openCredit = () => {
  if (!myProfile.value) {
    openCreateProfileDialog(openCredit);
    return;
  }
  showCreditDialog.value = true;
};

const isReecho = computed(
  () =>
    typeof props.feedEcho.echo.echo_type === "object" &&
    EchoTypeName.Reecho in props.feedEcho.echo.echo_type
);
const isQuote = computed(
  () =>
    typeof props.feedEcho.echo.echo_type === "object" &&
    EchoTypeName.Quote in props.feedEcho.echo.echo_type
);
const isReply = computed(
  () =>
    typeof props.feedEcho.echo.echo_type === "object" &&
    EchoTypeName.Reply in props.feedEcho.echo.echo_type
);
const isResponseType = computed(
  () => isReecho.value || isQuote.value || isReply.value
);
const responseLabel = computed(() =>
  isReecho.value ? "reechoed from" : isReply.value ? "replied to" : "quoted"
);
const isAuthoredByMe = computed(() =>
  isEqual(client.myPubKey, props.feedEcho.action.author)
);
const isDeleted = computed(() => props.feedEcho.deleted_timestamp !== null);

const navigateToYarn = (actionHash: ActionHash) => {
  router.push({
    name: ROUTES.yarn,
    params: { actionHash: encodeHashToBase64(actionHash) },
  });
};

const toggleLikeEcho = async () => {
  if (!myProfile.value) {
    openCreateProfileDialog(toggleLikeEcho);
    return;
  }

  isUpdatingLike.value = true;

  if (props.feedEcho.is_likeed) {
    try {
      await client.callZome({
        role_name: "eko",
        zome_name: "echoes",
        fn_name: "unlike",
        payload: props.feedEcho.action_hash,
      });
      showMessage("Unlikeed Echo");
      emit("echo-unlikeed", {
        ...props.feedEcho,
        is_likeed: false,
        likes_count: props.feedEcho.likes_count - 1,
      });
    } catch (e) {
      showError(e);
    }
  } else {
    try {
      await client.callZome({
        role_name: "eko",
        zome_name: "echoes",
        fn_name: "like",
        payload: props.feedEcho.action_hash,
      });
      showMessage("Likeed Echo");
      emit("echo-likeed", {
        ...props.feedEcho,
        is_likeed: true,
        likes_count: props.feedEcho.likes_count + 1,
      });
    } catch (e) {
      showError(e);
    }
  }

  isUpdatingLike.value = false;
};

const togglePinEcho = async () => {
  if (!myProfile.value) {
    openCreateProfileDialog(togglePinEcho);
    return;
  }

  isUpdatingPin.value = true;

  if (props.feedEcho.is_pinned) {
    try {
      await client.callZome({
        role_name: "eko",
        zome_name: "echoes",
        fn_name: "unpin_hash",
        payload: props.feedEcho.action_hash,
      });
      showMessage("Unpinned Echo");
      emit("echo-unpinned", {
        ...props.feedEcho,
        is_pinned: false,
      });
    } catch (e) {
      showError(e);
    }
  } else {
    try {
      await client.callZome({
        role_name: "eko",
        zome_name: "echoes",
        fn_name: "pin_hash",
        payload: props.feedEcho.action_hash,
      });
      showMessage("Pinned Echo");
      emit("echo-pinned", {
        ...props.feedEcho,
        is_pinned: true,
      });
    } catch (e) {
      showError(e);
    }
  }

  isUpdatingPin.value = false;
};

const onCreateReecho = async (feedEcho: FeedEcho) => {
  closeCreateEchoDialog();
  emit("reecho-created", {
    ...feedEcho,
    is_reechoed: true,
    reechos_count: feedEcho.reechos_count + 1,
  });
  showMessage("Reechoed");
};

const onCreateQuote = async (feedEcho: FeedEcho) => {
  closeCreateEchoDialog();
  emit("quote-created", {
    ...feedEcho,
    is_quoted: true,
    quotes_count: feedEcho.quotes_count + 1,
  });
  showMessage("Quoted echo");
};

const onCreateReply = async (feedEcho: FeedEcho) => {
  closeCreateEchoDialog();
  emit("reply-created", {
    ...feedEcho,
    is_replied: true,
    replies_count: feedEcho.replies_count + 1,
  });
  showMessage("Replied to echo");
};

const deleteEcho = async () => {
  try {
    await client.callZome({
      role_name: "eko",
      zome_name: "echoes",
      fn_name: "delete_echo",
      payload: props.feedEcho.action_hash,
    });
    emit("echo-deleted", {
      ...props.feedEcho,
      deleted_timestamp: dayjs().valueOf() * 1000,
    });
    showMessage("Deleted echo");
  } catch (e) {
    showError(e);
  }
};
</script>
