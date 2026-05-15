lazy_static::lazy_static! {
    pub static ref BASE64_STANDARD: base64::engine::GeneralPurpose =
        base64::engine::GeneralPurpose::new(
            &base64::alphabet::STANDARD,
            base64::engine::general_purpose::NO_PAD,
        );
}
