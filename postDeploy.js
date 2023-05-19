const path = require("path");
const fs = require("fs");
const { exec } = require('node:child_process');

const indexOfAwsAccountInArnSplit = process.env.CODEBUILD_BUILD_ARN.split(":").indexOf(process.env.AWS_REGION) + 1;
const awsAccount = process.env.CODEBUILD_BUILD_ARN.split(":")[indexOfAwsAccountInArnSplit];

let postDeployContents = fs.readFileSync("./lakePermissionTemplate.json", "utf-8");
postDeployContents = postDeployContents.replaceAll(":123456789012:", awsAccount);
fs.writeFileSync("./lakePermission.json", postDeployContents)

exec(`aws lakeformation put-data-lake-settings --cli-input-json file://lakePermission.json`, (err, output) => {
  if (err){
    console.log("Failed to updated lakeformation permissions", err);
  } else {
    console.log("Updated lakeformation permissions", output)
  }
})
