# AegisAI rebrand plan

## Product identity

- Product name: **AegisAI**
- Product promise: **Protect every input before it reaches your AI agent.**

## Scope

1. Rename the distributable and Python package to `aegisai`.
2. Align runtime commands, Docker identifiers, database defaults, local demo addresses, automation variables, and repository metadata.
3. Apply the product name and promise across the web interface, backend metadata, documentation, developer guidance, test fixtures, and the pitch deck.
4. Regenerate branded architecture visuals and replace stale documentation captures.
5. Verify no legacy product identifiers remain in tracked text, then run backend, frontend, and secret-scan checks.

## Compatibility note

The new default SQLite database is `aegisai.db`. Existing local databases and untracked environment files remain untouched so personal data and credentials are never rewritten as part of the rebrand.

## Completion criteria

- [x] Runtime identity and deployment configuration updated
- [x] User interface and API metadata updated
- [x] Documentation, visuals, and pitch deck updated
- [x] Legacy references removed from active source and documentation
- [x] Production build, backend test suite, and manual secret-pattern audit completed
- [ ] Resolve two pre-existing frontend unit-test failures before treating the full frontend suite as green
- [ ] Run the automated Gitleaks scan in CI or an environment that provides its documented script/binary
