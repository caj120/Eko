import { ActionHash } from "@holochain/client";
import { dhtSync, runScenario } from "@holochain/tryorama";
import { assert, expect, test } from "vitest";
import {
  FeedEcho,
  Echo,
  EchoTypeName,
  NotificationTypeName,
  PaginationDirectionName,
} from "../../../../ui/src/types/types";
import { ekoAppBundleSource, wrapInput } from "../../common";
import { createEcho } from "./common";

test("notifications include my agent follows & unfollows", async () => {
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

      // Shortcut peer discovery through gossip and register all agents in every
      // conductor of the scenario.
      await scenario.shareAllAgents();

      // Bob follows Alice
      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "add_creator_for_follower",
        payload: {
          base_follower: bob.agentPubKey,
          target_creator: alice.agentPubKey,
        },
      });

      // Bob unfollows Alice
      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "remove_creator_for_follower",
        payload: {
          base_follower: bob.agentPubKey,
          target_creator: alice.agentPubKey,
        },
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Alice gets notifications
      const notifications = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_notifications",
        payload: wrapInput(null),
      });

      // Notifications should be orderded by action time descending (newest first)
      expect(notifications[0]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.MyAgentUnfollowed,
      });
      expect(notifications[1]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.MyAgentFollowed,
      });

      // Alice gets notifications count
      const count = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "count_my_notifications",
        payload: wrapInput(null),
      });
      expect(count).toEqual(2);
    },
    true,
    { timeout: 500000 }
  );
});

test("notifications include my echoes' likes & unlikes", async () => {
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

      // Shortcut peer discovery through gossip and register all agents in every
      // conductor of the scenario.
      await scenario.shareAllAgents();

      // Alice creates a Echo
      const actionHash: ActionHash = await createEcho(alice.cells[0]);
      assert.ok(actionHash);
      const feedEcho: FeedEcho = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(actionHash),
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob likes Alice's Echo
      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "add_hash_for_liker",
        payload: {
          base_liker: bob.agentPubKey,
          target_hash: actionHash,
        },
      });

      // Bob unlikes Alice's Echo
      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "remove_hash_for_liker",
        payload: {
          base_liker: bob.agentPubKey,
          target_hash: actionHash,
        },
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Alice gets notifications
      const notifications = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_notifications",
        payload: wrapInput(null),
      });

      expect(notifications[0]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.MyEchoUnlikeed,
        feed_echo: feedEcho,
      });
      expect(notifications[1]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.MyEchoLikeed,
        feed_echo: feedEcho,
      });

      // Alice gets notifications count
      const count = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "count_my_notifications",
        payload: wrapInput(null),
      });
      expect(count).toEqual(2);
    },
    true,
    { timeout: 500000 }
  );
});

test("notifications include my echoes' pins & unpins", async () => {
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

      // Shortcut peer discovery through gossip and register all agents in every
      // conductor of the scenario.
      await scenario.shareAllAgents();

      // Alice creates a Echo
      const actionHash: ActionHash = await createEcho(alice.cells[0]);
      assert.ok(actionHash);
      const feedEcho: FeedEcho = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(actionHash),
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob likes Alice's Echo
      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "add_hash_for_pinner",
        payload: {
          base_pinner: bob.agentPubKey,
          target_hash: actionHash,
        },
      });

      // Bob unlikes Alice's Echo
      await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "remove_hash_for_pinner",
        payload: {
          base_pinner: bob.agentPubKey,
          target_hash: actionHash,
        },
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Alice gets notifications
      const notifications = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_notifications",
        payload: wrapInput(null),
      });

      expect(notifications[0]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.MyEchoUnpinned,
        feed_echo: feedEcho,
      });
      expect(notifications[1]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.MyEchoPinned,
        feed_echo: feedEcho,
      });

      // Alice gets notifications count
      const count = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "count_my_notifications",
        payload: wrapInput(null),
      });
      expect(count).toEqual(2);
    },
    true,
    { timeout: 500000 }
  );
});

test("notifications include my echoes' replies, quotes, reechoes", async () => {
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

      // Shortcut peer discovery through gossip and register all agents in every
      // conductor of the scenario.
      await scenario.shareAllAgents();

      // Alice creates a Echo
      const actionHash: ActionHash = await createEcho(alice.cells[0]);
      assert.ok(actionHash);

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob replies to Alice's echo
      const replyInput: Echo = {
        text: "test reply 12345",
        links: [],
        echo_type: { [EchoTypeName.Reply]: actionHash },
      };
      const replyActionHash: ActionHash = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: replyInput,
      });
      const replyFeedEcho: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(replyActionHash),
      });

      // Bob reechoes Alice's echo
      const reechoInput: Echo = {
        text: "",
        links: [],
        echo_type: { [EchoTypeName.Reecho]: actionHash },
      };
      const reechoActionHash: ActionHash = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: reechoInput,
      });
      const reechoFeedEcho: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(reechoActionHash),
      });

      // Bob quotes Alice's echo
      const quoteInput: Echo = {
        text: "a response to a quoted echo",
        links: [],
        echo_type: { [EchoTypeName.Quote]: actionHash },
      };
      const quoteActionHash: ActionHash = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: quoteInput,
      });
      const quoteFeedEcho: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(quoteActionHash),
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Alice gets notifications
      const notifications = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_notifications",
        payload: wrapInput(null),
      });

      expect(notifications[0]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.MyEchoResponded,
        feed_echo: quoteFeedEcho,
      });
      expect(notifications[1]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.MyEchoResponded,
        feed_echo: reechoFeedEcho,
      });
      expect(notifications[2]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.MyEchoResponded,
        feed_echo: replyFeedEcho,
      });

      // Alice gets notifications count
      const count = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "count_my_notifications",
        payload: wrapInput(null),
      });
      expect(count).toEqual(3);
    },
    true,
    { timeout: 500000 }
  );
});

test("notifications include replies, quotes, reechoes to echoes that I also responded to", async () => {
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

      // Shortcut peer discovery through gossip and register all agents in every
      // conductor of the scenario.
      await scenario.shareAllAgents();

      // Carol creates a Echo
      const actionHash: ActionHash = await createEcho(carol.cells[0]);
      assert.ok(actionHash);

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Alice reply's to Carol's echo
      await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: {
          text: "test reply 12345",
          links: [],
          echo_type: { [EchoTypeName.Reply]: actionHash },
        },
      });

      // Bob replies to Carol's echo
      const replyInput: Echo = {
        text: "test reply 12345",
        links: [],
        echo_type: { [EchoTypeName.Reply]: actionHash },
      };
      const replyActionHash: ActionHash = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: replyInput,
      });
      const replyFeedEcho: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(replyActionHash),
      });

      // Bob reechoes Carol's echo
      const reechoInput: Echo = {
        text: "",
        links: [],
        echo_type: { [EchoTypeName.Reecho]: actionHash },
      };
      const reechoActionHash: ActionHash = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: reechoInput,
      });
      const reechoFeedEcho: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(reechoActionHash),
      });

      // Bob quotes Carol's echo
      const quoteInput: Echo = {
        text: "a response to a quoted echo",
        links: [],
        echo_type: { [EchoTypeName.Quote]: actionHash },
      };
      const quoteActionHash: ActionHash = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: quoteInput,
      });
      const quoteFeedEcho: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(quoteActionHash),
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Alice gets notifications
      const notifications = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_notifications",
        payload: wrapInput(null),
      });

      expect(notifications[0]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.FollowedYarnResponded,
        feed_echo: quoteFeedEcho,
      });
      expect(notifications[1]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.FollowedYarnResponded,
        feed_echo: reechoFeedEcho,
      });
      expect(notifications[2]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.FollowedYarnResponded,
        feed_echo: replyFeedEcho,
      });

      // Alice gets notifications count
      const count = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "count_my_notifications",
        payload: wrapInput(null),
      });
      expect(count).toEqual(3);
    },
    true,
    { timeout: 500000 }
  );
});

test("notifications list is time-paginated", async () => {
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

      // Shortcut peer discovery through gossip and register all agents in every
      // conductor of the scenario.
      await scenario.shareAllAgents();

      // Alice creates a Echo
      const actionHash: ActionHash = await createEcho(alice.cells[0]);
      assert.ok(actionHash);

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob replies to Alice's echo
      const replyInput: Echo = {
        text: "xyxyxyxy test reply 1",
        links: [],
        echo_type: { [EchoTypeName.Reply]: actionHash },
      };
      const replyActionHash: ActionHash = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: replyInput,
      });
      const replyFeedEcho: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(replyActionHash),
      });

      // Bob replies to Alice's echo
      const replyInput2: Echo = {
        text: "xyxyxyxy test reply 2",
        links: [],
        echo_type: { [EchoTypeName.Reply]: actionHash },
      };
      const replyActionHash2: ActionHash = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: replyInput2,
      });
      const replyFeedEcho2: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(replyActionHash2),
      });

      // Bob replies to Alice's echo
      const replyInput3: Echo = {
        text: "xyxyxyxy test reply 3",
        links: [],
        echo_type: { [EchoTypeName.Reply]: actionHash },
      };
      const replyActionHash3: ActionHash = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: replyInput3,
      });
      const replyFeedEcho3: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(replyActionHash3),
      });

      // Bob replies to Alice's echo
      const replyInput4: Echo = {
        text: "xyxyxyxy test reply 4",
        links: [],
        echo_type: { [EchoTypeName.Reply]: actionHash },
      };
      const replyActionHash4: ActionHash = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: replyInput4,
      });
      const replyFeedEcho4: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(replyActionHash4),
      });

      // Bob replies to Alice's echo
      const replyInput5: Echo = {
        text: "xyxyxyxy test reply 5",
        links: [],
        echo_type: { [EchoTypeName.Reply]: actionHash },
      };
      const replyActionHash5: ActionHash = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: replyInput5,
      });
      const replyFeedEcho5: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(replyActionHash5),
      });

      // Bob replies to Alice's echo
      const replyInput6: Echo = {
        text: "xyxyxyxy test reply 6",
        links: [],
        echo_type: { [EchoTypeName.Reply]: actionHash },
      };
      const replyActionHash6: ActionHash = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: replyInput6,
      });
      const replyFeedEcho6: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(replyActionHash6),
      });

      // Bob replies to Alice's echo
      const replyInput7: Echo = {
        text: "xyxyxyxy test reply 7",
        links: [],
        echo_type: { [EchoTypeName.Reply]: actionHash },
      };
      const replyActionHash7: ActionHash = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: replyInput7,
      });
      const replyFeedEcho7: FeedEcho = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(replyActionHash7),
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Alice gets notifications
      const page1 = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_notifications",
        payload: wrapInput({
          direction: PaginationDirectionName.Descending,
          limit: 2,
        }),
      });

      // Notifications should be orderded by action time descending (newest first)
      expect(page1[0]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.MyEchoResponded,
        feed_echo: replyFeedEcho7,
      });
      expect(page1[1]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.MyEchoResponded,
        feed_echo: replyFeedEcho6,
      });

      expect(page1[0].timestamp).greaterThanOrEqual(page1[1].timestamp);

      // Alice gets notifications
      const page2 = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_notifications",
        payload: wrapInput({
          after_timestamp: page1[1].timestamp,
          direction: PaginationDirectionName.Descending,
          limit: 2,
        }),
      });

      // Notifications should be orderded by action time descending (newest first)
      expect(page2[0]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.MyEchoResponded,
        feed_echo: replyFeedEcho5,
      });
      expect(page2[1]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.MyEchoResponded,
        feed_echo: replyFeedEcho4,
      });

      expect(page1[0].timestamp)
        .greaterThanOrEqual(page1[1].timestamp)
        .greaterThanOrEqual(page2[0].timestamp)
        .greaterThanOrEqual(page2[1].timestamp);

      // Alice gets notifications
      const page3 = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_notifications",
        payload: wrapInput({
          after_timestamp: page2[1].timestamp,
          direction: PaginationDirectionName.Descending,
          limit: 2,
        }),
      });

      // Notifications should be orderded by action time descending (newest first)
      expect(page3[0]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.MyEchoResponded,
        feed_echo: replyFeedEcho3,
      });
      expect(page3[1]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.MyEchoResponded,
        feed_echo: replyFeedEcho2,
      });

      expect(page1[0].timestamp)
        .greaterThanOrEqual(page1[1].timestamp)
        .greaterThanOrEqual(page2[0].timestamp)
        .greaterThanOrEqual(page2[1].timestamp)
        .greaterThanOrEqual(page3[0].timestamp)
        .greaterThanOrEqual(page3[1].timestamp);

      // Alice gets notifications
      const page4 = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_notifications",
        payload: wrapInput({
          after_timestamp: page3[1].timestamp,
          direction: PaginationDirectionName.Descending,
          limit: 2,
        }),
      });

      // Notifications should be orderded by action time descending (newest first)
      assert.lengthOf(page4, 1);
      expect(page4[0]).toMatchObject({
        agent: bob.agentPubKey,
        notification_type: NotificationTypeName.MyEchoResponded,
        feed_echo: replyFeedEcho,
      });

      expect(page1[0].timestamp)
        .greaterThanOrEqual(page1[1].timestamp)
        .greaterThanOrEqual(page2[0].timestamp)
        .greaterThanOrEqual(page2[1].timestamp)
        .greaterThanOrEqual(page3[0].timestamp)
        .greaterThanOrEqual(page3[1].timestamp)
        .greaterThanOrEqual(page4[0].timestamp);

      const page5 = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_my_notifications",
        payload: wrapInput({
          after_timestamp: page4[0].timestamp,
          direction: PaginationDirectionName.Descending,
          limit: 2,
        }),
      });

      assert.lengthOf(page5, 0);
    },
    true,
    { timeout: 500000 }
  );
});
