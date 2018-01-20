import cmsBuild from '@panaceajs/cms/build/build'
import path from 'path'
import chokidar from 'chokidar'
import _ from 'lodash'
import glob from 'glob'

process.env.DEBUG = process.env.DEBUG || 'build:*'
const debug = require('debug')('build:cms')
debug.color = 3 // Force yellow color

/**
 * Build Panacea CMS with live reload.
 */
export default (function () {
  const panaceaConfigFile = path.resolve('./panacea.js')
  const panaceaCmsDirs = glob
    .sync(path.resolve(process.cwd(), 'node_modules/@panaceajs/cms') + '/*')
    .filter(dir => path.basename(dir) !== 'node_modules')

  const applicationCmsDir = `${process.cwd()}/cms`

  // Error handler
  const onError = (err, instance) => {
    debug('Error while reloading [nuxt.config.js]', err)
    return Promise.resolve(instance) // Wait for next reload
  }

  const startDev = oldInstance => {
    let instance
    let builder
    let nuxt

    try {
      // Get build objects.
      const cmsBuildInstance = cmsBuild({
        dev: true
      })

      nuxt = cmsBuildInstance.nuxt
      builder = cmsBuildInstance.builder

      instance = {
        nuxt,
        builder
      }
    } catch (err) {
      return onError(err, instance || oldInstance)
    }

    const port = parseInt(process.env.APP_SERVE_PORT) + 1
    const host = process.env.APP_SERVE_HOST

    return Promise.resolve()
      .then(
      () =>
        oldInstance && oldInstance.builder
          ? oldInstance.builder.unwatch()
          : Promise.resolve()
      )
      .then(() => builder.build()) // 1- Start build
      .then(
      () =>
        oldInstance && oldInstance.nuxt
          ? oldInstance.nuxt.close()
          : Promise.resolve()
      ) // 2- Close old nuxt after successful build
      .then(() => nuxt.listen(port, host)) // 3- Start listening
      .then(() => instance) // 4- Pass new nuxt to watch chain
      .catch(err => onError(err, instance))
  }

  // Start dev
  let dev = startDev()

  // Start watching for panacea.js and nuxt.config.js changes
  chokidar
    .watch([panaceaConfigFile, ...panaceaCmsDirs, applicationCmsDir], {
      ignoreInitial: true,
      ignored: /(^|[/\\])\../
    })
    .on(
    'all',
    _.debounce((event, file) => {
      console.log(`${file} changed`)
      console.log('Rebuilding the app...')
      dev = dev.then(startDev)
    }),
    0
    )
})()
