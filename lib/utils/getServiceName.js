const MODULE_PREFIX = "";
const PREFIX = 'krny';
const PREFIX1 = 'spi'

function _addModulePrefix(val){
  return `${MODULE_PREFIX ? `${MODULE_PREFIX}-`: ''}${val}`
}

function getAdminUiBucketName(env){
  return _addModulePrefix(`${PREFIX}-${PREFIX1}-adminui-${env}`)
}

module.exports = {
  getAdminUiBucketName
}
