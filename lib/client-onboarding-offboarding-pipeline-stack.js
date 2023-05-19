const {Stack, Duration} = require('aws-cdk-lib');
const {LinuxBuildImage, BuildSpec} = require("aws-cdk-lib/aws-codebuild")
const codepipeline = require("aws-cdk-lib/aws-codepipeline");
const codePipelineAction = require("aws-cdk-lib/aws-codepipeline-actions");
const codeBuild = require("aws-cdk-lib/aws-codebuild");
const ecr = require("aws-cdk-lib/aws-ecr")
const iam = require("aws-cdk-lib/aws-iam");

class ClientOnboardingOffboardingPipelineStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const {appAwsRepo, codestarConnArn} = props;
    // Create IAM Role
    const pipelineRole = new iam.Role(this, 'clientOnbaordingOffboardingCodepipelineRole', {
      roleName: "cdk-client-onboarding-offboarding-codepipeline-role",
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
    const codebuildOnboardingProjectRole = new iam.Role(this, 'clientOnbaordingCodebuildrole', {
      roleName: "cdk-client-onboarding-codebuild-role",
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
    const codebuildOffboardingProjectRole = new iam.Role(this, 'clientOffbaordingCodebuildrole', {
      roleName: "cdk-client-offboarding-codebuild-role",
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

    const buildImage = LinuxBuildImage.AMAZON_LINUX_2_4;

    const onboardingPipeline = new codepipeline.Pipeline(this, 'ClientOnboardingPipeline', {
      pipelineName: "client-onboarding",
      role: pipelineRole
    });
    const offboardingPipeline = new codepipeline.Pipeline(this, 'ClientOffboardingPipeline', {
      pipelineName: "client-offboarding",
      role: pipelineRole
    });

    const onboardingCodeBuildProject = new codeBuild.PipelineProject(this, "onboardingCodebuildProject", {
      buildSpec: BuildSpec.fromSourceFilename("buildspec.yaml"),
      environment: {
        buildImage: buildImage,
        privileged: true
      },
      role: codebuildOnboardingProjectRole
    });
    const offboardingCodeBuildProject = new codeBuild.PipelineProject(this, "offboardingCodebuildProject", {
      buildSpec: BuildSpec.fromSourceFilename("buildspec_offboard.yaml"),
      environment: {
        buildImage: buildImage,
        privileged: true
      },
      role: codebuildOffboardingProjectRole
    });

    const clientOnbaordingSourceOutputArtificat = new codepipeline.Artifact();
    onboardingPipeline.addStage({
      stageName: 'Source',
      actions: [
        new codePipelineAction.CodeStarConnectionsSourceAction({
          actionName: "GitHub_Source",
          owner: appAwsRepo[0],
          repo: appAwsRepo[1],
          branch: appAwsRepo[2],
          output: clientOnbaordingSourceOutputArtificat,
          connectionArn: codestarConnArn,
          variablesNamespace: 'MyNamespace',
        })
      ]
    });

    const clientOffbaordingSourceOutputArtificat = new codepipeline.Artifact();
    offboardingPipeline.addStage({
      stageName: 'Source',
      actions: [
        new codePipelineAction.CodeStarConnectionsSourceAction({
          actionName: "GitHub_Source",
          owner: appAwsRepo[0],
          repo: appAwsRepo[1],
          branch: appAwsRepo[2],
          output: clientOffbaordingSourceOutputArtificat,
          connectionArn: codestarConnArn,
          variablesNamespace: 'MyNamespace',
        })
      ]
    });

    onboardingPipeline.addStage({
      stageName: 'Client_Onboarding',
      actions: [
        new codePipelineAction.CodeBuildAction({
          actionName: "Client_Onboarding_Job",
          project: onboardingCodeBuildProject,
          input: clientOnbaordingSourceOutputArtificat,
        })
      ]
    });

    offboardingPipeline.addStage({
      stageName: 'Approve removal of Tenant',
      actions: [
        new codePipelineAction.ManualApprovalAction({
          actionName: "Approve"
        })
      ]
    });
    offboardingPipeline.addStage({
      stageName: 'Client_Offboarding',
      actions: [
        new codePipelineAction.CodeBuildAction({
          actionName: "Client_Offboarding_Job",
          project: offboardingCodeBuildProject,
          input: clientOffbaordingSourceOutputArtificat,
        })
      ]
    });
  }
}

module.exports = {ClientOnboardingOffboardingPipelineStack}
