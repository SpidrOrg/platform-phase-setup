const { exec } = require('node:child_process')
const path = require("path");

// This
// const indexOfAwsAccountInArnSplit = process.env.CODEBUILD_BUILD_ARN.split(":").indexOf(process.env.AWS_REGION) + 1;
// const awsAccount = process.env.CODEBUILD_BUILD_ARN.split(":")[indexOfAwsAccountInArnSplit];
// const awsRegion = process.env.AWS_REGION;
// or this//
const awsAccount = "319925118739";
const awsRegion = "us-east-1";


const repositoryName = "terraform-dependencies";
exec(`aws ecr create-repository --repository-name ${repositoryName}`, (err, output)=> {
  if (err) {
    console.log(`Failed to create ECR repository ${repositoryName}`, err);
    return
  }
  console.log("Successfully created Repository")
  const repoLink = "https://github-connection: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@github.com/xi3768-akumar/terraform-dependencies-aws-code-pipeline.git";
  exec(`git clone ${repoLink}`, (err1, output1)=>{
    if (err1){
      console.log("Error in cloning repository");
      return
    }
    console.log("Successfully cloned repository", output1);
    exec(`cd terraform-dependencies-aws-code-pipeline && aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${awsAccount}.dkr.ecr.us-east-1.amazonaws.com && docker build -t terraform-dependencies . && docker tag terraform-dependencies:latest ${awsAccount}.dkr.ecr.us-east-1.amazonaws.com/terraform-dependencies:latest && docker push ${awsAccount}.dkr.ecr.us-east-1.amazonaws.com/terraform-dependencies:latest`, (error1, out1)=>{
      if (error1){
        console.log("Error executing commands", error1);
        return
      }
      console.log("Successfully executed commands")
    })
  })
})


