<template>
  <div class="py-4">
    <div
      v-if="
        notification.notification_type === NotificationTypeName.MyAgentFollowed
      "
      class="flex justify-between items-center py-2"
      style="width: 100%"
    >
      <div class="flex justify-start items-start space-x-2">
        <BaseAgentProfileLinkName
          :agentPubKey="notification.agent"

        />
        <div class="font-mono">Followed you</div>
      </div>
      <div>
        <BaseTimestamp class="font-mono" :timestamp="notification.timestamp" />
      </div>
    </div>
    <div
      v-else-if="
        notification.notification_type ===
        NotificationTypeName.MyAgentUnfollowed
      "
      class="flex justify-between items-center py-2 w-full space-x-2"
    >
      <div class="flex justify-start items-start space-x-2">
        <BaseAgentProfileLinkName
          :agentPubKey="notification.agent"

        />
        <div class="font-mono">Unfollowed you</div>
      </div>
      <div>
        <BaseTimestamp class="font-mono" :timestamp="notification.timestamp" />
      </div>
    </div>
    <div
      v-else-if="
        notification.notification_type === NotificationTypeName.MyAgentMentioned
      "
      class="my-2 w-full"
    >
      <div class="flex justify-between items-start">
        <div class="flex justify-start items-start space-x-2">
          <BaseAgentProfileLinkName
            :agentPubKey="notification.agent"
  
          />
          <div class="font-mono">Mentioned you in an echo</div>
        </div>
        <div>
          <BaseTimestamp
            class="font-mono"
            :timestamp="notification.timestamp"
          />
        </div>
      </div>
      <div class="bg-base-200 rounded-xl mt-4 mx-4">
        <BaseEchoListItem
          :feed-echo="(notification.feed_echo as FeedEcho)"
          v-bind="$attrs"
        />
      </div>
    </div>

    <div
      v-else-if="
        notification.notification_type === NotificationTypeName.MyEchoLikeed
      "
      class="py-2 w-full"
    >
      <div class="flex justify-between items-start">
        <div class="flex justify-start items-start space-x-2">
          <BaseAgentProfileLinkName
            :agentPubKey="notification.agent"
  
          />
          <div class="font-mono">Likeed your echo</div>
        </div>
        <div>
          <BaseTimestamp
            class="font-mono"
            :timestamp="notification.timestamp"
          />
        </div>
      </div>
      <div class="bg-base-200 rounded-xl mt-4 mx-4">
        <BaseEchoListItem
          :feed-echo="(notification.feed_echo as FeedEcho)"
          v-bind="$attrs"
        />
      </div>
    </div>

    <div
      v-else-if="
        notification.notification_type === NotificationTypeName.MyEchoUnlikeed
      "
      style="width: 100%"
      class="w-full py-2"
    >
      <div class="flex justify-between items-start">
        <div class="flex justify-start items-start space-x-2">
          <BaseAgentProfileLinkName
            :agentPubKey="notification.agent"
  
          />
          <div class="font-mono">Unlikeed your echo</div>
        </div>
        <div>
          <BaseTimestamp
            class="font-mono"
            :timestamp="notification.timestamp"
          />
        </div>
      </div>
      <div class="bg-base-200 rounded-xl mt-4 mx-4">
        <BaseEchoListItem
          :feed-echo="(notification.feed_echo as FeedEcho)"
          v-bind="$attrs"
        />
      </div>
    </div>

    <div
      v-else-if="
        notification.notification_type === NotificationTypeName.MyEchoPinned
      "
      class="w-full py-2"
    >
      <div class="flex justify-between items-start">
        <div class="flex justify-start items-start space-x-2">
          <BaseAgentProfileLinkName
            :agentPubKey="notification.agent"
  
          />
          <div class="font-mono">Pinned your echo</div>
        </div>
        <div>
          <BaseTimestamp
            class="font-mono"
            :timestamp="notification.timestamp"
          />
        </div>
      </div>
      <div class="bg-base-200 rounded-xl mt-4 mx-4">
        <BaseEchoListItem
          :feed-echo="(notification.feed_echo as FeedEcho)"
          v-bind="$attrs"
        />
      </div>
    </div>

    <div
      v-else-if="
        notification.notification_type === NotificationTypeName.MyEchoUnpinned
      "
      class="py-2 w-full"
    >
      <div class="flex justify-between items-start">
        <div class="flex justify-start items-start space-x-2">
          <BaseAgentProfileLinkName
            :agentPubKey="notification.agent"
  
          />
          <div class="font-mono">Unpinned your echo</div>
        </div>
        <div>
          <BaseTimestamp
            class="font-mono"
            :timestamp="notification.timestamp"
          />
        </div>
      </div>
      <div class="bg-base-200 rounded-xl mt-4 mx-4">
        <BaseEchoListItem
          :feed-echo="(notification.feed_echo as FeedEcho)"
          v-bind="$attrs"
        />
      </div>
    </div>

    <div
      v-else-if="
        notification.notification_type === NotificationTypeName.MyEchoResponded
      "
      class="w-full py-2"
    >
      <div class="flex justify-between items-start">
        <div class="flex justify-start items-start space-x-2">
          <BaseAgentProfileLinkName
            :agentPubKey="notification.agent"
  
          />
          <div
            v-if="
              notification.feed_echo &&
              typeof notification.feed_echo.echo.echo_type === 'object' &&
              EchoTypeName.Reply in notification.feed_echo.echo.echo_type
            "
            class="font-mono"
          >
            Replied to your echo
          </div>
          <div
            v-else-if="
              notification.feed_echo &&
              typeof notification.feed_echo.echo.echo_type === 'object' &&
              EchoTypeName.Quote in notification.feed_echo.echo.echo_type
            "
            class="font-mono"
          >
            Quoted your echo
          </div>
          <div
            v-else-if="
              notification.feed_echo &&
              typeof notification.feed_echo.echo.echo_type === 'object' &&
              EchoTypeName.Reecho in notification.feed_echo.echo.echo_type
            "
            class="font-mono"
          >
            Reechoed your echo
          </div>
        </div>
        <div>
          <BaseTimestamp
            class="font-mono"
            :timestamp="notification.timestamp"
          />
        </div>
      </div>
      <div class="bg-base-200 rounded-xl mt-4 mx-4">
        <BaseEchoListItem
          :feed-echo="(notification.feed_echo as FeedEcho)"
          v-bind="$attrs"
        />
      </div>
    </div>

    <div
      v-else-if="
        notification.notification_type ===
        NotificationTypeName.FollowedYarnResponded
      "
      class="py-2 w-full"
    >
      <div class="flex justify-between items-start">
        <div class="flex justify-start items-start space-x-2">
          <BaseAgentProfileLinkName
            :agentPubKey="notification.agent"
  
          />
          <div
            v-if="
              notification.feed_echo &&
              typeof notification.feed_echo.echo.echo_type === 'object' &&
              EchoTypeName.Reply in notification.feed_echo.echo.echo_type
            "
            class="font-mono"
          >
            Replied to a yarn you participated in
          </div>
          <div
            v-else-if="
              notification.feed_echo &&
              typeof notification.feed_echo.echo.echo_type === 'object' &&
              EchoTypeName.Quote in notification.feed_echo.echo.echo_type
            "
            class="font-mono"
          >
            Quoted a yarn you participated in
          </div>
          <div
            v-else-if="
              notification.feed_echo &&
              typeof notification.feed_echo.echo.echo_type === 'object' &&
              EchoTypeName.Reecho in notification.feed_echo.echo.echo_type
            "
            class="font-mono"
          >
            Meechoed a yarn you participated in
          </div>
        </div>
        <div>
          <BaseTimestamp
            class="font-mono"
            :timestamp="notification.timestamp"
          />
        </div>
      </div>
      <div class="bg-base-200 rounded-xl mt-4 mx-4">
        <BaseEchoListItem
          :feed-echo="(notification.feed_echo as FeedEcho)"
          v-bind="$attrs"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  NotificationTypeName,
  Notification,
  FeedEcho,
  EchoTypeName,
} from "@/types/types";
import BaseTimestamp from "@/components/BaseTimestamp.vue";
import BaseAgentProfileLinkName from "@/components/BaseAgentProfileLinkName.vue";
import BaseEchoListItem from "@/components/BaseEchoListItem.vue";

defineProps<{
  notification: Notification;
}>();
</script>
