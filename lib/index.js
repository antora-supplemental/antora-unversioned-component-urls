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
    `Unknown mode "${mode}" for @antora-supplemental/unversioned-component-urls ` +
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
  // A real page needs a registered component version (for displayVersion in the UI
  // model). Register Antora’s unversioned slot (version '') as a *prerelease* so it
  // does not steal `component.latest` from the numbered releases.
  if (!hasVersionlessVersion(component)) {
    const latest = component.latest || {}
    contentCatalog.registerComponentVersion(component.name, '', {
      title: latest.title || component.title || component.name,
      asciidoc: latest.asciidoc,
      prerelease: true,
      displayVersion: 'versions',
    })
  }
  // Vinyl requires `path` so AsciiDoc conversion can resolve dirname.
  const relative = 'index.adoc'
  const path = `modules/ROOT/pages/${relative}`
  contentCatalog.addFile({
    contents: Buffer.from(buildSelectorAsciiDoc(component)),
    path,
    src: {
      component: component.name,
      version: '',
      module: 'ROOT',
      family: 'page',
      relative,
      basename: relative,
      stem: 'index',
      extname: '.adoc',
      path,
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

module.exports.register = function ({ config = {} }) {
  // Antora converts playbook keys from snake_case to camelCase before
  // calling register({ config }). Accept both shapes.
  const mode = normalizeMode(config.mode)
  const shortCircuitRaw =
    config.shortCircuitSingle !== undefined
      ? config.shortCircuitSingle
      : config.short_circuit_single
  const shortCircuitSingle = shortCircuitRaw !== false

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
