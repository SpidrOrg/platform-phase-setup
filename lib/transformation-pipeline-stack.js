const getAWSAccountAndRegion = require("../getAWSAccountAndRegion.js");
const {Stack, Duration} = require('aws-cdk-lib');
const {LinuxBuildImage, ComputeType, BuildSpec} = require("aws-cdk-lib/aws-codebuild")
const codepipeline = require("aws-cdk-lib/aws-codepipeline");
const codePipelineAction = require("aws-cdk-lib/aws-codepipeline-actions");
const codeBuild = require("aws-cdk-lib/aws-codebuild");
const iam = require("aws-cdk-lib/aws-iam");

class TransformationPipelineStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const appAwsRepo = process.env.TRANSFORMATION_AWS_REPO.split("/");
    const codestarConnArn = process.env.GITHUB_CONN_ARN;

    const {envName} = props;

    // Create IAM Role
    const pipelineRole = new iam.Role(this, 'transformationCodepipelineRole', {
      roleName: "cdk-transformation-codepipeline-role",
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
      description: '',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AdministratorAccess',
        )
      ],
    });
    const codebuildTransformationProjectRole = new iam.Role(this, 'transformationCodebuildrole', {
      roleName: "cdk-transformation-codebuild-role",
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      description: '',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AdministratorAccess',
        )
      ],
    });

    const buildImage = LinuxBuildImage.STANDARD_4_0;

    const transformationPipeline = new codepipeline.Pipeline(this, 'TransformationPipeline', {
      pipelineName: "transformation",
      role: pipelineRole
    });

    const transformationCodeBuildProject = new codeBuild.PipelineProject(this, "transformationCodebuildProject", {
      buildSpec: BuildSpec.fromSourceFilename(`buildspec/buildspec-${envName}.yaml`),
      environment: {
        buildImage: buildImage,
        privileged: true
      },
      role: codebuildTransformationProjectRole
    });

    const transformationSourceOutputArtificat = new codepipeline.Artifact();
    transformationPipeline.addStage({
      stageName: 'Source',
      actions: [
        new codePipelineAction.CodeStarConnectionsSourceAction({
          actionName: "GitHub_Source",
          owner: appAwsRepo[0],
          repo: appAwsRepo[1],
          branch: appAwsRepo[2],
          output: transformationSourceOutputArtificat,
          connectionArn: codestarConnArn,
          variablesNamespace: 'MyNamespace',
        })
      ]
    });

    transformationPipeline.addStage({
      stageName: 'TransformationBuild',
      actions: [
        new codePipelineAction.CodeBuildAction({
          actionName: "TransformationBuildJob",
          project: transformationCodeBuildProject,
          input: transformationSourceOutputArtificat,
        })
      ]
    });
  }
}

module.exports = {TransformationPipelineStack}
