import { ActionHash } from "@holochain/client";
import { dhtSync, runScenario } from "@holochain/tryorama";
import { assert, test } from "vitest";
import { FeedEcho } from "../../../../ui/src/types/types.js";
import { ekoAppBundleSource, wrapInput } from "../../common.js";
import { createEcho } from "./common.js";

test("link a Pinner to a Echo", async () => {
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

      const baseAddress = alice.agentPubKey;
      const targetActionHash: ActionHash = await createEcho(alice.cells[0]);

      // Bob gets the links, should be empty
      let linksOutput: FeedEcho[] = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echoes_for_pinner_with_context",
        payload: wrapInput(baseAddress),
      });
      assert.equal(linksOutput.length, 0);

      // Alice creates a link from Pinner to Echo
      await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "pin_hash",
        payload: targetActionHash,
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob gets the links again
      linksOutput = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echoes_for_pinner_with_context",
        payload: wrapInput(baseAddress),
      });
      assert.equal(linksOutput.length, 1);
      assert.deepEqual(targetActionHash, linksOutput[0].action_hash);

      await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "unpin_hash",
        payload: targetActionHash,
      });

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      // Bob gets the links again
      linksOutput = await bob.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_echoes_for_pinner_with_context",
        payload: wrapInput(baseAddress),
      });
      assert.equal(linksOutput.length, 0);
    },
    true,
    { timeout: 500000 }
  );
});
