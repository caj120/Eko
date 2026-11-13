import { ActionHash } from "@holochain/client";
import { dhtSync, runScenario } from "@holochain/tryorama";
import { assert, expect, test } from "vitest";
import { ekoAppBundleSource, wrapInput } from "../../common";

const credit = (recipient: any, extra = {}) => ({
  recipient,
  contribution: "Ran the weekly food pantry for a year.",
  credit_ref: null,
  attached_to: null,
  ...extra,
});

async function forRecipient(cell: any, recipient: any) {
  return cell.callZome({
    zome_name: "credits",
    fn_name: "get_credits_for_recipient",
    payload: wrapInput(recipient),
  });
}

test("a credit is visible to others and the recipient cannot edit or delete it", async () => {
  await runScenario(
    async (scenario) => {
      const appSource = { appBundleSource: ekoAppBundleSource };
      const [alice, bob] = await scenario.addPlayersWithApps([appSource, appSource]);

      const hash: ActionHash = (
        await alice.cells[0].callZome({
          zome_name: "credits",
          fn_name: "create_credit",
          payload: credit(bob.agentPubKey),
        })
      ).signed_action.hashed.hash;
      assert.ok(hash);

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

      const seen = await forRecipient(bob.cells[0], bob.agentPubKey);
      assert.equal(seen.length, 1);
      assert.deepEqual(seen[0].author, alice.agentPubKey);

      // The subject of a credit cannot remove it from their own record.
      await expect(
        bob.cells[0].callZome({
          zome_name: "credits",
          fn_name: "delete_credit",
          payload: hash,
        })
      ).rejects.toThrow();

      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);
      assert.equal((await forRecipient(bob.cells[0], bob.agentPubKey)).length, 1);

      // The author can retract their own.
      await alice.cells[0].callZome({
        zome_name: "credits",
        fn_name: "delete_credit",
        payload: hash,
      });
      await dhtSync([alice, bob], alice.cells[0].cell_id[0]);
      assert.equal((await forRecipient(bob.cells[0], bob.agentPubKey)).length, 0);
    },
    true,
    { timeout: 500000 }
  );
});

test("nobody can credit themselves", async () => {
  await runScenario(
    async (scenario) => {
      const appSource = { appBundleSource: ekoAppBundleSource };
      const [alice] = await scenario.addPlayersWithApps([appSource]);

      await expect(
        alice.cells[0].callZome({
          zome_name: "credits",
          fn_name: "create_credit",
          payload: credit(alice.agentPubKey),
        })
      ).rejects.toThrow();
    },
    true,
    { timeout: 500000 }
  );
});

test("a credit with an empty contribution is rejected", async () => {
  await runScenario(
    async (scenario) => {
      const appSource = { appBundleSource: ekoAppBundleSource };
      const [alice, bob] = await scenario.addPlayersWithApps([appSource, appSource]);

      await expect(
        alice.cells[0].callZome({
          zome_name: "credits",
          fn_name: "create_credit",
          payload: credit(bob.agentPubKey, { contribution: "" }),
        })
      ).rejects.toThrow();
    },
    true,
    { timeout: 500000 }
  );
});

test("credit line counts distinct crediters, not credits", async () => {
  await runScenario(
    async (scenario) => {
      const appSource = { appBundleSource: ekoAppBundleSource };
      const [alice, bob, carol] = await scenario.addPlayersWithApps([
        appSource,
        appSource,
        appSource,
      ]);

      // Alice credits Carol three times. Bob credits once.
      for (const text of ["Taught me Rust.", "Fixed my roof.", "Drove me to the airport."]) {
        await alice.cells[0].callZome({
          zome_name: "credits",
          fn_name: "create_credit",
          payload: credit(carol.agentPubKey, { contribution: text }),
        });
      }
      await bob.cells[0].callZome({
        zome_name: "credits",
        fn_name: "create_credit",
        payload: credit(carol.agentPubKey),
      });

      await dhtSync([alice, bob, carol], alice.cells[0].cell_id[0]);

      const total = await carol.cells[0].callZome({
        zome_name: "credits",
        fn_name: "count_credits_for_recipient",
        payload: wrapInput(carol.agentPubKey),
      });
      const distinct = await carol.cells[0].callZome({
        zome_name: "credits",
        fn_name: "count_distinct_crediters",
        payload: wrapInput(carol.agentPubKey),
      });
      assert.equal(total, 4);
      assert.equal(distinct, 2);

      const line = await carol.cells[0].callZome({
        zome_name: "credits",
        fn_name: "get_credit_line",
        payload: wrapInput(carol.agentPubKey),
      });
      assert.equal(line.basis.DistinctCrediters.crediters, 2);
    },
    true,
    { timeout: 500000 }
  );
});
