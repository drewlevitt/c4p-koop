const koopProviderCsv = require('./koop-provider-csv/initialize')();
const outputs = [];
const auths = [];
const caches = [];
const plugins = [koopProviderCsv];
module.exports = [...outputs, ...auths, ...caches, ...plugins];