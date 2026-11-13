import { ActionHash } from "@holochain/client";
import { runScenario } from "@holochain/tryorama";
import { assert, expect, test } from "vitest";
import { Echo, EchoTypeName } from "../../../../ui/src/types/types.js";
import {
  ekoAppBundleSource,
  ekoAppBundleSourceNoLengthLimits,
} from "../../common.js";

test("Echo must not be longer than DNA property echo_characters_max chars", async () => {
  await runScenario(
    async (scenario) => {
      // Set up the app to be installed
      const appSource = { appBundleSource: ekoAppBundleSource };

      // Add 2 players with the test app to the Scenario. The returned players
      // can be destructured.
      const [alice] = await scenario.addPlayersWithApps([appSource]);

      const createEchoInput: Echo = {
        text: new Array(200).fill("a").join(""),
        links: [],
        echo_type: { [EchoTypeName.Original]: null },
      };
      const action_hash: ActionHash = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: createEchoInput,
      });
      assert.deepEqual(
        action_hash.slice(0, 3),
        Buffer.from([132, 41, 36]),
        "alice created an echo of valid length"
      );

      createEchoInput.text = new Array(201).fill("a").join("");
      try {
        await alice.cells[0].callZome({
          zome_name: "echoes",
          fn_name: "create_echo",
          payload: createEchoInput,
        });
        assert.fail("echo content longer than echo_characters_max is valid");
      } catch (error) {
        assert.ok(
          true,
          "echo content longer than echo_characters_max is invalid"
        );
      }
    },
    true,
    { timeout: 500000 }
  );
});

test("Echo must not be shorter than DNA property echo_characters_min chars", async () => {
  await runScenario(
    async (scenario) => {
      // Set up the app to be installed
      const appSource = { appBundleSource: ekoAppBundleSource };

      // Add 2 players with the test app to the Scenario. The returned players
      // can be destructured.
      const [alice] = await scenario.addPlayersWithApps([appSource]);

      const createEchoInput: Echo = {
        text: new Array(10).fill("a").join(""),
        links: [],
        echo_type: { [EchoTypeName.Original]: null },
      };
      const action_hash: ActionHash = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: createEchoInput,
      });
      assert.deepEqual(
        action_hash.slice(0, 3),
        Buffer.from([132, 41, 36]),
        "alice created an echo of valid length"
      );

      createEchoInput.text = new Array(2).fill("a").join("");
      try {
        await alice.cells[0].callZome({
          zome_name: "echoes",
          fn_name: "create_echo",
          payload: createEchoInput,
        });
        assert.fail("echo content shorter than echo_characters_min is valid");
      } catch (error) {
        assert.ok(
          true,
          "echo content shorter than echo_characters_min is invalid"
        );
      }
    },
    true,
    { timeout: 500000 }
  );
});

test("Echo can be any length if DNA property echo_characters_min and echo_characters_max not set", async () => {
  await runScenario(
    async (scenario) => {
      // Set up the app to be installed
      const appSource = {
        appBundleSource: ekoAppBundleSourceNoLengthLimits,
      };

      // Add 2 players with the test app to the Scenario. The returned players
      // can be destructured.
      const [alice] = await scenario.addPlayersWithApps([appSource]);

      // 0 charactres
      const createEchoInput2: Echo = {
        text: "",
        links: [],
        echo_type: { [EchoTypeName.Original]: null },
      };
      const action_hash2: ActionHash = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: createEchoInput2,
      });
      assert.deepEqual(
        action_hash2.slice(0, 3),
        Buffer.from([132, 41, 36]),
        "alice created an echo of valid length 0"
      );

      // 1000 charactres
      const createEchoInput3: Echo = {
        text: new Array(1000).fill("a").join(""),
        links: [],
        echo_type: { [EchoTypeName.Original]: null },
      };
      const action_hash3: ActionHash = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "create_echo",
        payload: createEchoInput3,
      });
      assert.deepEqual(
        action_hash3.slice(0, 3),
        Buffer.from([132, 41, 36]),
        "alice created an echo of valid length 1000"
      );
    },
    true,
    { timeout: 500000 }
  );
});

test("Can get deserialized DNA Properties", async () => {
  await runScenario(
    async (scenario) => {
      // Set up the app to be installed
      const appSource = { appBundleSource: ekoAppBundleSource };

      // Add 2 players with the test app to the Scenario. The returned players
      // can be destructured.
      const [alice] = await scenario.addPlayersWithApps([appSource]);

      const properties = await alice.cells[0].callZome({
        zome_name: "echoes",
        fn_name: "get_dna_properties",
        payload: null,
      });
      expect(properties).toHaveProperty("echo_characters_min", 10);
      expect(properties).toHaveProperty("echo_characters_max", 200);
    },
    true,
    { timeout: 500000 }
  );
});
