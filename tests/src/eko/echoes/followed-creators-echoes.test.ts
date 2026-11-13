import { assert, expect, test } from "vitest";
import { runScenario, dhtSync } from "@holochain/tryorama";
import { ActionHash } from "@holochain/client";
import { createEcho } from "./common";
import { FeedEcho, Echo, EchoTypeName } from "../../../../ui/src/types/types";
import { ekoAppBundleSource, wrapInput } from "../../common";

test("create a Echo and get followed creators echoes", async () => {
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

      // Bob follows alice
      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "follow",
        payload: alice.agentPubKey,
      });

      // Bob gets followed creators echoes
      let collectionOutput: FeedEcho[] = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_followed_creators_echoes_with_context",
        payload: wrapInput(null),
      });
      assert.equal(collectionOutput.length, 0);

      // Alice creates a Echo
      const actionHash: ActionHash = await createEcho(alice.cells[0]);
      assert.ok(actionHash);

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob gets followed creators echoes again
      collectionOutput = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_followed_creators_echoes_with_context",
        payload: wrapInput(null),
      });

      assert.equal(collectionOutput.length, 1);
      assert.deepEqual(actionHash, collectionOutput[0].action_hash);
    },
    true,
    { timeout: 500000 }
  );
});

test("Followed creators echoes should include echoes of followed creator", async () => {
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

      const echoContent = "test-echo-content";
      const echoInput: Echo = {
        text: echoContent,
        links: [],
        echo_type: { [EchoTypeName.Original]: null },
      };
      await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: echoInput,
      });

      const bobEkoInitial: FeedEcho[] = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_followed_creators_echoes_with_context",
        payload: wrapInput(null),
      });
      assert.ok(
        bobEkoInitial.length === 0,
        "bob's echoes feed is initially empty"
      );

      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "follow",
        payload: alice.agentPubKey,
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      const bobEko: FeedEcho[] = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_followed_creators_echoes_with_context",
        payload: wrapInput(null),
      });
      assert.ok(bobEko.length === 1, "bob's echoes feed includes 1 echo");
      assert.equal(
        bobEko[0].echo.text,
        echoContent,
        "echo content in bob's echoes feed matches alice's echo content"
      );
    },
    true,
    { timeout: 500000 }
  );
});

test("Followed creators echoes should include own echoes", async () => {
  await runScenario(
    async (scenario) => {
      // Set up the app to be installed
      const appSource = { appBundleSource: ekoAppBundleSource };

      // Add 2 players with the test app to the Scenario. The returned players
      // can be destructured.
      const [alice] = await scenario.addPlayersWithApps([appSource]);

      const aliceEkoInitial: FeedEcho[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_followed_creators_echoes_with_context",
        payload: wrapInput(null),
      });
      assert.ok(
        aliceEkoInitial.length === 0,
        "alice's echoes feed is initially empty"
      );

      const echoContent = "test-echo-content";
      const echoInput: Echo = {
        text: echoContent,
        links: [],
        echo_type: { [EchoTypeName.Original]: null },
      };
      await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: echoInput,
      });

      const aliceEko: FeedEcho[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_followed_creators_echoes_with_context",
        payload: wrapInput(null),
      });
      assert.ok(
        aliceEko.length === 1,
        "alice's echoes feed includes her echo"
      );
      assert.equal(
        aliceEko[0].echo.text,
        echoContent,
        "echo content matches"
      );
    },
    true,
    { timeout: 500000 }
  );
});

test("Followed creators echoes should not include echoes of non-followed creator", async () => {
  await runScenario(
    async (scenario) => {
      // Set up the app to be installed
      const appSource = { appBundleSource: ekoAppBundleSource };

      // Add 2 players with the test app to the Scenario. The returned players
      // can be destructured.
      const [alice, bob, carol] = await scenario.addPlayersWithApps([
        appSource,
        appSource,
        appSource,
      ]);

      const aliceEchoContent = "alice-test-echo";
      const aliceEchoInput: Echo = {
        text: aliceEchoContent,
        links: [],
        echo_type: { [EchoTypeName.Original]: null },
      };
      await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: aliceEchoInput,
      });

      const carolEchoContent = "carol-test-echo";
      const carolEchoInput: Echo = {
        text: carolEchoContent,
        links: [],
        echo_type: { [EchoTypeName.Original]: null },
      };
      await carol.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: carolEchoInput,
      });

      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "follow",
        payload: alice.agentPubKey,
      });
      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      const bobEko: FeedEcho[] = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_followed_creators_echoes_with_context",
        payload: wrapInput(null),
      });
      assert.ok(bobEko.length === 1, "bob's echoes feed includes 1 echo");
      assert.equal(
        bobEko[0].echo.text,
        aliceEchoContent,
        "echo content in bob's echoes feed matches alice's echo content"
      );
    },
    true,
    { timeout: 500000 }
  );
});

test("Unfollowing should exclude creators echoes from feed", async () => {
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

      const aliceEchoContent = "alice-test-echo";
      const aliceEchoInput: Echo = {
        text: aliceEchoContent,
        links: [],
        echo_type: { [EchoTypeName.Original]: null },
      };
      await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: aliceEchoInput,
      });

      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "follow",
        payload: alice.agentPubKey,
      });
      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      const bobEkoWhenFollowing: FeedEcho[] = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_followed_creators_echoes_with_context",
        payload: wrapInput(null),
      });
      assert.ok(
        bobEkoWhenFollowing.length === 1,
        "bob's echoes feed includes 1 echo"
      );
      assert.equal(
        bobEkoWhenFollowing[0].echo.text,
        aliceEchoContent,
        "echo content in bob's echoes feed matches alice's echo content"
      );

      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "unfollow",
        payload: alice.agentPubKey,
      });

      const bobEko: FeedEcho[] = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_followed_creators_echoes_with_context",
        payload: wrapInput(null),
      });
      assert.ok(bobEko.length === 0, "bob's echoes feed is empty");
    },
    true,
    { timeout: 500000 }
  );
});

test("Followed creators echoes should be ordered by timestamp in descending order", async () => {
  await runScenario(
    async (scenario) => {
      // Set up the app to be installed
      const appSource = { appBundleSource: ekoAppBundleSource };

      // Add 2 players with the test app to the Scenario. The returned players
      // can be destructured.
      const [alice, bob, carol] = await scenario.addPlayersWithApps([
        appSource,
        appSource,
        appSource,
      ]);

      const firstEchoContent = "first-test-echo";
      const firstEchoInput: Echo = {
        text: firstEchoContent,
        links: [],
        echo_type: { [EchoTypeName.Original]: null },
      };
      await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: firstEchoInput,
      });

      const secondEchoContent = "second-test-echo";
      const secondEchoInput: Echo = {
        text: secondEchoContent,
        links: [],
        echo_type: { [EchoTypeName.Original]: null },
      };
      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: secondEchoInput,
      });

      const thirdEchoContent = "third-test-echo";
      const thirdEchoInput: Echo = {
        text: thirdEchoContent,
        links: [],
        echo_type: { [EchoTypeName.Original]: null },
      };
      await carol.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: thirdEchoInput,
      });

      const fourthEchoContent = "fourth-test-echo";
      const fourthEchoInput: Echo = {
        text: fourthEchoContent,
        links: [],
        echo_type: { [EchoTypeName.Original]: null },
      };
      await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: fourthEchoInput,
      });
      // alice starts following bob and carol
      await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "follow",
        payload: bob.agentPubKey,
      });
      await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "follow",
        payload: carol.agentPubKey,
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      const aliceEko: FeedEcho[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_followed_creators_echoes_with_context",
        payload: wrapInput(null),
      });
      assert.ok(
        aliceEko.length === 4,
        "alice's echoes feed includes all 4 echoes"
      );
      assert.equal(
        aliceEko[0].echo.text,
        fourthEchoContent,
        "echo 1 in feed is fourth echo"
      );
      assert.equal(
        aliceEko[1].echo.text,
        thirdEchoContent,
        "echo 2 in feed is third echo"
      );
      assert.equal(
        aliceEko[2].echo.text,
        secondEchoContent,
        "echo 3 in feed is second echo"
      );
      assert.equal(
        aliceEko[3].echo.text,
        firstEchoContent,
        "echo 4 in feed is first echo"
      );
    },
    true,
    { timeout: 500000 }
  );
});

test("Followed creators echoes list are time-paginated", async () => {
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

      const echoContent1 = "My Echo with #hashtag 1";
      const createEchoInput1: Echo = {
        text: echoContent1,
        links: [],
        echo_type: { [EchoTypeName.Original]: null },
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
        echo_type: { [EchoTypeName.Original]: null },
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
        echo_type: { [EchoTypeName.Original]: null },
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
        echo_type: { [EchoTypeName.Original]: null },
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
        echo_type: { [EchoTypeName.Original]: null },
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
        echo_type: { [EchoTypeName.Original]: null },
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
        echo_type: { [EchoTypeName.Original]: null },
      };
      const echoActionHash7 = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: createEchoInput7,
      });

      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "follow",
        payload: alice.agentPubKey,
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      const page1: FeedEcho[] = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_followed_creators_echoes_with_context",
        payload: wrapInput({
          limit: 2,
        }),
      });

      assert.deepEqual(page1[0].action_hash, echoActionHash7);
      assert.deepEqual(page1[1].action_hash, echoActionHash6);
      expect(page1[0].action.timestamp).greaterThanOrEqual(
        page1[1].action.timestamp
      );

      const page2: FeedEcho[] = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_followed_creators_echoes_with_context",
        payload: wrapInput({
          after_hash: page1[page1.length - 1].action_hash,
          limit: 2,
        }),
      });

      assert.deepEqual(page2[0].action_hash, echoActionHash5);
      assert.deepEqual(page2[1].action_hash, echoActionHash4);
      expect(page1[0].action.timestamp)
        .greaterThanOrEqual(page1[1].action.timestamp)
        .greaterThanOrEqual(page2[0].action.timestamp)
        .greaterThanOrEqual(page2[1].action.timestamp);

      const page3: FeedEcho[] = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_followed_creators_echoes_with_context",
        payload: wrapInput({
          after_hash: page2[page2.length - 1].action_hash,
          limit: 2,
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

      const page4: FeedEcho[] = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_followed_creators_echoes_with_context",
        payload: wrapInput({
          after_hash: page3[page3.length - 1].action_hash,
          limit: 2,
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

      const page5: FeedEcho[] = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_followed_creators_echoes_with_context",
        payload: wrapInput({
          after_hash: page4[page4.length - 1].action_hash,
          limit: 2,
        }),
      });

      assert.lengthOf(page5, 0);
    },
    true,
    { timeout: 500000 }
  );
});
