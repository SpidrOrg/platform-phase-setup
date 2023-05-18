const {Stack} = require("aws-cdk-lib");
const {PipelineStack} = require("./pipeline-stack");
const {PreRequisiteStack} = require("./pre-requiste-stack");
const {ClientOnboardingOffboardingPipelineStack} = require("./client-onboarding-offboarding-pipeline-stack");
const {IngestionPipelineStack} = require("./ingestion-pipeline-stack");
const {TransformationPipelineStack} = require("./transformation-pipeline-stack");

class mainStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    let stackProps = {...props};

    const preRequisiteStack = new PreRequisiteStack(this, "preRequisiteStack", stackProps);
    stackProps = {...stackProps, preRequisiteStack: preRequisiteStack.stackExports}

    const platformPipelineStack = new PipelineStack(this, "platformstack", stackProps);
    platformPipelineStack.addDependency(preRequisiteStack);

    const ingestionPipelineStack = new IngestionPipelineStack(this, "IngestionPipelineStack", stackProps);
    ingestionPipelineStack.addDependency(preRequisiteStack);

    const transformationPipelineStack = new TransformationPipelineStack(this, "TransformationPipelineStack", stackProps);
    transformationPipelineStack.addDependency(preRequisiteStack);

    const clientOnboardingOffboardingPipelineStack = new ClientOnboardingOffboardingPipelineStack(this, "ClientOnboardingOffboardingPipelineStack", stackProps);
    clientOnboardingOffboardingPipelineStack.addDependency(preRequisiteStack);
  }
}

module.exports = mainStack;

