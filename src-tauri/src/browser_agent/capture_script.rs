pub(crate) const READ_ONLY_CAPTURE_SCRIPT: &str =
    include_str!("../../../src/features/browser-agent/capture/read-only-capture-script.js");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_capture_script_contains_phase3_extractors() {
        assert!(READ_ONLY_CAPTURE_SCRIPT.contains("collectHeadings"));
        assert!(READ_ONLY_CAPTURE_SCRIPT.contains("collectReadableBlocks"));
        assert!(READ_ONLY_CAPTURE_SCRIPT.contains("collectVisualEvidence"));
        assert!(READ_ONLY_CAPTURE_SCRIPT.contains("collectOmittedCapabilities"));
        assert!(READ_ONLY_CAPTURE_SCRIPT.contains("forms:"));
    }
}
