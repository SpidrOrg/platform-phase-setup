const {Stack, Duration, RemovalPolicy} = require('aws-cdk-lib');
const cloudfront = require("aws-cdk-lib/aws-cloudfront");
const s3 = require("aws-cdk-lib/aws-s3");
const iam = require("aws-cdk-lib/aws-iam");
const cloudfrontOrigins = require("aws-cdk-lib/aws-cloudfront-origins");
const acm = require("aws-cdk-lib/aws-certificatemanager");
const cognito = require("aws-cdk-lib/aws-cognito");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const lambda = require('aws-cdk-lib/aws-lambda');
const {localhostPortMappingByEnv} = require("./pre-requiste-stack");
const apiGatewayResourcesConfig = require("../services/APIGateway/resourceConfig.json");
const path = require("path");
const fs = require("fs");

class ClientOnboardingUiStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const {envName, domainName, preRequisiteStack, adminEmail} = props;

    // Create a S3 Bucket for Admin UI
    const adminUiBucket = new s3.Bucket(this, 'admin-ui-bucket', {
      bucketName: `krny-spi-adminui-${envName}`,
      removalPolicy: RemovalPolicy.RETAIN
    });

    const oia = new cloudfront.OriginAccessIdentity(this, 'cloudfrontS3AdminUiOIA', {
      comment: "Created by CDK"
    });

    adminUiBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        resources: [
          adminUiBucket.arnForObjects("*")
        ],
        actions: ["s3:GetObject"],
        principals: [oia.grantPrincipal]
      })
    );

    const originRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'adminUiCdnDistributionOriginRequestPolicy', {
      originRequestPolicyName: 'adminUiCdnDistributionOriginRequestPolicy',
      comment: 'Admin Ui Bucket Access - Created by CDK',
    });

    const cachePolicy = new cloudfront.CachePolicy(this, 'adminUiCdnDistributionCachePolicy', {
      cachePolicyName: 'adminUiCdnDistributionCachePolicy',
      comment: 'Admin Ui Bucket Access - Created by CDK',
    });
    const certificateArn = preRequisiteStack["sslCertArn"];
    const certificate = acm.Certificate.fromCertificateArn(this, "webappTlsCert", certificateArn);

    const cf = new cloudfront.Distribution(this, `adminUiCdnDistribution`, {
      comment: `Admin Ui - Managed by CDK`,
      defaultRootObject: "index.html",
      httpVersion: cloudfront.HttpVersion.HTTP2,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2016,
      defaultBehavior: {
        origin: new cloudfrontOrigins.S3Origin(adminUiBucket, {
          originAccessIdentity: oia,
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      domainNames: [domainName, `admin.${domainName}`],
      certificate
    });

    // Cognito
    // Cognito user pool
    const userPool = new cognito.UserPool(this, `spi-admin-${envName}-userpool`, {
      userPoolName: `spi-admin-${envName}`,
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: true,
          mutable: true,
        }
      },
      passwordPolicy: {
        minLength: 6,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: false,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
      userInvitation: {
        emailSubject: "ADMIN Kearney's Sensing & Pivot Solution",
        emailBody: `<div style="background-color:#f6f6f6; padding:16px; width: 100%; height: 100%; border:1px solid; font-style:oblique;font-size:21px"><br /> Greetings, <br/><br/> Your account creation process has been initiated, it will get ready soon! <br/><br/> Username: {username} <br /> Temporary password: <span style="color: purple"><b> {####}</b></span> <br/> <br/> Application URL: <b><a href="https://admin.${domainName}">https://admin.${domainName}</b> <br /> <br /> </div>`,
        smsMessage: 'Your username is {username} and temporary password is {####}.',
      }
    });

    const cognitoDomain = `krny-spi-admin-${envName}`;
    // Cognito user pool Domain
    const userPoolDomain = userPool.addDomain(`spi-admin-${envName}-userpool-domain`, {
      cognitoDomain: {
        domainPrefix: `${envName}-${cognitoDomain.replaceAll(" ", "-")}`,
      }
    });

    // Cognito user pool web client
    const POOL_CALLBACK_URL_PUBLIC = `https://admin.${domainName}`;
    const POOL_LOGOUT_URL_PUBLIC = `https://admin.${domainName}`;
    const userPoolClient = new cognito.UserPoolClient(this, `spi-admin-${envName}-userpool-client`, {
      userPool,
      userPoolClientName: "web-client",
      authFlows: {
        custom: true,
        userSrp: true,
      },
      oAuth: {
        callbackUrls: [POOL_CALLBACK_URL_PUBLIC, `http://localhost:${localhostPortMappingByEnv(envName)}`],
        logoutUrls: [POOL_LOGOUT_URL_PUBLIC, `http://localhost:${localhostPortMappingByEnv(envName)}`],
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      refreshTokenValidity: Duration.minutes(60),
      authSessionValidity: Duration.minutes(3),
      accessTokenValidity: Duration.minutes(5),
      idTokenValidity: Duration.minutes(5),
      enableTokenRevocation: true,
      preventUserExistenceErrors: true,
      generateSecret: false,
    });

    // Create Admin User
    const cfnUserPoolUser = new cognito.CfnUserPoolUser(this, `spi-admin-${envName}-userpool-adminuser`, {
      userPoolId: userPool.userPoolId,
      desiredDeliveryMediums: ['EMAIL'],
      forceAliasCreation: false,
      userAttributes: [{
        name: 'email',
        value: `${adminEmail}`,
      }],
      username: `${adminEmail}`
    });

    // Create Admin user pool Group
    const cfnUserPoolGroup = new cognito.CfnUserPoolGroup(this, `spi-admin-${envName}-userpool-admingroup`, {
      userPoolId: userPool.userPoolId,
      description: 'Created by CDK',
      groupName: 'Admin'
    });

    // Attach user to Admin user pool group
    const cfnUserPoolUserToGroupAttachment = new cognito.CfnUserPoolUserToGroupAttachment(this, `spi-admin-${envName}-userpool-adminUserToAdminGroupAttachment`, {
      groupName: cfnUserPoolGroup.groupName,
      username: cfnUserPoolUser.username,
      userPoolId: userPool.userPoolId
    });
    cfnUserPoolUserToGroupAttachment.node.addDependency(cfnUserPoolGroup)
    cfnUserPoolUserToGroupAttachment.node.addDependency(cfnUserPoolUser)

    // API Gateway
    const api = new apigateway.RestApi(this, `krny-spi-admin-${envName}apiGateway`, {
      restApiName: `krny-spi-admin-${envName}`,
      description: 'Created by CDK',
      deployOptions: {
        stageName: envName,
      }
    });

    const pathToLambdaFolder = path.join(__dirname, "../services/lambda");
    const lambdaFolders = fs.readdirSync(pathToLambdaFolder).filter(item => !/(^|\/)\.[^/.]/g.test(item));
    lambdaFolders.forEach(lambdaFolder => {
      if (lambdaFolder.startsWith("co-")){
        const fnArn = lambda.Function.fromFunctionName(lambdaFolder).functionArn; //Fn.importValue(`lambdaARN${lambdaFolder}`);
        new lambda.CfnPermission(this, `krny-spi-admin-${envName}Invoke${lambdaFolder}`, {
          action: 'lambda:InvokeFunction',
          functionName: fnArn,
          principal: 'apigateway.amazonaws.com',
          sourceArn: api.arnForExecuteApi('*')
        });
      }
    });

    // Add Root Resource
    const rootResource = api.root.addResource("adminUi");

    const apiGatewayLambdaAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, `adminUiCogAuthorizer`, {
      cognitoUserPools: [userPool]
    });

    // Add Resources
    Object.keys(apiGatewayResourcesConfig).forEach(resourceName => {
      const resourceConfig = apiGatewayResourcesConfig[resourceName];
      const resource = rootResource.addResource(resourceName);

      Object.keys(resourceConfig).forEach(methodName => {
        const methodConfig = resourceConfig[methodName];
        const integerationConfig = methodConfig.integrationRequest;

        const lambdaArn = lambda.Function.fromFunctionName(integerationConfig.lambda).functionArn;
        const backendLamdba = lambda.Function.fromFunctionArn(this, `adminUibackendLamdba${resourceName}${methodName}`, lambdaArn);

        let lambdaIntegrationConfig = {};
        let methodResponseConfig = {};
        if (integerationConfig.proxy === false){
          lambdaIntegrationConfig = {
            proxy: false,
            requestTemplates: {
              "application/json": JSON.stringify(integerationConfig.mappingTemplate)
            },
            passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
            integrationResponses: [{
              statusCode: "200",
              responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': "'*'",
              }
            }],
          };

          methodResponseConfig = [{
            statusCode: "200",
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
            responseModels: {
              "application/json": apigateway.Model.EMPTY_MODEL
            }
          }]
        } else {
          lambdaIntegrationConfig = {
            proxy: true
          }
          methodResponseConfig = []
        }

        const method = resource.addMethod(
          methodName,
          new apigateway.LambdaIntegration(backendLamdba, lambdaIntegrationConfig),
          {
            authorizer: apiGatewayLambdaAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            methodResponses:methodResponseConfig
          }
        );
      });

      resource.addMethod('OPTIONS', new apigateway.MockIntegration({
        integrationResponses: [{
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,POST'",
          },
        }],
        passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_MATCH,
        requestTemplates: {
          "application/json": "{\"statusCode\": 200}"
        },
      }), {
        methodResponses: [{
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Methods': true,
          },
          responseModels: {
            "application/json": apigateway.Model.EMPTY_MODEL
          }
        }]
      })
      // resource.addCorsPreflight({
      //   allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      //   allowMethods: ['OPTIONS', 'GET', 'POST'],
      //   allowOrigins: apigateway.Cors.ALL_ORIGINS,
      // });
    })
  }
}

module.exports = {ClientOnboardingUiStack}
