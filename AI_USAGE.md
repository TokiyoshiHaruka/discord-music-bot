# AI Usage

OpenAI Codex assisted this maintenance change with:

- extracting a pure environment parser from the startup boundary;
- enumerating invalid port, placeholder credential, default, and volume cases;
- drafting the read-only GitHub Actions verification workflow and documentation updates.

The repository owner remains responsible for reviewing the retained source,
secrets boundary, dependency licenses, and the behavior claimed in this file.
This disclosure covers the configuration-boundary maintenance change; it does
not claim that the entire historical repository was written without AI help.

No real Discord token, Lavalink password, external service credential, or live
Discord/Lavalink process was used for the verification described by this change.

## 2026-07-29 CodeQL remediation

OpenAI Codex assisted with CodeQL finding triage, regression-test scaffolding,
and review of the one-pass HTML entity decoder. The retained implementation is
bounded by the Node test suite, TypeScript build, dependency audit, pull-request
CI, and CodeQL analysis.

No Discord token, Lavalink password, external service credential, live Discord
session, or live Lavalink process was accessed during this maintenance change.
