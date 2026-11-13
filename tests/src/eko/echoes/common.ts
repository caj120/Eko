import { CallableCell } from "@holochain/tryorama";
import { ActionHash } from "@holochain/client";

export async function sampleEcho(cell: CallableCell, partialEcho = {}) {
  return {
    ...{
      text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      links: [],
      echo_type: { Original: null },
    },
    ...partialEcho,
  };
}

export async function createEcho(
  cell: CallableCell,
  echo = undefined
): Promise<ActionHash> {
  return cell.callZome({
    zome_name: "echoes",
    fn_name: "create_echo",
    payload: echo || (await sampleEcho(cell)),
  });
}
