import { runScenario, dhtSync } from "@holochain/tryorama";
import { assert, expect, test } from "vitest";
import { ekoAppBundleSource, wrapInput } from "../../common";

const charter = (membership_rule: any = { MemberSponsor: null }) => ({
  name: "Test State",
  purpose: "A community that keeps its own books.",
  membership_rule,
  decision_rule: { Consent: null },
  credit_policy: { per_crediter: 1000, ceiling: 25000 },
  amends: null,
});

const hashOf = (record: any) => record.signed_action.hashed.hash;

async function setup(scenario: any, n: number) {
  const appSource = { appBundleSource: ekoAppBundleSource };
  return scenario.addPlayersWithApps(Array(n).fill(appSource));
}

const call = (cell: any, fn_name: string, payload: any) =>
  cell.callZome({ zome_name: "genesis", fn_name, payload });

test("membership is a chain back to the founder", async () => {
  await runScenario(
    async (scenario) => {
      const [founder, bob, carol] = await setup(scenario, 3);

      const state = hashOf(await call(founder.cells[0], "found_state", charter()));

      const bobAdmission = hashOf(
        await call(founder.cells[0], "admit", {
          state,
          member: bob.agentPubKey,
          sponsor_admission: null,
        })
      );

      await dhtSync([founder, bob, carol], founder.cells[0].cell_id[0]);

      // Bob sponsors Carol, citing his own admission.
      const carolAdmission = hashOf(
        await call(bob.cells[0], "admit", {
          state,
          member: carol.agentPubKey,
          sponsor_admission: bobAdmission,
        })
      );

      await dhtSync([founder, bob, carol], founder.cells[0].cell_id[0]);

      const chain = await call(carol.cells[0], "get_sponsorship_chain", wrapInput(carolAdmission));
      assert.equal(chain.length, 2);
      assert.deepEqual(chain[0].admission.member, carol.agentPubKey);
      assert.deepEqual(chain[1].admission.member, bob.agentPubKey);
      assert.deepEqual(chain[1].sponsor, founder.agentPubKey);

      const members = await call(carol.cells[0], "get_members", wrapInput(state));
      assert.equal(members.length, 2);
    },
    true,
    { timeout: 500000 }
  );
});

test("nobody can admit themselves", async () => {
  await runScenario(
    async (scenario) => {
      const [founder, bob] = await setup(scenario, 2);
      const state = hashOf(await call(founder.cells[0], "found_state", charter()));
      await dhtSync([founder, bob], founder.cells[0].cell_id[0]);

      await expect(
        call(bob.cells[0], "admit", {
          state,
          member: bob.agentPubKey,
          sponsor_admission: null,
        })
      ).rejects.toThrow();
    },
    true,
    { timeout: 500000 }
  );
});

test("only the founder may admit without a sponsoring admission", async () => {
  await runScenario(
    async (scenario) => {
      const [founder, bob, carol] = await setup(scenario, 3);
      const state = hashOf(await call(founder.cells[0], "found_state", charter()));
      await dhtSync([founder, bob, carol], founder.cells[0].cell_id[0]);

      await expect(
        call(bob.cells[0], "admit", {
          state,
          member: carol.agentPubKey,
          sponsor_admission: null,
        })
      ).rejects.toThrow();
    },
    true,
    { timeout: 500000 }
  );
});

test("a founder-invite state refuses member sponsorship", async () => {
  await runScenario(
    async (scenario) => {
      const [founder, bob, carol] = await setup(scenario, 3);
      const state = hashOf(
        await call(founder.cells[0], "found_state", charter({ FounderInvite: null }))
      );
      const bobAdmission = hashOf(
        await call(founder.cells[0], "admit", {
          state,
          member: bob.agentPubKey,
          sponsor_admission: null,
        })
      );
      await dhtSync([founder, bob, carol], founder.cells[0].cell_id[0]);

      await expect(
        call(bob.cells[0], "admit", {
          state,
          member: carol.agentPubKey,
          sponsor_admission: bobAdmission,
        })
      ).rejects.toThrow();
    },
    true,
    { timeout: 500000 }
  );
});

test("a member cannot cite someone else's admission as their own", async () => {
  await runScenario(
    async (scenario) => {
      const [founder, bob, carol, dave] = await setup(scenario, 4);
      const state = hashOf(await call(founder.cells[0], "found_state", charter()));
      const bobAdmission = hashOf(
        await call(founder.cells[0], "admit", {
          state,
          member: bob.agentPubKey,
          sponsor_admission: null,
        })
      );
      await dhtSync([founder, bob, carol, dave], founder.cells[0].cell_id[0]);

      // Carol is not a member. She borrows Bob's admission to sponsor Dave.
      await expect(
        call(carol.cells[0], "admit", {
          state,
          member: dave.agentPubKey,
          sponsor_admission: bobAdmission,
        })
      ).rejects.toThrow();
    },
    true,
    { timeout: 500000 }
  );
});

test("a commitment cites the committer's own admission", async () => {
  await runScenario(
    async (scenario) => {
      const [founder, bob] = await setup(scenario, 2);
      const state = hashOf(await call(founder.cells[0], "found_state", charter()));
      const bobAdmission = hashOf(
        await call(founder.cells[0], "admit", {
          state,
          member: bob.agentPubKey,
          sponsor_admission: null,
        })
      );
      await dhtSync([founder, bob], founder.cells[0].cell_id[0]);

      await call(bob.cells[0], "make_commitment", {
        state,
        committer_admission: bobAdmission,
        owed_to: null,
        description: "Run the Saturday pantry shift.",
        due: null,
      });
      await dhtSync([founder, bob], founder.cells[0].cell_id[0]);

      const list = await call(founder.cells[0], "get_commitments_for_state", wrapInput(state));
      assert.equal(list.length, 1);

      // The founder has no admission of their own, so they cannot reuse Bob's.
      await expect(
        call(founder.cells[0], "make_commitment", {
          state,
          committer_admission: bobAdmission,
          owed_to: null,
          description: "Pretend to be Bob.",
          due: null,
        })
      ).rejects.toThrow();
    },
    true,
    { timeout: 500000 }
  );
});
