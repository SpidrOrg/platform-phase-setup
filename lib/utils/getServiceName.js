const MODULE_PREFIX = "";
const PREFIX = 'krny';
const PREFIX1 = 'spi'

const indexOfAwsAccountInArnSplit = process.env.CODEBUILD_BUILD_ARN.split(":").indexOf(process.env.AWS_REGION) + 1;
const awsAccount = process.env.CODEBUILD_BUILD_ARN.split(":")[indexOfAwsAccountInArnSplit];

function _addModulePrefix(val){
  return `${MODULE_PREFIX ? `${MODULE_PREFIX}-`: ''}${val}`
}

function getAdminUiBucketName(env){
  return _addModulePrefix(`${PREFIX}-${PREFIX1}-adminui-${env}-${awsAccount}`)
}

module.exports = {
  getAdminUiBucketName
}
