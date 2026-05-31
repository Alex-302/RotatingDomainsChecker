# Specs_upd

## 2026-05-25

- README.md: clarified that `force_search_ahead` canonicalizes from the live pattern subset only.
- README.md: documented that mixed pattern/non-pattern working sets stay in pattern mode.
- README.md: documented alias-vs-final-host policy for `many candidates -> one final host`.
- docs/specs.md: added the mixed-set rule for `force_search_ahead` and excluded non-pattern extras from replacement surface.
- docs/specs.md: clarified that `non_pattern_mirror` is used only when no live pattern domains remain.
- docs/specs.md: fixed the canonical mirror contract: smallest reachable pattern alias wins over a shared final host.
