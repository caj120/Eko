import { ActionHash } from "@holochain/client";
import { runScenario } from "@holochain/tryorama";
import { assert, expect, test } from "vitest";
import {
  FeedEcho,
  LinkTargetName,
  Echo,
  EchoTypeName,
  PaginationDirectionName,
} from "../../../../ui/src/types/types.js";
import { ekoAppBundleSource, wrapInput } from "../../common.js";

test("Hashtag, cashtag and mention", async () => {
  await runScenario(
    async (scenario) => {
      // Set up the app to be installed
      const appSource = { appBundleSource: ekoAppBundleSource };

      // Add 2 players with the test app to the Scenario. The returned players
      // can be destructured.
      const [alice] = await scenario.addPlayersWithApps([appSource]);

      const echoContent =
        "My Echo with #hashtag #سعيدة #😃😃😃 and $cashtag and @mention";
      const createEchoInput: Echo = {
        text: echoContent,
        links: [{ [LinkTargetName.Mention]: alice.agentPubKey }],
        echo_type: EchoTypeName.Original,
      };

      const action_hash: ActionHash = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: createEchoInput,
      });
      assert.deepEqual(
        action_hash.slice(0, 3),
        Buffer.from([132, 41, 36]),
        "alice created a valid echo"
      );

      const hashtaggedEchoes: FeedEcho[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echoes_for_hashtag_with_context",
        payload: wrapInput({
          hashtag: "#hashtag",
        }),
      });
      assert.ok(hashtaggedEchoes.length === 1, "one echo with hashtag");
      assert.equal(
        hashtaggedEchoes[0].echo.text,
        echoContent,
        "echo content matches"
      );

      const arabicHashtaggedEchoes: FeedEcho[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echoes_for_hashtag_with_context",
        payload: wrapInput({
          hashtag: "#سعيدة",
        }),
      });
      assert.ok(
        arabicHashtaggedEchoes.length === 1,
        "one echo with arabic hashtag"
      );
      assert.equal(
        arabicHashtaggedEchoes[0].echo.text,
        echoContent,
        "echo content matches"
      );

      // get hashtag containing emojis -- invalid hashtag!
      const emojiHashtaggedEchoes: FeedEcho[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echoes_for_hashtag_with_context",
        payload: wrapInput({
          hashtag: "#😃😃😃",
        }),
      });
      assert.ok(emojiHashtaggedEchoes.length === 0, "no echo with emoji hashtag");

      const cashtaggedEchoes: FeedEcho[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echoes_for_cashtag_with_context",
        payload: wrapInput({
          cashtag: "$cashtag",
        }),
      });
      assert.ok(cashtaggedEchoes.length === 1, "one echo with cashtag");

      const mentionedEchoes: FeedEcho[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echoes_for_mention_with_context",
        payload: wrapInput({
          mention: alice.agentPubKey,
        }),
      });
      assert.ok(mentionedEchoes.length === 1, "one echo with mention");
    },
    true,
    { timeout: 500000 }
  );
});

test("Prefix index should return hashtags and cashtags", async () => {
  await runScenario(
    async (scenario) => {
      // Set up the app to be installed
      const appSource = { appBundleSource: ekoAppBundleSource };

      // Add 2 players with the test app to the Scenario. The returned players
      // can be destructured.
      const [alice] = await scenario.addPlayersWithApps([appSource]);

      const echoContent =
        "My Echo with #hashtag #سعيدة #😃😃😃 and $cashtag and @mention";
      const createEchoInput: Echo = {
        text: echoContent,
        links: [{ [LinkTargetName.Mention]: alice.agentPubKey }],
        echo_type: EchoTypeName.Original,
      };

      const action_hash: ActionHash = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: createEchoInput,
      });
      assert.deepEqual(
        action_hash.slice(0, 3),
        Buffer.from([132, 41, 36]),
        "alice created a valid echo"
      );

      const hashtags: string[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "search_tags",
        payload: wrapInput({
          query: "has",
          limit: 10,
        }),
      });
      assert.ok(hashtags.length === 1, "one hashtag");
      assert.equal(hashtags[0], "#hashtag", "hashtag search result matches");

      const arabicHashtags: string[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "search_tags",
        payload: wrapInput({
          query: "سعيدة",
          limit: 10,
        }),
      });
      assert.ok(arabicHashtags.length === 1, "one arabic hashtag");
      assert.equal(
        arabicHashtags[0],
        "#سعيدة",
        "hashtag search result matches"
      );

      // get hashtag containing emojis -- invalid hashtag!
      const emojiHashtags: string[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "search_tags",
        payload: wrapInput({
          query: "😃😃😃",
          limit: 10,
        }),
      });
      assert.ok(emojiHashtags.length === 0, "no emoji hashtags");

      const cashtags: string[] = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "search_tags",
        payload: wrapInput({
          query: "cas",
          limit: 10,
        }),
      });
      assert.ok(cashtags.length === 1, "one cashtag");
      assert.equal(cashtags[0], "$cashtag", "hashtag search result matches");
    },
    true,
    { timeout: 500000 }
  );
});

test("Hashtags list are time-paginated", async () => {
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
        fn_name: "get_echoes_for_hashtag_with_context",
        payload: wrapInput({
          hashtag: "#hashtag",
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
        fn_name: "get_echoes_for_hashtag_with_context",
        payload: wrapInput({
          hashtag: "#hashtag",
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
        fn_name: "get_echoes_for_hashtag_with_context",
        payload: wrapInput({
          hashtag: "#hashtag",
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
        fn_name: "get_echoes_for_hashtag_with_context",
        payload: wrapInput({
          hashtag: "#hashtag",
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
        fn_name: "get_echoes_for_hashtag_with_context",
        payload: wrapInput({
          hashtag: "#hashtag",
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

test("Cashtags list are time-paginated", async () => {
  await runScenario(
    async (scenario) => {
      // Set up the app to be installed
      const appSource = { appBundleSource: ekoAppBundleSource };

      // Add 2 players with the test app to the Scenario. The returned players
      // can be destructured.
      const [alice] = await scenario.addPlayersWithApps([appSource]);

      const echoContent1 = "My Echo with $cashtag 1";
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

      const echoContent2 = "My Echo with $cashtag 2";
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

      const echoContent3 = "My Echo with $cashtag 3";
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

      const echoContent4 = "My Echo with $cashtag 4";
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

      const echoContent5 = "My Echo with $cashtag 5";
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

      const echoContent6 = "My Echo with $cashtag 6";
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

      const echoContent7 = "My Echo with $cashtag 7";
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
        fn_name: "get_echoes_for_cashtag_with_context",
        payload: wrapInput({
          cashtag: "$cashtag",
          page: {
            start_time: null,
            limit: 2,
            order: PaginationDirectionName.Ascending,
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
        fn_name: "get_echoes_for_cashtag_with_context",
        payload: wrapInput({
          cashtag: "$cashtag",
          page: {
            after_hash: page1[page1.length - 1].action_hash,
            limit: 2,
            order: PaginationDirectionName.Ascending,
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
        fn_name: "get_echoes_for_cashtag_with_context",
        payload: wrapInput({
          cashtag: "$cashtag",
          page: {
            after_hash: page2[page2.length - 1].action_hash,
            limit: 2,
            order: PaginationDirectionName.Ascending,
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
        fn_name: "get_echoes_for_cashtag_with_context",
        payload: wrapInput({
          cashtag: "$cashtag",
          page: {
            after_hash: page3[page3.length - 1].action_hash,
            limit: 2,
            order: PaginationDirectionName.Ascending,
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
        fn_name: "get_echoes_for_cashtag_with_context",
        payload: wrapInput({
          cashtag: "$cashtag",
          page: {
            after_hash: page4[page4.length - 1].action_hash,
            limit: 2,
            order: PaginationDirectionName.Ascending,
          },
        }),
      });

      assert.lengthOf(page5, 0);
    },
    true,
    { timeout: 500000 }
  );
});
