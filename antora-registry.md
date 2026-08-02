---
name: "Unversioned component URLs"
description: "Choose how bare /component/ URLs behave: version selector (default) or alias to latest."
---

# Overview

Antora does not publish a bare `/component-name/` URL when a component only has numbered versions (`1.0`, `2.0`, …). Shared links and naive nav to the component name 404.

This extension fills that gap with an explicit mode:

- **selector** (default) — publish a versionless chooser page listing versions
- **alias** — redirect to the latest start page (Antora’s documented use-case)

Components that already use `version: ~` are skipped.

## Install

```bash
pnpm add -D github:antora-supplemental/antora-unversioned-component-urls#v2.1.0
```

## Playbook

```yaml
antora:
  extensions:
    - require: '@antora-supplemental/unversioned-component-urls'
      # mode: selector          # default
      # mode: alias             # classic redirect-to-latest
      # short_circuit_single: true
```

## Links

- Upstream proposal: https://gitlab.com/antora/antora/-/issues/291
- Selector follow-up: https://gitlab.com/antora/antora/-/issues/291#note_3633208092
- Antora use case (alias mode): https://docs.antora.org/antora/latest/extend/extension-use-cases/#redirect-from-component-to-latest-version
