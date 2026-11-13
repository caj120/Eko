use hdi::prelude::*;

/// Credits-specific DNA properties.
///
/// Serde ignores unknown fields, so this struct coexists with the echoes zome's
/// own `DnaProperties` reading the same `properties` map in dna.yaml.
#[derive(Debug, Serialize, Deserialize, SerializedBytes, Clone)]
pub struct CreditDnaProperties {
    pub credit_characters_min: Option<usize>,
    pub credit_characters_max: Option<usize>,
}

#[hdk_extern]
pub fn get_credit_dna_properties(_: ()) -> ExternResult<CreditDnaProperties> {
    CreditDnaProperties::try_from(dna_info()?.modifiers.properties)
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.into())))
}
