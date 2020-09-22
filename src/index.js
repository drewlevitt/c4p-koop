const config = require('config')
const Koop = require('koop')
const routes = require('./routes')
const plugins = require('./plugins')

// initiate a koop app
const koop = new Koop()

// register koop plugins
plugins.forEach((plugin) => {
  koop.register(plugin.instance, plugin.options)
})

// add additional routes
routes.forEach((route) => {
  route.methods.forEach((method) => {
    koop.server[method](route.path, route.handler)
  })
})

// start the server
// This is the original code at line 22
// koop.server.listen(config.port, () => koop.log.info(`Koop server listening at ${config.port}`))

// You can replace the config.port by process.env.PORT
const port = process.env.PORT
koop.server.listen(port, () => koop.log.info(`Koop server listening at ${port}`))
