import pify from 'pify'
import PQueue from 'p-queue'
import { loadModule } from './utils/load-module'

// This queue makes sure node-sass leaves one thread available for executing fs tasks
// See: https://github.com/sass/node-sass/issues/857
const threadPoolSize = process.env.UV_THREADPOOL_SIZE || 4
const workQueue = new PQueue({ concurrency: threadPoolSize - 1 })

// List of supported SASS modules in the order of preference
const sassModuleIds = ['node-sass', 'sass']

/* eslint import/no-anonymous-default-export: [2, {"allowObject": true}] */
export default {
  name: 'sass',
  test: /\.(sass|scss)$/,
  process({ code }) {
    return new Promise((resolve, reject) => {
      const sass = loadSassOrThrow()
      const render = pify(sass.render.bind(sass))
      const data = this.options.data || ''
      workQueue.add(() =>
        render({
          ...this.options,
          file: this.id,
          data: data + code,
          indentedSyntax: /\.sass$/.test(this.id),
          sourceMap: this.sourceMap,
          importer: this.options.importer || []
        })
          .then(result => {
            for (const file of result.stats.includedFiles) {
              this.dependencies.add(file)
            }

            resolve({
              code: result.css.toString(),
              map: result.map && result.map.toString()
            })
          })
          .catch(reject)
      )
    })
  }
}

function loadSassOrThrow() {
  // Loading one of the supported modules
  for (const moduleId of sassModuleIds) {
    const module = loadModule(moduleId)
    if (module) {
      return module
    }
  }

  // Throwing exception if module can't be loaded
  throw new Error(
    'You need to install one of the following packages: ' +
      sassModuleIds.map(moduleId => `"${moduleId}"`).join(', ') +
      ' ' +
      'in order to process SASS files'
  )
}
