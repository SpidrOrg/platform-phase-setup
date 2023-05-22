const {Stack} = require("aws-cdk-lib");
const {PreRequisiteStack} = require("./pre-requiste-stack");
const {ClientOnboardingOffboardingPipelineStack} = require("./client-onboarding-offboarding-pipeline-stack");
const {ClientOnboardingUiStack} = require("./client-onboarding-ui-stack");

class mainStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    let stackProps = {...props};

    const preRequisiteStack = new PreRequisiteStack(this, "preRequisiteStack", stackProps);
    stackProps = {...stackProps, preRequisiteStack: preRequisiteStack.stackExports}

    const clientOnboardingOffboardingPipelineStack = new ClientOnboardingOffboardingPipelineStack(this, "ClientOnboardingOffboardingPipelineStack", stackProps);
    clientOnboardingOffboardingPipelineStack.addDependency(preRequisiteStack);

    const clientOnboardingUiStack = new ClientOnboardingUiStack(this, "ClientOnboardingUiStack", stackProps);
    clientOnboardingUiStack.addDependency(preRequisiteStack);
  }
}

module.exports = mainStack;
