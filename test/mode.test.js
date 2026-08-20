'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  normalizeMode,
  pageXref,
  buildSelectorAsciiDoc,
  applyToComponents,
} = require('../lib/index.js')._internal

describe('normalizeMode', () => {
  it('defaults to selector', () => {
    assert.equal(normalizeMode(), 'selector')
    assert.equal(normalizeMode(''), 'selector')
  })

  it('accepts alias aliases', () => {
    assert.equal(normalizeMode('alias'), 'alias')
    assert.equal(normalizeMode('alias_to_latest'), 'alias')
    assert.equal(normalizeMode('alias-to-latest'), 'alias')
  })

  it('rejects unknown modes', () => {
    assert.throws(() => normalizeMode('redirect'), /Unknown mode/)
  })
})

describe('pageXref', () => {
  it('uses start page src when present', () => {
    const xref = pageXref('docs', {
      version: '0.1',
      startPage: { src: { module: 'ROOT', relative: 'index.adoc' } },
    })
    assert.equal(xref, '0.1@docs::index.adoc')
  })

  it('includes non-ROOT module', () => {
    const xref = pageXref('docs', {
      version: '1.0',
      startPage: { src: { module: 'guide', relative: 'start.adoc' } },
    })
    assert.equal(xref, '1.0@docs:guide:start.adoc')
  })
})

describe('buildSelectorAsciiDoc', () => {
  it('lists versions with latest marker', () => {
    const v1 = { version: '1.0', displayVersion: '1.0', startPage: { src: { module: 'ROOT', relative: 'index.adoc' } } }
    const v01 = { version: '0.1', displayVersion: '0.1', startPage: { src: { module: 'ROOT', relative: 'index.adoc' } } }
    const component = { name: 'docs', title: 'Docs', latest: v1, versions: [v1, v01] }
    const adoc = buildSelectorAsciiDoc(component)
    assert.match(adoc, /^= Choose a version/m)
    assert.match(adoc, /xref:1\.0@docs::index\.adoc\[1\.0 \(latest\)\]/)
    assert.match(adoc, /xref:0\.1@docs::index\.adoc\[0\.1\]/)
  })
})

describe('applyToComponents', () => {
  function mockCatalog (components) {
    const files = []
    return {
      files,
      getComponents: () => components,
      resolvePage: () => components[0]?.latest?.startPage || null,
      addFile: (file) => {
        files.push(file)
        return file
      },
    }
  }

  it('selector mode adds a versionless page for multi-version components', () => {
    const latest = {
      version: '1.0',
      startPage: { src: { module: 'ROOT', relative: 'index.adoc' } },
    }
    const older = {
      version: '0.1',
      startPage: { src: { module: 'ROOT', relative: 'index.adoc' } },
    }
    const catalog = mockCatalog([
      { name: 'docs', title: 'Docs', latest, versions: [latest, older] },
    ])
    applyToComponents(catalog, { mode: 'selector', shortCircuitSingle: true })
    assert.equal(catalog.files.length, 1)
    assert.equal(catalog.files[0].src.family, 'page')
    assert.equal(catalog.files[0].src.version, '')
    assert.match(catalog.files[0].contents.toString(), /Choose a version/)
  })

  it('selector mode short-circuits single-version components to an alias', () => {
    const only = {
      version: '0.1',
      startPage: { src: { component: 'docs', version: '0.1', module: 'ROOT', relative: 'index.adoc' } },
    }
    const catalog = mockCatalog([{ name: 'docs', title: 'Docs', latest: only, versions: [only] }])
    applyToComponents(catalog, { mode: 'selector', shortCircuitSingle: true })
    assert.equal(catalog.files.length, 1)
    assert.equal(catalog.files[0].src.family, 'alias')
  })

  it('selector mode keeps a chooser when shortCircuitSingle is false', () => {
    const only = {
      version: '0.1',
      startPage: { src: { component: 'docs', version: '0.1', module: 'ROOT', relative: 'index.adoc' } },
    }
    const catalog = mockCatalog([{ name: 'docs', title: 'Docs', latest: only, versions: [only] }])
    applyToComponents(catalog, { mode: 'selector', shortCircuitSingle: false })
    assert.equal(catalog.files.length, 1)
    assert.equal(catalog.files[0].src.family, 'page')
    assert.match(catalog.files[0].contents.toString(), /Choose a version/)
  })

  it('alias mode always adds an alias', () => {
    const latest = {
      version: '1.0',
      startPage: { src: { component: 'docs', version: '1.0', module: 'ROOT', relative: 'index.adoc' } },
    }
    const older = {
      version: '0.1',
      startPage: { src: { component: 'docs', version: '0.1', module: 'ROOT', relative: 'index.adoc' } },
    }
    const catalog = mockCatalog([
      { name: 'docs', title: 'Docs', latest, versions: [latest, older] },
    ])
    applyToComponents(catalog, { mode: 'alias', shortCircuitSingle: true })
    assert.equal(catalog.files.length, 1)
    assert.equal(catalog.files[0].src.family, 'alias')
    assert.equal(catalog.files[0].rel, latest.startPage)
  })

  it('skips components that already have a versionless version', () => {
    const versionless = { version: '', startPage: { src: { module: 'ROOT', relative: 'index.adoc' } } }
    const catalog = mockCatalog([
      { name: 'docs', title: 'Docs', latest: versionless, versions: [versionless] },
    ])
    applyToComponents(catalog, { mode: 'selector', shortCircuitSingle: true })
    assert.equal(catalog.files.length, 0)
  })
})
