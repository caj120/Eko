use crate::all_echoes::get_all_echo_hashes;
use crate::tag_to_echoes::get_echo_hashes_for_tag;
use echoes_integrity::make_tag_prefix_index;
use hc_zome_input::ZomeFnInput;
use hdk::prelude::*;

/// Select random elements from a slice using HDK's random_bytes
fn hdk_choose_multiple<T: Clone>(slice: &[T], count: usize) -> ExternResult<Vec<T>> {
    if count >= slice.len() {
        return Ok(slice.to_vec());
    }
    if count == 0 {
        return Ok(vec![]);
    }

    // Fisher-Yates partial shuffle: shuffle first `count` elements
    let mut indices: Vec<usize> = (0..slice.len()).collect();
    let random_bytes = random_bytes((count * 4) as u32)?;

    for i in 0..count {
        let byte_offset = i * 4;
        let random_u32 = u32::from_le_bytes([
            random_bytes[byte_offset],
            random_bytes[byte_offset + 1],
            random_bytes[byte_offset + 2],
            random_bytes[byte_offset + 3],
        ]);
        let j = i + (random_u32 as usize) % (slice.len() - i);
        indices.swap(i, j);
    }

    Ok(indices[..count].iter().map(|&i| slice[i].clone()).collect())
}

#[hdk_extern]
pub fn get_random_echo_hashes(input: ZomeFnInput<usize>) -> ExternResult<Vec<ActionHash>> {
    let hashes = match get_all_echo_hashes(input.get_strategy()) {
        Ok(h) => h,
        Err(e) => {
            debug!("Skipping unavailable echo hashes: {:?}", e);
            return Ok(vec![]);
        }
    };

    hdk_choose_multiple(&hashes, input.input)
}

#[hdk_extern]
pub fn get_random_tags(input: ZomeFnInput<usize>) -> ExternResult<Vec<String>> {
    let prefix_index = match make_tag_prefix_index() {
        Ok(p) => p,
        Err(e) => {
            debug!("Skipping unavailable tag prefix index: {:?}", e);
            return Ok(vec![]);
        }
    };
    let strategy = input.get_strategy();

    match prefix_index.get_random_results(input.input, strategy) {
        Ok(tags) => Ok(tags),
        Err(e) => {
            debug!("Skipping unavailable random tags: {:?}", e);
            Ok(vec![])
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GetRandomEchoesForTagInput {
    tag: String,
    count: usize,
}
#[hdk_extern]
pub fn get_random_echo_hashes_for_tag(
    input: ZomeFnInput<GetRandomEchoesForTagInput>,
) -> ExternResult<Vec<ActionHash>> {
    let strategy = input.get_strategy();
    let inner = input.input;
    let hashes = get_echo_hashes_for_tag(inner.tag, .., None, strategy)?;

    hdk_choose_multiple(&hashes, inner.count)
}
