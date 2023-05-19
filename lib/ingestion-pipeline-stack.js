const getAWSAccountAndRegion = require("../getAWSAccountAndRegion.js");
const {Stack, Duration} = require('aws-cdk-lib');
const {LinuxBuildImage, ComputeType, BuildSpec} = require("aws-cdk-lib/aws-codebuild")
const codepipeline = require("aws-cdk-lib/aws-codepipeline");
const codePipelineAction = require("aws-cdk-lib/aws-codepipeline-actions");
const codeBuild = require("aws-cdk-lib/aws-codebuild");
const ecr = require("aws-cdk-lib/aws-ecr")
const iam = require("aws-cdk-lib/aws-iam");

class IngestionPipelineStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const {envName, ingestionAwsRepo, codestarConnArn} = props;

    // Create IAM Role
    const pipelineRole = new iam.Role(this, 'ingestionCodepipelineRole', {
      roleName: "cdk-ingestion-codepipeline-role",
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
      description: '',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AdministratorAccess',
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AWSLakeFormationDataAdmin',
        ),
      ],
    });
    const codebuildIngestionProjectRole = new iam.Role(this, 'ingestionCodebuildrole', {
      roleName: "cdk-ingestion-codebuild-role",
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      description: '',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AdministratorAccess',
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AWSLakeFormationDataAdmin',
        ),
      ],
    });

    const buildImage = LinuxBuildImage.STANDARD_4_0;

    const ingestionPipeline = new codepipeline.Pipeline(this, 'IngestionPipeline', {
      pipelineName: "ingestion",
      role: pipelineRole
    });

    const ingestionCodeBuildProject = new codeBuild.PipelineProject(this, "ingestionCodebuildProject", {
      buildSpec: BuildSpec.fromSourceFilename(`buildspec/buildspec-${envName}.yml`),
      environment: {
        buildImage: buildImage,
        privileged: true
      },
      environmentVariables: {
        ENV_NAME: {
          value: envName
        }
      },
      role: codebuildIngestionProjectRole
    });

    const ingestionSourceOutputArtificat = new codepipeline.Artifact();
    ingestionPipeline.addStage({
      stageName: 'Source',
      actions: [
        new codePipelineAction.CodeStarConnectionsSourceAction({
          actionName: "GitHub_Source",
          owner: ingestionAwsRepo[0],
          repo: ingestionAwsRepo[1],
          branch: ingestionAwsRepo[2],
          output: ingestionSourceOutputArtificat,
          connectionArn: codestarConnArn,
          variablesNamespace: 'MyNamespace',
        })
      ]
    });

    ingestionPipeline.addStage({
      stageName: 'IngestionBuild',
      actions: [
        new codePipelineAction.CodeBuildAction({
          actionName: "IngestionBuildJob",
          project: ingestionCodeBuildProject,
          input: ingestionSourceOutputArtificat,
        })
      ]
    });
  }
}

module.exports = {IngestionPipelineStack}
