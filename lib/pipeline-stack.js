const getAWSAccountAndRegion = require("../getAWSAccountAndRegion.js");
const {Stack, Duration} = require('aws-cdk-lib');
const {LinuxBuildImage, ComputeType, BuildSpec} = require("aws-cdk-lib/aws-codebuild")
const codepipeline = require("aws-cdk-lib/aws-codepipeline");
const codePipelineAction = require("aws-cdk-lib/aws-codepipeline-actions");
const codeBuild = require("aws-cdk-lib/aws-codebuild");
const ecr = require("aws-cdk-lib/aws-ecr")
const iam = require("aws-cdk-lib/aws-iam");

class PipelineStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const {preRequisiteStack, platformTfRepo, codestarConnArn, envName} = props;
    // Create IAM Role
    const pipelineRole = new iam.Role(this, 'codepipelineRole', {
      roleName: "cdk-codepipeline-role",
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
      description: '',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AdministratorAccess',
        ),
      ],
    });
    const codebuildProjectRole = new iam.Role(this, 'codebuildrole', {
      roleName: "cdk-codebuild-role",
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      description: '',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AdministratorAccess',
        ),
      ],
    });

    const buildImage = LinuxBuildImage.fromEcrRepository(ecr.Repository.fromRepositoryName(this, 'terraform-dependencies', 'terraform-dependencies'))

    const pipeline = new codepipeline.Pipeline(this, 'PlatformPipeline', {
      pipelineName: "platformPipeline",
      role: pipelineRole
    });
    const sourceOutput = new codepipeline.Artifact();

    const codeBuildValidateProject = new codeBuild.PipelineProject(this, "CodebuildValidateProject", {
      buildSpec: BuildSpec.fromSourceFilename("buildspec/terragruntplan-stage.yml"),
      environment: {
        buildImage: buildImage,
        computeType: ComputeType.LARGE,
        privileged: true
      },
      environmentVariables: {
        TERRAFORM_STATEFILE_BUCKET: {
          value: preRequisiteStack["terraformStateFileS3Bucket"],
        },
        TERRAFORM_STATELOCK_DD_TABLE: {
          value: preRequisiteStack["terraformStateLockDDTable"],
        },
        ENV_NAME: {
          value: envName
        }
      },
      role: codebuildProjectRole
    })
    const codeBuildDeployProject = new codeBuild.PipelineProject(this, "CodebuildDeployProject", {
      buildSpec: BuildSpec.fromSourceFilename("buildspec/terragruntapply-stage.yml"),
      environment: {
        buildImage: buildImage,
        computeType: ComputeType.LARGE,
        privileged: true
      },
      environmentVariables: {
        TERRAFORM_STATEFILE_BUCKET: {
          value: preRequisiteStack["terraformStateFileS3Bucket"],
        },
        TERRAFORM_STATELOCK_DD_TABLE: {
          value: preRequisiteStack["terraformStateLockDDTable"],
        },
        ENV_NAME: {
          value: envName
        }
      },
      role: codebuildProjectRole
    })

    const sourceStage = pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codePipelineAction.CodeStarConnectionsSourceAction({
          actionName: "GitHub_Source",
          owner: platformTfRepo[0],//'xi3768-akumar',
          repo: platformTfRepo[1], //'krny-xebia',
          branch: platformTfRepo[2], //"main",
          output: sourceOutput,
          connectionArn: codestarConnArn, //'arn:aws:codestar-connections:ap-southeast-2:319925118739:connection/48c1c827-b35e-4056-b185-9ef4c51bd197',
          variablesNamespace: 'MyNamespace',
        })
      ]
    });

    const codebuildValidateStage = pipeline.addStage({
      stageName: 'terragrunt_validate',
      actions: [
        new codePipelineAction.CodeBuildAction({
          actionName: "terragrunt_validate_job",
          project: codeBuildValidateProject,
          input: sourceOutput,
        })
      ]
    });

    const codebuildDeployStage = pipeline.addStage({
      stageName: 'terragrunt_deploy',
      actions: [
        new codePipelineAction.CodeBuildAction({
          actionName: "terragrunt_deploy_job",
          project: codeBuildDeployProject,
          input: sourceOutput,
        })
      ]
    });


  }
}

module.exports = {PipelineStack}

// const route53HostedZoneConfig = require("../values/route53HostedZoneNSConfig.json");
// const getAWSAccountAndRegion = require("../getAWSAccountAndRegion.js");
// const {Stack, Duration} = require('aws-cdk-lib');
// const {CodePipeline, CodePipelineSource, CodeBuildStep} = require("aws-cdk-lib/pipelines")
// const {LinuxBuildImage, ComputeType, BuildSpec} = require("aws-cdk-lib/aws-codebuild")
//
// const ecr = require("aws-cdk-lib/aws-ecr")
//
//
// class PipelineStack extends Stack {
//   constructor(scope, id, props) {
//     super(scope, id, props);
//     const {awsAccount, awsRegion} = getAWSAccountAndRegion();
//
//     const buildImage = LinuxBuildImage.fromEcrRepository(ecr.Repository.fromRepositoryName(this, 'terraform-dependencies', 'terraform-dependencies'))
//     const pipeline = new CodePipeline(this, 'Pipeline', {
//       pipelineName: 'WorkshopPipeline',
//       selfMutation: false,
//       synth: new CodeBuildStep('SynthStep', {
//         input: CodePipelineSource.connection('xi3768-akumar/krny-xebia', 'main', {
//           connectionArn: 'arn:aws:codestar-connections:ap-southeast-2:319925118739:connection/48c1c827-b35e-4056-b185-9ef4c51bd197', // Created using the AWS console * });',
//         }),
//         commands: [],
//         installCommands: [],
//         buildEnvironment: {
//           buildImage: buildImage,
//           computeType: ComputeType.LARGE,
//           privileged: true
//         }
//       })
//     });
//
//   }
// }
//
// module.exports = {PipelineStack}
