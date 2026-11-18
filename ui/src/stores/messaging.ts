import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";
import {
  AgentPubKey,
  AppClient,
  encodeHashToBase64,
} from "@holochain/client";
import { decode } from "@msgpack/msgpack";
import type { QueryClient } from "@tanstack/vue-query";
import {
  CallMode,
  CallSignalKind,
  ConversationView,
  MessagesSignal,
} from "@/types/messages";
import { useToasts } from "@/stores/toasts";

// The video itself never touches Holochain. Peers connect to each other with
// WebRTC and the app only carries the handshake (offer, answer, candidates)
// as ephemeral remote signals. Nothing about a call is written to any chain.
//
// STUN lets two phones behind home routers find each other, and it does tell
// the STUN operator your IP. Set VITE_ICE_SERVERS to a JSON array to use your
// own STUN or TURN servers instead.
const defaultIceServers: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

const iceServers = (): RTCIceServer[] => {
  const raw = import.meta.env.VITE_ICE_SERVERS as string | undefined;
  if (!raw) return defaultIceServers;
  try {
    return JSON.parse(raw) as RTCIceServer[];
  } catch (e) {
    console.error("VITE_ICE_SERVERS is not valid JSON, using the default", e);
    return defaultIceServers;
  }
};

export type IncomingCall = {
  from: AgentPubKey;
  conversationKey: string;
  callId: string;
  mode: CallMode;
  members: AgentPubKey[];
};

export type ActiveCall = {
  callId: string;
  conversationKey: string;
  mode: CallMode;
  hostB64: string;
  members: AgentPubKey[];
};

export type PeerState = {
  stream: MediaStream | null;
  connection: string;
};

const RETRY_EVERY_MS = 30000;
const RING_FOR_MS = 45000;

export const useMessagingStore = defineStore("messaging", () => {
  const incoming = ref<IncomingCall | null>(null);
  const call = ref<ActiveCall | null>(null);
  const peers = shallowRef<Record<string, PeerState>>({});
  const localStream = shallowRef<MediaStream | null>(null);
  const muted = ref(false);
  const cameraOff = ref(false);

  let client: AppClient | undefined;
  let queryClient: QueryClient | undefined;
  let myB64 = "";
  let started = false;
  let ringTimer: ReturnType<typeof setTimeout> | undefined;
  const connections = new Map<string, RTCPeerConnection>();
  const queuedIce = new Map<string, RTCIceCandidateInit[]>();
  // Members of conversations we know of, so a signal from a stranger is ignored.
  const knownMembers = new Map<string, AgentPubKey[]>();

  const zome = (fn_name: string, payload: unknown = null) => {
    if (!client) throw new Error("Not connected yet");
    return client.callZome({
      role_name: "eko",
      zome_name: "messages",
      fn_name,
      payload,
    });
  };

  const refreshMessages = () => {
    queryClient?.invalidateQueries({ queryKey: ["messages"] });
  };

  // ---- start up ----------------------------------------------------------

  const start = (appClient: AppClient, qc: QueryClient) => {
    if (started) return;
    started = true;
    client = appClient;
    queryClient = qc;
    myB64 = encodeHashToBase64(appClient.myPubKey);

    const anyClient = appClient as unknown as {
      on?: (event: string, cb: (signal: unknown) => void) => unknown;
    };
    if (typeof anyClient.on === "function") {
      anyClient.on("signal", onSignal);
    } else {
      console.warn("This client cannot receive signals; calls are unavailable.");
    }

    const retry = async () => {
      try {
        const delivered = (await zome("retry_pending")) as number;
        if (delivered > 0) refreshMessages();
      } catch (e) {
        console.warn("retry_pending failed", e);
      }
    };
    loadMembers();
    retry();
    setInterval(retry, RETRY_EVERY_MS);
  };

  const rememberMembers = (key: string, members: AgentPubKey[]) => {
    knownMembers.set(key, members);
  };

  // Keep the member lists current so a call signal can be matched to a group.
  const loadMembers = async () => {
    try {
      const conversations = (await zome("get_my_conversations")) as ConversationView[];
      conversations.forEach((c) => rememberMembers(c.key, c.members));
    } catch (e) {
      console.warn("could not load conversations", e);
    }
  };

  // ---- signals from the conductor ---------------------------------------

  const onSignal = (signal: unknown) => {
    const s = signal as {
      type?: string;
      value?: { zome_name?: string; payload?: unknown };
      zome_name?: string;
      payload?: unknown;
    };
    const app = s?.value ?? s;
    if (!app || app.zome_name !== "messages") return;
    let payload = app.payload;
    if (payload instanceof Uint8Array) {
      try {
        payload = decode(payload);
      } catch (e) {
        console.warn("Could not decode a messages signal", e);
        return;
      }
    }
    const body = payload as MessagesSignal;
    if (body?.type === "NewMessage") {
      loadMembers();
      refreshMessages();
    } else if (body?.type === "Call") {
      handleCallSignal(body).catch((e) => console.error("call signal", e));
    }
  };

  const sendSignal = async (
    kind: CallSignalKind,
    to: AgentPubKey[],
    payload: string | null
  ) => {
    const c = call.value ?? null;
    const inc = incoming.value;
    const conversationKey = c?.conversationKey ?? inc?.conversationKey;
    const callId = c?.callId ?? inc?.callId;
    const mode = c?.mode ?? inc?.mode;
    if (!conversationKey || !callId || !mode || to.length === 0) return;
    await zome("send_call_signal", {
      conversation_key: conversationKey,
      call_id: callId,
      kind,
      mode,
      to,
      payload,
    });
  };

  const others = (members: AgentPubKey[]) =>
    members.filter((m) => encodeHashToBase64(m) !== myB64);

  const agentFor = (b64: string): AgentPubKey | undefined =>
    call.value?.members.find((m) => encodeHashToBase64(m) === b64);

  // ---- media -------------------------------------------------------------

  const getLocalStream = async (
    mode: CallMode,
    isHost: boolean
  ): Promise<MediaStream | null> => {
    if (mode === "Broadcast" && !isHost) return null; // viewers only watch
    const constraints: MediaStreamConstraints =
      mode === "Audio" ? { audio: true } : { audio: true, video: true };
    return navigator.mediaDevices.getUserMedia(constraints);
  };

  const setPeer = (b64: string, patch: Partial<PeerState>) => {
    const existing = peers.value[b64] ?? { stream: null, connection: "new" };
    peers.value = { ...peers.value, [b64]: { ...existing, ...patch } };
  };

  const dropPeer = (b64: string) => {
    connections.get(b64)?.close();
    connections.delete(b64);
    queuedIce.delete(b64);
    const next = { ...peers.value };
    delete next[b64];
    peers.value = next;
  };

  const createPeer = (b64: string): RTCPeerConnection => {
    const existing = connections.get(b64);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    connections.set(b64, pc);
    setPeer(b64, { connection: "new" });

    localStream.value
      ?.getTracks()
      .forEach((track) => pc.addTrack(track, localStream.value as MediaStream));

    pc.onicecandidate = (event) => {
      const target = agentFor(b64);
      if (event.candidate && target) {
        sendSignal("Ice", [target], JSON.stringify(event.candidate.toJSON())).catch(
          (e) => console.warn("ice send failed", e)
        );
      }
    };
    pc.ontrack = (event) => {
      setPeer(b64, { stream: event.streams[0] ?? null });
    };
    pc.onconnectionstatechange = () => {
      setPeer(b64, { connection: pc.connectionState });
    };
    return pc;
  };

  const flushIce = async (b64: string, pc: RTCPeerConnection) => {
    const queued = queuedIce.get(b64) ?? [];
    queuedIce.delete(b64);
    for (const candidate of queued) {
      await pc.addIceCandidate(candidate).catch(console.warn);
    }
  };

  const makeOffer = async (b64: string) => {
    const target = agentFor(b64);
    if (!target) return;
    const pc = createPeer(b64);
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: call.value?.mode !== "Audio",
    });
    await pc.setLocalDescription(offer);
    await sendSignal("Offer", [target], JSON.stringify(pc.localDescription));
  };

  // ---- call signals ------------------------------------------------------

  const handleCallSignal = async (
    s: Extract<MessagesSignal, { type: "Call" }>
  ) => {
    const fromB64 = encodeHashToBase64(s.from);

    if (s.kind === "Invite") {
      if (call.value || incoming.value) return; // busy
      const members = knownMembers.get(s.conversation_key);
      incoming.value = {
        from: s.from,
        conversationKey: s.conversation_key,
        callId: s.call_id,
        mode: s.mode,
        members: members ?? [s.from],
      };
      clearTimeout(ringTimer);
      ringTimer = setTimeout(() => {
        incoming.value = null;
      }, RING_FOR_MS);
      return;
    }

    const active = call.value;
    if (!active || active.callId !== s.call_id) return;

    switch (s.kind) {
      case "Join":
        // Someone new arrived. Whoever is already here offers to them. In a
        // broadcast only the host does.
        if (active.mode !== "Broadcast" || active.hostB64 === myB64) {
          await makeOffer(fromB64);
        }
        break;
      case "Decline":
        useToasts().showMessage("They can't join right now", "error");
        break;
      case "Offer": {
        if (!s.payload) return;
        const pc = createPeer(fromB64);
        if (pc.signalingState === "have-local-offer") {
          // Both sides offered at once. The lower key gives way.
          if (myB64 > fromB64) return;
          await pc.setLocalDescription({ type: "rollback" });
        }
        await pc.setRemoteDescription(JSON.parse(s.payload));
        await flushIce(fromB64, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal("Answer", [s.from], JSON.stringify(pc.localDescription));
        break;
      }
      case "Answer": {
        const pc = connections.get(fromB64);
        if (!pc || !s.payload) return;
        await pc.setRemoteDescription(JSON.parse(s.payload));
        await flushIce(fromB64, pc);
        break;
      }
      case "Ice": {
        if (!s.payload) return;
        const candidate = JSON.parse(s.payload) as RTCIceCandidateInit;
        const pc = connections.get(fromB64);
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(candidate).catch(console.warn);
        } else {
          queuedIce.set(fromB64, [...(queuedIce.get(fromB64) ?? []), candidate]);
        }
        break;
      }
      case "Leave":
        dropPeer(fromB64);
        if (active.mode === "Broadcast" && active.hostB64 === fromB64) {
          useToasts().showMessage("The broadcast ended");
          cleanup();
        }
        break;
      default:
        break;
    }
  };

  // ---- what the UI calls -------------------------------------------------

  const startCall = async (
    conversationKey: string,
    members: AgentPubKey[],
    mode: CallMode
  ) => {
    if (call.value) throw new Error("You are already in a call");
    rememberMembers(conversationKey, members);
    const stream = await getLocalStream(mode, true);
    localStream.value = stream;
    muted.value = false;
    cameraOff.value = false;
    call.value = {
      callId: crypto.randomUUID(),
      conversationKey,
      mode,
      hostB64: myB64,
      members,
    };
    await sendSignal("Invite", others(members), null);
  };

  const acceptIncoming = async () => {
    const inc = incoming.value;
    if (!inc) return;
    clearTimeout(ringTimer);
    const stream = await getLocalStream(inc.mode, false);
    localStream.value = stream;
    muted.value = false;
    cameraOff.value = false;
    call.value = {
      callId: inc.callId,
      conversationKey: inc.conversationKey,
      mode: inc.mode,
      hostB64: encodeHashToBase64(inc.from),
      members: inc.members,
    };
    incoming.value = null;
    // In a broadcast only the host needs to hear from a viewer.
    const to = inc.mode === "Broadcast" ? [inc.from] : others(inc.members);
    await sendSignal("Join", to, null);
  };

  const declineIncoming = async () => {
    const inc = incoming.value;
    if (!inc) return;
    clearTimeout(ringTimer);
    incoming.value = null;
    await zome("send_call_signal", {
      conversation_key: inc.conversationKey,
      call_id: inc.callId,
      kind: "Decline",
      mode: inc.mode,
      to: [inc.from],
      payload: null,
    });
  };

  const cleanup = () => {
    connections.forEach((pc) => pc.close());
    connections.clear();
    queuedIce.clear();
    peers.value = {};
    localStream.value?.getTracks().forEach((track) => track.stop());
    localStream.value = null;
    call.value = null;
  };

  const leave = async () => {
    const active = call.value;
    if (!active) return;
    const to = others(active.members);
    try {
      await sendSignal("Leave", to, null);
    } finally {
      cleanup();
    }
  };

  const toggleMute = () => {
    muted.value = !muted.value;
    localStream.value
      ?.getAudioTracks()
      .forEach((track) => (track.enabled = !muted.value));
  };

  const toggleCamera = () => {
    cameraOff.value = !cameraOff.value;
    localStream.value
      ?.getVideoTracks()
      .forEach((track) => (track.enabled = !cameraOff.value));
  };

  return {
    incoming,
    call,
    peers,
    localStream,
    muted,
    cameraOff,
    start,
    rememberMembers,
    startCall,
    acceptIncoming,
    declineIncoming,
    leave,
    toggleMute,
    toggleCamera,
  };
});
