import { ActionHash } from "@holochain/client";
import { dhtSync, runScenario } from "@holochain/tryorama";
import { assert, expect, test } from "vitest";
import { FeedEcho, EchoTypeName } from "../../../../ui/src/types/types";
import { ekoAppBundleSource, wrapInput } from "../../common";
import { createEcho } from "./common";

test("Echo with context contains likes count and is_likeed", async () => {
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

      // Alice creates a Echo
      const actionHash: ActionHash = await createEcho(alice.cells[0]);
      assert.ok(actionHash);

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob likes the echo
      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "like",
        payload: actionHash,
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob gets the echo with context
      let feedEcho: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(actionHash),
      });
      expect(feedEcho.likes_count).toEqual(1);
      expect(feedEcho.is_likeed).true;

      // Alice gets the echo with context
      let aliceFeedEcho: FeedEcho = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(actionHash),
      });
      expect(aliceFeedEcho.likes_count).toEqual(1);
      expect(aliceFeedEcho.is_likeed).false;

      // Bob unlikes the echo
      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "unlike",
        payload: actionHash,
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob gets the echo with context
      feedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(actionHash),
      });
      expect(feedEcho.likes_count).toEqual(0);
      expect(feedEcho.is_likeed).false;

      // Alice gets the echo with context
      aliceFeedEcho = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(actionHash),
      });
      expect(aliceFeedEcho.likes_count).toEqual(0);
      expect(aliceFeedEcho.is_likeed).false;
    },
    true,
    { timeout: 100000 }
  );
});

test("Echo with context contains replies count and is_replied", async () => {
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

      // Alice creates a Echo
      const actionHash: ActionHash = await createEcho(alice.cells[0]);
      assert.ok(actionHash);

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob replies the echo
      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: {
          text: "my reply blah blah",
          links: [],
          echo_type: { [EchoTypeName.Reply]: actionHash },
        },
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob gets the echo with context
      const feedEcho: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(actionHash),
      });
      expect(feedEcho.replies_count).toEqual(1);
      expect(feedEcho.is_replied).true;

      // Alice gets the echo with context
      const aliceFeedEcho: FeedEcho = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(actionHash),
      });
      expect(aliceFeedEcho.replies_count).toEqual(1);
      expect(aliceFeedEcho.is_replied).false;
    },
    true,
    { timeout: 100000 }
  );
});

test("Echo with context contains quotes count and is_quoted", async () => {
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

      // Alice creates a Echo
      const actionHash: ActionHash = await createEcho(alice.cells[0]);
      assert.ok(actionHash);

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob replies the echo
      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: {
          text: "this is a quote blah blah",
          links: [],
          echo_type: { [EchoTypeName.Quote]: actionHash },
        },
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob gets the echo with context
      const feedEcho: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(actionHash),
      });
      expect(feedEcho.quotes_count).toEqual(1);
      expect(feedEcho.is_quoted).true;

      // Alice gets the echo with context
      const aliceFeedEcho: FeedEcho = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(actionHash),
      });
      expect(aliceFeedEcho.quotes_count).toEqual(1);
      expect(aliceFeedEcho.is_quoted).false;
    },
    true,
    { timeout: 100000 }
  );
});

test("Echo with context contains reechoes count and is_reechoed", async () => {
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

      // Alice creates a Echo
      const actionHash: ActionHash = await createEcho(alice.cells[0]);
      assert.ok(actionHash);

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob reechoes the echo
      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: {
          text: "",
          links: [],
          echo_type: { [EchoTypeName.Reecho]: actionHash },
        },
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob gets the echo with context
      const feedEcho: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(actionHash),
      });
      expect(feedEcho.reechos_count).toEqual(1);
      expect(feedEcho.is_reechoed).true;
      console.warn("bob got echo");

      // Alice gets the echo with context
      const aliceFeedEcho: FeedEcho = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(actionHash),
      });
      console.warn("alice got echo");

      expect(aliceFeedEcho.reechos_count).toEqual(1);
      expect(aliceFeedEcho.is_reechoed).false;
    },
    true,
    { timeout: 100000 }
  );
});

test("Echo with context contains is_pinned", async () => {
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

      // Alice creates a Echo
      const actionHash: ActionHash = await createEcho(alice.cells[0]);
      assert.ok(actionHash);

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob pins the echo
      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "pin_hash",
        payload: actionHash,
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob gets the echo with context
      let feedEcho: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(actionHash),
      });
      expect(feedEcho.is_pinned).true;

      // Alice gets the echo with context
      let aliceFeedEcho: FeedEcho = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(actionHash),
      });
      expect(aliceFeedEcho.is_pinned).false;

      // Bob unpins the echo
      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "unpin_hash",
        payload: actionHash,
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob gets the echo with context
      feedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(actionHash),
      });
      expect(feedEcho.is_pinned).false;

      // Alice gets the echo with context
      aliceFeedEcho = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(actionHash),
      });
      expect(aliceFeedEcho.is_pinned).false;
    },
    true,
    { timeout: 100000 }
  );
});
