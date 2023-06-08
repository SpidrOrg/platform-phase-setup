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
    const buildImage = LinuxBuildImage.AMAZON_LINUX_2_4;
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
    const codebuildOnboardingDiffProjectRole = new iam.Role(this, 'clientOnbaordingDiffCodebuildrole', {
      roleName: "cdk-client-onboarding-diff-codebuild-role",
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
    const onboardingPipeline = new codepipeline.Pipeline(this, 'ClientOnboardingPipeline', {
      pipelineName: "client-onboarding",
      role: pipelineRole,
      restartExecutionOnUpdate: false
    });
    const onboardingCodeBuildProject = new codeBuild.PipelineProject(this, "onboardingCodebuildProject", {
      buildSpec: BuildSpec.fromSourceFilename("buildspec.yaml"),
      environment: {
        buildImage: buildImage,
        privileged: true
      },
      role: codebuildOnboardingProjectRole
    });
    const onboardingDiffCodeBuildProject = new codeBuild.PipelineProject(this, "onboardingCodebuildDiffProject", {
      buildSpec: BuildSpec.fromSourceFilename("buildspec_diff.yaml"),
      environment: {
        buildImage: buildImage,
        privileged: true
      },
      role: codebuildOnboardingDiffProjectRole
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
          triggerOnPush: false
        })
      ]
    });

    onboardingPipeline.addStage({
      stageName: 'Client_Onboarding_Diff',
      actions: [
        new codePipelineAction.CodeBuildAction({
          actionName: "Client_Onboarding_Job_Diff",
          project: onboardingDiffCodeBuildProject,
          input: clientOnbaordingSourceOutputArtificat,
        })
      ]
    });
    onboardingPipeline.addStage({
      stageName: 'Approve_Changes',
      actions: [
        new codePipelineAction.ManualApprovalAction({
          actionName: "Approve"
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
    const offboardingPipeline = new codepipeline.Pipeline(this, 'ClientOffboardingPipeline', {
      pipelineName: "client-offboarding",
      role: pipelineRole,
      restartExecutionOnUpdate: false
    });
    const offboardingCodeBuildProject = new codeBuild.PipelineProject(this, "offboardingCodebuildProject", {
      buildSpec: BuildSpec.fromSourceFilename("buildspec_offboard.yaml"),
      environment: {
        buildImage: buildImage,
        privileged: true
      },
      role: codebuildOffboardingProjectRole
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
          triggerOnPush: false
        })
      ]
    });
    offboardingPipeline.addStage({
      stageName: 'Approve_removal_of_Tenant',
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
