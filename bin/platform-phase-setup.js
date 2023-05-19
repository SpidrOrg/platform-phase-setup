#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const mainStack = require('../lib/main-stack');

// This
const indexOfAwsAccountInArnSplit = process.env.CODEBUILD_BUILD_ARN.split(":").indexOf(process.env.AWS_REGION) + 1;
const awsAccount = process.env.CODEBUILD_BUILD_ARN.split(":")[indexOfAwsAccountInArnSplit];
const awsRegion = process.env.AWS_REGION;
const codestarConnArn = process.env.MP_GITHUB_CONN_ARN;
const appAwsRepo = process.env.MP_APP_AWS_REPO.split("/");
const envName = process.env.MP_ENV_NAME;
const domainName = process.env.MP_DOMAIN_NAME;
// or this//
// const awsAccount = "319925118739";
// const awsRegion = "us-east-1";

const app = new cdk.App();
new mainStack(app, 'PlatformPhaseSetupStack', {
 env: { account: awsAccount, region: awsRegion },
 envName,
 codestarConnArn,
 appAwsRepo,
 domainName
});
