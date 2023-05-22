const getExportName = (type, params)=>{
  if (type === 'userPoolId'){
    return `adminUiUserpool${params.id}ResourceIdsUserPoolId`
  }
  if (type === 'userPoolClient'){
    return `adminUiUserpool${params.id}ResourceIdsClientId`
  }
  if (type === 'userPoolDomain'){
    return `adminUiUserpool${params.id}ResourceIdsDomain`
  }
  if (type === 'apiGatewayDeploymentStage'){
    return `adminUiGatewayBaseDeploymentStage`
  }
  if (type === 'apiGatewayRestApiId'){
    return `adminUiGatewayRestApiId`
  }
  if (type === 'apiGatewayRootResourcePath'){
    return `adminUGatewayRootResourceId`
  }
  return null;
}

module.exports = {
  getExportName
}
