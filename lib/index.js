'use strict'

/**
 * Unversioned component URL policy for Antora.
 *
 * Modes:
 * - selector (default in 2.x): publish a versionless ROOT index that lists versions
 * - alias / alias_to_latest: redirect versionless ROOT index to the latest start page
 *   (Antora docs use-case; previous default)
 *
 * Upstream discussion: https://gitlab.com/antora/antora/-/issues/291
 */

function normalizeMode (mode) {
  if (mode == null || mode === '') return 'selector'
  const value = String(mode).toLowerCase().replace(/-/g, '_')
  if (value === 'alias_to_latest' || value === 'alias') return 'alias'
  if (value === 'selector') return 'selector'
  throw new Error(
    `Unknown mode "${mode}" for @antora-supplemental/alias-component-to-latest ` +
      `(expected: selector | alias | alias_to_latest)`
  )
}

function hasVersionlessVersion (component) {
  return component.versions.some((it) => !it.version)
}

function resolveStartPage (contentCatalog, component) {
  return (
    contentCatalog.resolvePage('index.adoc', { component: component.name }) ||
    (component.latest && component.latest.startPage)
  )
}

function pageXref (componentName, componentVersion) {
  const startPage = componentVersion.startPage
  if (!startPage || !startPage.src) {
    return `${componentVersion.version}@${componentName}::index.adoc`
  }
  const { module: moduleName, relative } = startPage.src
  if (!moduleName || moduleName === 'ROOT') {
    return `${componentVersion.version}@${componentName}::${relative}`
  }
  return `${componentVersion.version}@${componentName}:${moduleName}:${relative}`
}

function addLatestAlias (contentCatalog, component) {
  const rel = resolveStartPage(contentCatalog, component)
  if (!rel) return
  contentCatalog.addFile({
    src: {
      component: component.name,
      version: '',
      module: 'ROOT',
      family: 'alias',
      relative: 'index.adoc',
    },
    rel,
  })
}

function buildSelectorAsciiDoc (component) {
  const title = component.title || component.name
  const lines = [
    '= Choose a version',
    '',
    `Select a version of *${title}* to continue.`,
    '',
  ]
  for (const version of component.versions) {
    if (!version.version) continue
    const label = version.displayVersion || version.version
    const latest = version === component.latest ? ' (latest)' : ''
    lines.push(`* xref:${pageXref(component.name, version)}[${label}${latest}]`)
  }
  lines.push('')
  return lines.join('\n')
}

function addSelectorPage (contentCatalog, component) {
  contentCatalog.addFile({
    contents: Buffer.from(buildSelectorAsciiDoc(component)),
    src: {
      component: component.name,
      version: '',
      module: 'ROOT',
      family: 'page',
      relative: 'index.adoc',
    },
  })
}

function applyToComponents (contentCatalog, { mode, shortCircuitSingle }) {
  contentCatalog.getComponents().forEach((component) => {
    if (hasVersionlessVersion(component)) return
    const numbered = component.versions.filter((it) => it.version)
    if (!numbered.length) return

    if (mode === 'alias') {
      addLatestAlias(contentCatalog, component)
      return
    }

    // selector
    if (shortCircuitSingle && numbered.length === 1) {
      addLatestAlias(contentCatalog, component)
      return
    }
    addSelectorPage(contentCatalog, component)
  })
}

module.exports.register = function ({ config }) {
  const mode = normalizeMode(config.mode)
  const shortCircuitSingle = config.short_circuit_single !== false

  this.once('contentClassified', ({ contentCatalog }) => {
    applyToComponents(contentCatalog, { mode, shortCircuitSingle })
  })
}

// exported for unit tests / core port
module.exports._internal = {
  normalizeMode,
  hasVersionlessVersion,
  pageXref,
  buildSelectorAsciiDoc,
  applyToComponents,
}
