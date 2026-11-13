import { ActionHash } from "@holochain/client";
import { dhtSync, runScenario } from "@holochain/tryorama";
import { assert, expect, test } from "vitest";
import { FeedEcho, Echo, EchoTypeName } from "../../../../ui/src/types/types";
import { ekoAppBundleSource, wrapInput } from "../../common";
import { createEcho } from "./common";

test("create a Echo and get agent echoes", async () => {
  await runScenario(
    async (scenario) => {
      // Set up the app to be installed
      const appSource = { appBundleSource: ekoAppBundleSource };

      // Add 2 players with the test app to the Scenario. The returned players
      // can be destructured.
      const [alice, bob] = await scenario.addPlayersWithApps([
        appSource,
        appSource,
      ]);

      // Bob gets agent echoes
      let collectionOutput: FeedEcho[] = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_agent_echoes_with_context",
        payload: wrapInput({
          agent: alice.agentPubKey,
        }),
      });
      assert.equal(collectionOutput.length, 0);

      // Alice creates a Echo
      const actionHash: ActionHash = await createEcho(alice.cells[0]);
      assert.ok(actionHash);

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob gets agent echoes again
      collectionOutput = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_agent_echoes_with_context",
        payload: wrapInput({
          agent: alice.agentPubKey,
        }),
      });
      assert.equal(collectionOutput.length, 1);
      assert.deepEqual(actionHash, collectionOutput[0].action_hash);
    },
    true,
    { timeout: 500000 }
  );
});

test("Agent echoes list are time-paginated", async () => {
  await runScenario(
    async (scenario) => {
      // Set up the app to be installed
      const appSource = { appBundleSource: ekoAppBundleSource };

      // Add 2 players with the test app to the Scenario. The returned players
      // can be destructured.
      const [alice] = await scenario.addPlayersWithApps([appSource]);

      const echoContent1 = "My Echo with #hashtag 1";
      const createEchoInput1: Echo = {
        text: echoContent1,
        links: [],
        echo_type: EchoTypeName.Original,
      };
      const echoActionHash1 = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: createEchoInput1,
      });

      const echoContent2 = "My Echo with #hashtag 2";
      const createEchoInput2: Echo = {
        text: echoContent2,
        links: [],
        echo_type: EchoTypeName.Original,
      };
      const echoActionHash2 = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: createEchoInput2,
      });

      const echoContent3 = "My Echo with #hashtag 3";
      const createEchoInput3: Echo = {
        text: echoContent3,
        links: [],
        echo_type: EchoTypeName.Original,
      };
      const echoActionHash3 = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: createEchoInput3,
      });

      const echoContent4 = "My Echo with #hashtag 4";
      const createEchoInput4: Echo = {
        text: echoContent4,
        links: [],
        echo_type: EchoTypeName.Original,
      };
      const echoActionHash4 = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: createEchoInput4,
      });

      const echoContent5 = "My Echo with #hashtag 5";
      const createEchoInput5: Echo = {
        text: echoContent5,
        links: [],
        echo_type: EchoTypeName.Original,
      };
      const echoActionHash5 = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: createEchoInput5,
      });

      const echoContent6 = "My Echo with #hashtag 6";
      const createEchoInput6: Echo = {
        text: echoContent6,
        links: [],
        echo_type: EchoTypeName.Original,
      };
      const echoActionHash6 = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: createEchoInput6,
      });

      const echoContent7 = "My Echo with #hashtag 7";
      const createEchoInput7: Echo = {
        text: echoContent7,
        links: [],
        echo_type: EchoTypeName.Original,
      };
      const echoActionHash7 = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: createEchoInput7,
      });

      const page1: FeedEcho[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_agent_echoes_with_context",
        payload: wrapInput({
          agent: alice.agentPubKey,
          page: {
            limit: 2,
          },
        }),
      });

      assert.deepEqual(page1[0].action_hash, echoActionHash7);
      assert.deepEqual(page1[1].action_hash, echoActionHash6);
      expect(page1[0].action.timestamp).greaterThanOrEqual(
        page1[1].action.timestamp
      );

      const page2: FeedEcho[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_agent_echoes_with_context",
        payload: wrapInput({
          agent: alice.agentPubKey,
          page: {
            after_hash: page1[page1.length - 1].action_hash,
            limit: 2,
          },
        }),
      });

      assert.deepEqual(page2[0].action_hash, echoActionHash5);
      assert.deepEqual(page2[1].action_hash, echoActionHash4);

      expect(page1[0].action.timestamp)
        .greaterThanOrEqual(page1[1].action.timestamp)
        .greaterThanOrEqual(page2[0].action.timestamp)
        .greaterThanOrEqual(page2[1].action.timestamp);

      const page3: FeedEcho[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_agent_echoes_with_context",
        payload: wrapInput({
          agent: alice.agentPubKey,
          page: {
            after_hash: page2[page2.length - 1].action_hash,
            limit: 2,
          },
        }),
      });

      assert.deepEqual(page3[0].action_hash, echoActionHash3);
      assert.deepEqual(page3[1].action_hash, echoActionHash2);
      expect(page1[0].action.timestamp)
        .greaterThanOrEqual(page1[1].action.timestamp)
        .greaterThanOrEqual(page2[0].action.timestamp)
        .greaterThanOrEqual(page2[1].action.timestamp)
        .greaterThanOrEqual(page3[0].action.timestamp)
        .greaterThanOrEqual(page3[1].action.timestamp);

      const page4: FeedEcho[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_agent_echoes_with_context",
        payload: wrapInput({
          agent: alice.agentPubKey,
          page: {
            after_hash: page3[page3.length - 1].action_hash,
            limit: 2,
          },
        }),
      });

      assert.lengthOf(page4, 1);
      assert.deepEqual(page4[0].action_hash, echoActionHash1);
      expect(page1[0].action.timestamp)
        .greaterThanOrEqual(page1[1].action.timestamp)
        .greaterThanOrEqual(page2[0].action.timestamp)
        .greaterThanOrEqual(page2[1].action.timestamp)
        .greaterThanOrEqual(page3[0].action.timestamp)
        .greaterThanOrEqual(page3[1].action.timestamp)
        .greaterThanOrEqual(page4[0].action.timestamp);

      const page5: FeedEcho[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_agent_echoes_with_context",
        payload: wrapInput({
          agent: alice.agentPubKey,
          page: {
            after_hash: page4[page4.length - 1].action_hash,
            limit: 2,
          },
        }),
      });

      assert.lengthOf(page5, 0);
    },
    true,
    { timeout: 500000 }
  );
});
