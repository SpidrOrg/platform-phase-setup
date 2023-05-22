const {Stack, Duration} = require('aws-cdk-lib');
const route53 = require("aws-cdk-lib/aws-route53");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const iam = require("aws-cdk-lib/aws-iam");
const lambda = require("aws-cdk-lib/aws-lambda");
const cr = require('aws-cdk-lib/custom-resources');
const acm = require('aws-cdk-lib/aws-certificatemanager');
const ssm = require('aws-cdk-lib/aws-ssm');
const {DynamoEventSource} = require("aws-cdk-lib/aws-lambda-event-sources")
const constants = require("./constants");
const path = require("path");
const fs = require("fs");

const localhostPortMappingByEnv = (env)=>{
  switch (env){
    case constants.ENV.DEV:
      return 3000
    case constants.ENV.QA:
      return 3001
    case constants.ENV.UAT:
      return 3011
    case constants.ENV.STAGE:
      return 3010
    case constants.ENV.PROD:
      return 3111
    default:
      return 3000
  }
}

class PreRequisiteStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);
    this.stackExports = {};

    const {env, domainName, envName} = props;
    const awsAccount = env.account;

    const hostedZone = new route53.PublicHostedZone(this, `HostedZone${domainName.replaceAll(".", "_")}`, {
      zoneName: domainName,
    });
    // Object.keys(route53NSCofnig).forEach((recordName)=>{
    //   const recordValues = route53NSCofnig[recordName];
    //   new route53.NsRecord(this, `NSRecord-${domainName.replaceAll(".", "_")}${recordName}`, {
    //     zone: hostedZone,
    //     recordName: `${recordName}`,
    //     values: recordValues
    //   });
    // });
    const cert = new acm.Certificate(this, `Certificate${domainName.replaceAll(".", "_")}`, {
      domainName: domainName,
      subjectAlternativeNames: [`*.${domainName}`],
      validation: acm.CertificateValidation.fromDnsMultiZone({
        [`${domainName}`]: hostedZone,
        [`*.${domainName}`]: hostedZone
      }),
    });
    this.stackExports["sslCertArn"] = cert.certificateArn;
    new ssm.StringParameter(this, 'certificateArnSSMParameter', {
      parameterName: `certificateArn`,
      stringValue: cert.certificateArn
    });
    new ssm.StringParameter(this, 'domainNameSSMParameter', {
      parameterName: `domainName`,
      stringValue: domainName
    });
    new ssm.StringParameter(this, 'envAppNameSSMParameter', {
      parameterName: `envNameApp`,
      stringValue: envName
    });
    new ssm.StringParameter(this, 'envLocalHostPortMappingSSMParameter', {
      parameterName: `envLocalHostPortMapping`,
      stringValue: localhostPortMappingByEnv(envName)
    });
    // Create IAM Roles
    //// Create all Policies
    const pathToPoliciesFolder = path.join(__dirname, "../services/IAM/policies");
    const policiesFolders = fs.readdirSync(pathToPoliciesFolder).filter(item => !/(^|\/)\.[^/.]/g.test(item));

    const policiesP = {};
    policiesFolders.forEach(policyFolder => {
      let policy = fs.readFileSync(path.join(pathToPoliciesFolder, policyFolder, "policy.json"), "utf-8");
      policy = policy.replaceAll(constants.ACCOUNT_ID_PALCEHOLDER, `:${awsAccount}:`)
      const policyP = JSON.parse(policy);

      const statements = policyP['Statement'];
      const statementsP = statements.map(statement => {
        return new iam.PolicyStatement({
          effect: statement.Effect,
          actions: statement.Action instanceof Array ? statement.Action : [statement.Action],
          resources: statement.Resource instanceof Array ? statement.Resource : [statement.Resource]
        })
      })

      policiesP[policyFolder] = new iam.ManagedPolicy(this, `${policyFolder}`, {
        managedPolicyName: policyFolder,
        statements: statementsP,
      });
    });

    // //// Create all Roles
    const pathToRolesFolder = path.join(__dirname, "../services/IAM/roles");
    const rolesFolders = fs.readdirSync(pathToRolesFolder).filter(item => !/(^|\/)\.[^/.]/g.test(item));
    const allRoles = {};
    rolesFolders.forEach(roleFolder=>{
      let roleText =  fs.readFileSync(path.join(pathToRolesFolder, roleFolder, "config.json"), "utf-8");
      roleText = roleText.replaceAll(constants.ACCOUNT_ID_PALCEHOLDER, `:${awsAccount}:`);

      const roleP = JSON.parse(roleText);

      const iamRole = new iam.Role(this, `${roleFolder}`, {
        roleName: roleFolder,
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        description: roleP.description ?? '',
        managedPolicies: roleP.policies.map(n => iam.ManagedPolicy.fromManagedPolicyName(this, `${roleFolder}-${n}`, n))
      });

      allRoles[roleFolder] = iamRole;

      Object.keys(policiesP).forEach(policyName => {
        const policy = policiesP[policyName];
        iamRole.node.addDependency(policy);
      });
    })

    rolesFolders.forEach(roleFolder=> {
      let roleText = fs.readFileSync(path.join(pathToRolesFolder, roleFolder, "config.json"), "utf-8");
      roleText = roleText.replaceAll(constants.ACCOUNT_ID_PALCEHOLDER, `:${awsAccount}:`);

      const roleP = JSON.parse(roleText);

      const iamRole = allRoles[roleFolder];
      const customResource = new cr.AwsCustomResource(this, `ModifyTrustPolicy${roleFolder}`, {
        onCreate: {
          service: 'IAM',
          action: 'updateAssumeRolePolicy',
          parameters: {
            RoleName: iamRole.roleName,
            PolicyDocument: JSON.stringify(roleP.trustRelationship)
          },
          physicalResourceId: cr.PhysicalResourceId.of(`ModifyTrustPolicy${roleFolder}`)
        },
        policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
          resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE
        })
      });

      Object.keys(allRoles).forEach(roleFolder => {
        customResource.node.addDependency(allRoles[roleFolder]);
      })
    })

    // Read all folders in services/lambda/code directory
    const pathToLambdaFolder = path.join(__dirname, "../services/lambda");
    const lambdaFolders = fs.readdirSync(pathToLambdaFolder).filter(item => !/(^|\/)\.[^/.]/g.test(item));
    const lambdaFunctionByName = {};
    lambdaFolders.forEach(lambdaFolder => {
      let configFile = fs.readFileSync(path.join(pathToLambdaFolder, lambdaFolder, 'configuration.json'), 'utf-8');
      configFile = configFile.replaceAll(constants.ACCOUNT_ID_PALCEHOLDER, env.account)
      const config = JSON.parse(configFile);

      // const lambdaRoleName = Fn.importValue(`iamRoleRef${config.configuration.iamRole}`);
      const lambdaRoleName = config.configuration.iamRole;

      const fn = new lambda.Function(this, `${lambdaFolder}`, {
        functionName: `${lambdaFolder}`,
        runtime: lambda.Runtime[config.runtime],
        architecture: lambda.Architecture[config.architecture],
        handler: config.handler ?? 'index.handler',
        code: lambda.Code.fromAsset(path.join(pathToLambdaFolder, lambdaFolder, "code")),
        role: iam.Role.fromRoleName(this, `prelambdaRole${lambdaFolder}`, lambdaRoleName),
        environment: config.environment,
        timeout: Duration.seconds(config.configuration.timeout),
      });
      Object.keys(allRoles).forEach(roleFolder => {
        fn.node.addDependency(allRoles[roleFolder]);
      });

      lambdaFunctionByName[lambdaFolder] = fn;
    })


    const tenantDyanamoDbstreamHandlerLambdaName = "client-onboarding-dyanmodb-stream-triggerd";
    const tenantDyanamoDbstreamHandlerLambda = lambdaFunctionByName[tenantDyanamoDbstreamHandlerLambdaName];
    const table = new dynamodb.Table(this, 'sensing-solution-tenant-table', {
      tableName: "sensing-solution-tenant",
      partitionKey: {name: 'id', type: dynamodb.AttributeType.NUMBER},
      readCapacity: 1,
      writeCapacity: 1,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
    });
    table.addGlobalSecondaryIndex({
      indexName: 'host-index',
      partitionKey: {
        name: 'host',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ["id"]
    });
    table.node.addDependency(tenantDyanamoDbstreamHandlerLambda)

    tenantDyanamoDbstreamHandlerLambda.addEventSource(
      new DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.LATEST,
      })
    );
  }
}

module.exports = {PreRequisiteStack, localhostPortMappingByEnv}
