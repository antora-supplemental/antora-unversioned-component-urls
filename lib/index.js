'use strict'

/**
 * Alias versioned component root (`/component/`) to the latest version start page.
 * Same behavior as the Antora docs extension use-case:
 * https://docs.antora.org/antora/latest/extend/extension-use-cases/#redirect-from-component-to-latest-version
 *
 * Skip components that already have an empty/`~` (versionless) version.
 */
module.exports.register = function () {
  this.once('contentClassified', ({ contentCatalog }) => {
    contentCatalog.getComponents().forEach((component) => {
      if (component.versions.find((it) => !it.version)) return
      const rel =
        contentCatalog.resolvePage('index.adoc', { component: component.name }) ||
        (component.latest && component.latest.startPage)
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
    })
  })
}
