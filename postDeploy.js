const path = require("path");
const fs = require("fs");
const { exec } = require('node:child_process');
const {getAdminUiBucketName} = require("./lib/utils/getServiceName");
const stackExports = require("./stackexports.json");
const {getExportName} = require("./lib/utils/stackExportsName");

const indexOfAwsAccountInArnSplit = process.env.CODEBUILD_BUILD_ARN.split(":").indexOf(process.env.AWS_REGION) + 1;
const awsAccount = process.env.CODEBUILD_BUILD_ARN.split(":")[indexOfAwsAccountInArnSplit];
const awsRegion = process.env.AWS_REGION;
const envName = process.env.MP_ENV_NAME;
const domainName = process.env.MP_DOMAIN_NAME;
const adminHostName = "snpadmin";

let postDeployContents = fs.readFileSync("./lakePermissionTemplate.json", "utf-8");
postDeployContents = postDeployContents.replaceAll(":123456789012:", awsAccount);
fs.writeFileSync("./lakePermission.json", postDeployContents)

exec(`aws lakeformation put-data-lake-settings --cli-input-json file://lakePermission.json`, (err, output) => {
  if (err){
    console.log("Failed to updated lakeformation permissions", err);
  } else {
    console.log("Updated lakeformation permissions", output)
  }
});

const adminUiS3BucketName = getAdminUiBucketName(envName);

exec(`aws s3api head-object --bucket ${adminUiS3BucketName} --key admin_ui/index.html`, (error, exists)=>{
  if (!exists){
    // Use IDP Config template to generate right idp config and replace idpConfig.js in adminUi bundle
    let idpConfigTemplateContents = fs.readFileSync("./adminUiIdpConfigTemplate.js", "utf-8");

    const cognitoStackExportsStartKey = 'PlatformPhaseSetupStackClientOnboardingUiStack';
    const cognitoStackExportsKey = Object.keys(stackExports).filter(k => k.startsWith(cognitoStackExportsStartKey));
    const cognitoExports = stackExports[cognitoStackExportsKey];

    const apiGatewayStackExportsStartKey = 'PlatformPhaseSetupStackClientOnboardingUiStack';
    const apiGatewayStackExportsKey = Object.keys(stackExports).filter(k => k.startsWith(apiGatewayStackExportsStartKey));
    const apiGatewayExports = stackExports[apiGatewayStackExportsKey];

    const clientUserPoolID = cognitoExports[`Export${getExportName('userPoolId', {id: `spiadmin${envName}`})}`];
    const clientUserPoolWebClientId = cognitoExports[`Export${getExportName('userPoolClient', {id: `spiadmin${envName}`})}`];
    idpConfigTemplateContents = idpConfigTemplateContents.replace(/(.*)userPoolId:.*/, `$1userPoolId: "${clientUserPoolID}",`);
    idpConfigTemplateContents = idpConfigTemplateContents.replace(/(.*)userPoolWebClientId:.*/, `$1userPoolWebClientId: "${clientUserPoolWebClientId}",`);

    const oauthDomainFQDN = `${cognitoExports[`Export${getExportName('userPoolDomain', {id: `spiadmin${envName}`})}`]}.auth.us-east-1.amazoncognito.com`;
    idpConfigTemplateContents = idpConfigTemplateContents.replace(/(.*)oauthDomain:.*/, `$1oauthDomain: "${oauthDomainFQDN}",`);

    const clientWebAppFQDN = `https://${adminHostName}.${domainName}`;
    idpConfigTemplateContents = idpConfigTemplateContents.replace(/(.*)redirectSignIn:.*/, `$1redirectSignIn: "${clientWebAppFQDN}",`);
    idpConfigTemplateContents = idpConfigTemplateContents.replace(/(.*)redirectSignOut:.*/, `$1redirectSignOut: "${clientWebAppFQDN}",`);

    const gatewayRestApiId = apiGatewayExports[`Export${getExportName('apiGatewayRestApiId')}`];
    const gatewayStageName = apiGatewayExports[`Export${getExportName('apiGatewayDeploymentStage')}`];
    const clientApiRootResourcePath = apiGatewayExports[`Export${getExportName('apiGatewayRootResourcePath')}`];
    const apiPrefix = `${gatewayRestApiId}.execute-api.${awsRegion}.amazonaws.com`;
    const stageRootResourcePath = `${gatewayStageName}${clientApiRootResourcePath}`;
    idpConfigTemplateContents = idpConfigTemplateContents.replace(/(.*)apiPrefix:.*/, `$1apiPrefix: "${apiPrefix}",`);
    idpConfigTemplateContents = idpConfigTemplateContents.replace(/(.*)stage:.*/, `$1stage: "${stageRootResourcePath}",`);

    const pathToAdminUiBundle = "./services/adminUi"
    fs.writeFileSync(`${pathToAdminUiBundle}/idpConfig.js`, idpConfigTemplateContents);

    exec(`aws s3 cp ${pathToAdminUiBundle} s3://${adminUiS3BucketName}/admin_ui --recursive`, (err, output) => {
      if (err) {
        console.error("could not execute command: ", err)
        return
      }
      console.log("Output: \n", output)
    });
  }
})
