const { exec } = require('node:child_process')
const path = require("path");

// This
// const indexOfAwsAccountInArnSplit = process.env.CODEBUILD_BUILD_ARN.split(":").indexOf(process.env.AWS_REGION) + 1;
// const awsAccount = process.env.CODEBUILD_BUILD_ARN.split(":")[indexOfAwsAccountInArnSplit];
// const awsRegion = process.env.AWS_REGION;
// or this//
const awsAccount = "226772227397";
const awsRegion = "us-east-1";

// Clone Repo
const codeRepoToken = "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" //process.env.MP_CODE_REPOS_TOKEN;

exec(`git clone https://${codeRepoToken}@github.com/SpidrOrg/client-onboarding.git`, (error, output)=>{
  if (error){
    console.log("Failed to clone client onboarding UI codebase", error);
    return;
  }
  console.log("Successfully cloned client onboarding UI codebase", output);

  // Run npm run build inside codebase
  exec(`cd client-onboarding && npm ci && npm run build`, (error1, output1)=>{
    if (error1){
      console.log("Error create build from Client Onboarding codebase", error1);
      return;
    }
    console.log("Successfully ran build on Client Onboarding codebase", output1);

    // Create directory Services and copy infra contents from cloned repo
    exec(`mkdir services && mkdir services/adminUi && cp -r client-onboarding/infra/ services/ && cp -r client-onboarding/dist/ services/adminUi/`, (error11, output11)=>{
      if (error11){
        console.log("Error ", error11);
        console.log("Error with pre-setup");
        return
      }
      console.log("All setup completed successfully with pre-setup")
    })
  })
})

