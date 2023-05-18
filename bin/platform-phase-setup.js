#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const mainStack = require('../lib/main-stack');
const accountConfig = require("../accountConfig.json");

// This
const indexOfAwsAccountInArnSplit = process.env.CODEBUILD_BUILD_ARN.split(":").indexOf(process.env.AWS_REGION) + 1;
const awsAccount = process.env.CODEBUILD_BUILD_ARN.split(":")[indexOfAwsAccountInArnSplit];
const awsRegion = process.env.AWS_REGION;
// or this//
// const awsAccount = "319925118739";
// const awsRegion = "us-east-1";

const app = new cdk.App();
new mainStack(app, 'PlatformPhaseSetupStack', {
 env: { account: awsAccount, region: awsRegion },
 ...accountConfig[awsAccount][awsRegion]
});
