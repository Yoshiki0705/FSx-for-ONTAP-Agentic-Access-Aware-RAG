# Documentation Language Tiers

**🌐 Language:** [日本語](../i18n-policy.md) | **English**

---

## Conclusion

Documentation here exists in eight languages, but **not every language carries the same content.** When a translation covers only part of the original, that file carries a disclosure banner. `scripts/check-i18n.py` detects both an abridged translation without a banner and a banner left behind after the translation caught up.

**The point is not to hide the gap.** "A translation exists" and "the same content is readable" are different claims. Presenting only the first leaves a reader designing without a constraint that is stated only in the original.

---

## Three tiers

| Tier | Languages | Requirement |
|------|-----------|-------------|
| 1 (source) | Japanese | The original of every document. What is absent here is absent everywhere |
| 2 (mirror) | English | **Structural parity** with tier 1 (section count and order). If it differs, carry the abridged banner |
| 3 (partial) | ko / zh-CN / zh-TW / fr / de / es | Partial translations of the main documents. If they differ, carry the banner. **An untranslated file is out of scope, not a defect** |

A document's language is its directory, `docs/<lang>/`. **Japanese is the exception and lives directly under `docs/`** (`docs/ja/` does not exist).

---

## The abridged banner

When a translation covers only part of the original, place these two lines immediately after the language switcher.

```markdown
<!-- i18n:abridged -->
> **⚠️ Abridged**: This translation covers part of the Japanese original. See the [Japanese version](../operations-runbook.md) for the complete content.
```

`<!-- i18n:abridged -->` is the machine-readable marker; the line below it is what the reader sees. **One without the other is rejected:** a marker alone is invisible to readers, and prose alone is invisible to the check.

### What the check covers

`python3 scripts/check-i18n.py` (run `--selftest` first) looks at:

| Check | Fails when |
|-------|-----------|
| Undisclosed abridgement | The **section count** differs from the original and no marker is present |
| Stale banner | The section counts match but the marker is still there |
| Marker without disclosure | The marker is present but the reader-facing line is missing, or the reverse |

**Section count is used because it can be counted.** Semantic equivalence is not machine-checkable, so the check only sees whether a translation dropped whole sections. **A section that was thinned out rather than dropped is not detected.** That is the limit of the detector, and its scope is printed at runtime.

`--report` prints per-language coverage. **That table is not written into a document as a fixed value:** it would then depend on a human to update, and nobody would notice when it went stale.

---

## Untranslated files

**An untranslated file is tier 3's scope, not a defect.** Do not create placeholder pages: an empty page promises content and then withholds it.

Where a translation does not exist, link to the Japanese original or the English version. Listing a non-existent file in a language switcher shows up as a broken link and `scripts/check-doc-links.py` fails.

---

## Order of updates

1. Change the Japanese version
2. Make the same change in English (tier 2 requires structural parity)
3. For tier 3 languages, update the file if that language already has it. Do not create new ones
4. Add the abridged banner to any language you could not finish

**If you choose to finish later, add the banner before moving on.** An abridged translation without a banner is indistinguishable from a complete one.

---

## Related documents

| Document | Content |
|----------|---------|
| [Evidence Policy](evidence-policy.md) | How far a statement can be trusted |
| [AGENTS.md](../../AGENTS.md) | Conventions for AI agents |
