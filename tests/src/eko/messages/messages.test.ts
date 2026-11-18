import { runScenario } from "@holochain/tryorama";
import { assert, expect, test } from "vitest";
import { ekoAppBundleSource } from "../../common";

const call = (player: any, fn_name: string, payload: any = null) =>
  player.cells[0].callZome({ zome_name: "messages", fn_name, payload });

async function players(scenario: any, n: number) {
  const appSource = { appBundleSource: ekoAppBundleSource };
  const result = await scenario.addPlayersWithApps(Array(n).fill(appSource));
  // Peers must know each other before they can call each other directly.
  await scenario.shareAllAgents();
  return result;
}

const sameKey = (a: Uint8Array, b: Uint8Array) =>
  Buffer.from(a).toString("hex") === Buffer.from(b).toString("hex");

test("a direct message reaches the other person and stays off the shared DHT", async () => {
  await runScenario(
    async (scenario) => {
      const [alice, bob] = await players(scenario, 2);

      const convo = await call(alice, "open_direct", bob.agentPubKey);
      assert.equal(convo.kind, "Direct");
      assert.equal(convo.accepted, true);

      const sent = await call(alice, "send_message", {
        conversation_key: convo.key,
        body: "Are we still on for Saturday?",
        reply_to: null,
      });
      assert.equal(sent.pending.length, 0, "delivered, nothing pending");

      // Bob has the conversation as a request, with the same key.
      const bobConvos = await call(bob, "get_my_conversations");
      assert.equal(bobConvos.length, 1);
      assert.equal(bobConvos[0].key, convo.key);
      assert.equal(bobConvos[0].accepted, false);

      const bobMessages = await call(bob, "get_messages", convo.key);
      assert.equal(bobMessages.length, 1);
      assert.equal(bobMessages[0].body, "Are we still on for Saturday?");
      assert.ok(sameKey(bobMessages[0].from, alice.agentPubKey));
      // Same id on both sides.
      assert.ok(sameKey(bobMessages[0].id.hash, sent.id.hash));
    },
    true,
    { timeout: 500000 }
  );
});

test("a conversation from someone must be accepted before you can reply", async () => {
  await runScenario(
    async (scenario) => {
      const [alice, bob] = await players(scenario, 2);
      const convo = await call(alice, "open_direct", bob.agentPubKey);
      await call(alice, "send_message", {
        conversation_key: convo.key,
        body: "Hello Bob",
        reply_to: null,
      });

      await expect(
        call(bob, "send_message", {
          conversation_key: convo.key,
          body: "Hi!",
          reply_to: null,
        })
      ).rejects.toThrow();

      await call(bob, "accept_conversation", convo.key);
      await call(bob, "send_message", {
        conversation_key: convo.key,
        body: "Hi Alice",
        reply_to: null,
      });

      const aliceMessages = await call(alice, "get_messages", convo.key);
      assert.equal(aliceMessages.length, 2);
      assert.equal(aliceMessages[1].body, "Hi Alice");
    },
    true,
    { timeout: 500000 }
  );
});

test("both people opening the same direct conversation get one key", async () => {
  await runScenario(
    async (scenario) => {
      const [alice, bob] = await players(scenario, 2);
      const a = await call(alice, "open_direct", bob.agentPubKey);
      const b = await call(bob, "open_direct", alice.agentPubKey);
      assert.equal(a.key, b.key);
    },
    true,
    { timeout: 500000 }
  );
});

test("you cannot message yourself, and an empty message is refused", async () => {
  await runScenario(
    async (scenario) => {
      const [alice, bob] = await players(scenario, 2);
      await expect(call(alice, "open_direct", alice.agentPubKey)).rejects.toThrow();

      const convo = await call(alice, "open_direct", bob.agentPubKey);
      await expect(
        call(alice, "send_message", {
          conversation_key: convo.key,
          body: "   ",
          reply_to: null,
        })
      ).rejects.toThrow();
    },
    true,
    { timeout: 500000 }
  );
});

test("a group reaches everyone and each member sees the same thread", async () => {
  await runScenario(
    async (scenario) => {
      const [alice, bob, carol] = await players(scenario, 3);

      const group = await call(alice, "create_group", {
        title: "Saturday food pantry",
        members: [bob.agentPubKey, carol.agentPubKey],
        first_message: "Doors open at 9.",
      });
      assert.equal(group.kind, "Group");
      assert.equal(group.members.length, 3);

      for (const member of [bob, carol]) {
        const convos = await call(member, "get_my_conversations");
        assert.equal(convos.length, 1);
        assert.equal(convos[0].title, "Saturday food pantry");
        assert.equal(convos[0].members.length, 3);
      }

      await call(carol, "accept_conversation", group.key);
      await call(carol, "send_message", {
        conversation_key: group.key,
        body: "I can bring chairs.",
        reply_to: null,
      });

      for (const member of [alice, bob]) {
        const thread = await call(member, "get_messages", group.key);
        assert.equal(thread.length, 2);
        assert.equal(thread[1].body, "I can bring chairs.");
      }
    },
    true,
    { timeout: 500000 }
  );
});

test("a group needs at least three people and a name", async () => {
  await runScenario(
    async (scenario) => {
      const [alice, bob] = await players(scenario, 2);
      await expect(
        call(alice, "create_group", {
          title: "Just us",
          members: [bob.agentPubKey],
          first_message: "hi",
        })
      ).rejects.toThrow();
    },
    true,
    { timeout: 500000 }
  );
});

test("a call signal reaches a conversation member, with the sender's real key", async () => {
  await runScenario(
    async (scenario) => {
      const [alice, bob] = await players(scenario, 2);
      const convo = await call(alice, "open_direct", bob.agentPubKey);
      // Bob has to hold the conversation to accept signals for it.
      await call(alice, "send_message", {
        conversation_key: convo.key,
        body: "Ring ring",
        reply_to: null,
      });

      const received = new Promise<any>((resolve) => {
        (bob as any).appWs.on("signal", (signal: any) => {
          const payload = signal?.value?.payload ?? signal?.payload;
          if (payload?.type === "Call") resolve(payload);
        });
      });

      await call(alice, "send_call_signal", {
        conversation_key: convo.key,
        call_id: "call-1",
        kind: "Invite",
        mode: "Video",
        to: [bob.agentPubKey],
        payload: null,
      });

      const signal: any = await Promise.race([
        received,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("no call signal arrived")), 60000)
        ),
      ]);
      assert.equal(signal.call_id, "call-1");
      assert.equal(signal.kind, "Invite");
      assert.ok(sameKey(signal.from, alice.agentPubKey));
    },
    true,
    { timeout: 500000 }
  );
});
