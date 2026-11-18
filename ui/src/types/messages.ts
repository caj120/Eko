import { ActionHash, AgentPubKey } from "@holochain/client";

// Mirrors crates/message_types. Timestamps are microseconds.

export type ConversationKind = "Direct" | "Group";
export type CallMode = "Video" | "Audio" | "Broadcast";
export type CallSignalKind =
  | "Invite"
  | "Join"
  | "Decline"
  | "Offer"
  | "Answer"
  | "Ice"
  | "Leave";

export type MessageId = {
  author: AgentPubKey;
  hash: ActionHash;
};

export type MessageView = {
  id: MessageId;
  conversation_key: string;
  from: AgentPubKey;
  body: string;
  reply_to: MessageId | null;
  sent_at: number;
  pending: AgentPubKey[];
};

export type ConversationView = {
  key: string;
  kind: ConversationKind;
  title: string | null;
  members: AgentPubKey[];
  created_at: number;
  accepted: boolean;
  last_message: MessageView | null;
};

export type MessagesSignal =
  | { type: "NewMessage"; conversation_key: string; from: AgentPubKey }
  | {
      type: "Call";
      from: AgentPubKey;
      conversation_key: string;
      call_id: string;
      kind: CallSignalKind;
      mode: CallMode;
      payload: string | null;
    };

// Mirrors MAX_BODY_CHARS and MAX_MEMBERS in the zome.
export const MESSAGE_MAX_CHARS = 4000;
export const GROUP_MAX_MEMBERS = 12;
