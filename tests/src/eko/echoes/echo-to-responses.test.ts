import { runScenario } from "@holochain/tryorama";
import { assert, expect, test } from "vitest";
import { FeedEcho, Echo, EchoTypeName } from "../../../../ui/src/types/types.js";
import { ekoAppBundleSource, wrapInput } from "../../common.js";
import { ActionHash } from "@holochain/client";

test("Agent can reply to an echo", async () => {
  await runScenario(
    async (scenario) => {
      // Set up the app to be installed
      const appSource = { appBundleSource: ekoAppBundleSource };

      // Add 2 players with the test app to the Scenario. The returned players
      // can be destructured.
      const [alice] = await scenario.addPlayersWithApps([appSource]);

      const aliceEchoContent = "alice-test-echo";
      const aliceEchoInput: Echo = {
        text: aliceEchoContent,
        links: [],
        echo_type: EchoTypeName.Original,
      };
      const action_hash: ActionHash = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: aliceEchoInput,
      });

      const aliceReplyContent = "alice-test-reply";
      const aliceReplyInput: Echo = {
        text: aliceReplyContent,
        links: [],
        echo_type: { [EchoTypeName.Reply]: action_hash },
      };
      const reply_action_hash: ActionHash = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: aliceReplyInput,
      });

      const replyEcho: FeedEcho = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(reply_action_hash),
      });
      assert.ok(
        typeof replyEcho.echo.echo_type === "object" &&
          EchoTypeName.Reply in replyEcho.echo.echo_type,
        "echo is a reply"
      );
      assert.equal(
        replyEcho.echo.text,
        aliceReplyContent,
        "reply is alice's reply"
      );

      const originalEcho: FeedEcho = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(action_hash),
      });
      console.log("original", originalEcho.echo.echo_type);
      assert.equal(
        originalEcho.echo.echo_type,
        EchoTypeName.Original,
        "echo is an original echo"
      );
      assert.equal(originalEcho.echo.text, aliceEchoContent, "echo is alice's echo");
      assert.ok(originalEcho.replies_count === 1, "original echo has 1 reply");
      assert.isTrue(
        originalEcho.is_replied,
        "original echo's reply is alice's reply"
      );
    },
    true,
    { timeout: 500000 }
  );
});

test("Agent can reecho an echo only once", async () => {
  await runScenario(
    async (scenario) => {
      // Set up the app to be installed
      const appSource = { appBundleSource: ekoAppBundleSource };

      // Add 2 players with the test app to the Scenario. The returned players
      // can be destructured.
      const [alice] = await scenario.addPlayersWithApps([appSource]);

      // Shortcut peer discovery through gossip and register all agents in every
      // conductor of the scenario.
      await scenario.shareAllAgents();

      const aliceEchoContent = "alice-test-echo";
      const aliceEchoInput: Echo = {
        text: aliceEchoContent,
        links: [],
        echo_type: EchoTypeName.Original,
      };
      const action_hash: ActionHash = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: aliceEchoInput,
      });

      const aliceReechoInput: Echo = {
        text: "",
        links: [],
        echo_type: { [EchoTypeName.Reecho]: action_hash },
      };
      const reecho_action_hash: ActionHash = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: aliceReechoInput,
      });

      const reecho: FeedEcho = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(reecho_action_hash),
      });
      assert.ok(
        typeof reecho.echo.echo_type === "object" &&
          EchoTypeName.Reecho in reecho.echo.echo_type,
        "echo is a reecho"
      );
      assert.deepEqual(
        reecho.echo,
        aliceReechoInput,
        "reecho is alice's reecho"
      );

      const originalEcho: FeedEcho = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(action_hash),
      });
      assert.equal(
        originalEcho.echo.echo_type,
        EchoTypeName.Original,
        "echo is an original echo"
      );
      assert.equal(originalEcho.echo.text, aliceEchoContent, "echo is alice's echo");
      assert.ok(originalEcho.reechos_count === 1, "original echo has 1 reecho");
      assert.isTrue(
        originalEcho.is_reechoed,
        "original echo's reecho is alice's reecho"
      );

      // Reecho the same echo again
      const response = alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: aliceReechoInput,
      });
      await expect(response).rejects.toHaveProperty(
        "message",
        expect.stringContaining("InvalidCommit")
      );
    },
    true,
    { timeout: 500000 }
  );
});

test("Agent can quote an echo", async () => {
  await runScenario(
    async (scenario) => {
      // Set up the app to be installed
      const appSource = { appBundleSource: ekoAppBundleSource };

      // Add 2 players with the test app to the Scenario. The returned players
      // can be destructured.
      const [alice] = await scenario.addPlayersWithApps([appSource]);

      const aliceEchoContent = "alice-test-echo";
      const aliceEchoInput: Echo = {
        text: aliceEchoContent,
        links: [],
        echo_type: EchoTypeName.Original,
      };
      const action_hash: ActionHash = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: aliceEchoInput,
      });

      const aliceQuoteText = "alice-test-quote";
      const aliceQuoteInput: Echo = {
        text: aliceQuoteText,
        links: [],
        echo_type: {
          [EchoTypeName.Quote]: action_hash,
        },
      };
      const quote_action_hash: ActionHash = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: aliceQuoteInput,
      });

      const quote: FeedEcho = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(quote_action_hash),
      });
      assert.ok(
        typeof quote.echo.echo_type === "object" &&
          EchoTypeName.Quote in quote.echo.echo_type,
        "echo is a quote"
      );
      assert.equal(quote.echo.text, aliceQuoteText, "quote is alice's quote");

      const originalEcho: FeedEcho = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echo_with_context",
        payload: wrapInput(action_hash),
      });
      assert.equal(
        originalEcho.echo.echo_type,
        EchoTypeName.Original,
        "echo is an original echo"
      );
      assert.equal(originalEcho.echo.text, aliceEchoContent, "echo is alice's echo");
      assert.ok(originalEcho.quotes_count === 1, "original echo has 1 quote");
      assert.isTrue(
        originalEcho.is_quoted,
        "original echo's quote is alice's quote"
      );
    },
    true,
    { timeout: 500000 }
  );
});
