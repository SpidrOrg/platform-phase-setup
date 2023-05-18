import { CodePipelineClient, StartPipelineExecutionCommand, GetPipelineExecutionCommand } from "@aws-sdk/client-codepipeline";

// Constants
const PIPELINE_NAME = 'client-onboarding';
const OFFBOARD_PIPELINE_NAME = 'client-offboarding';

const isPipelineRunning = (pipelineExecutionStatusResponse)=>{
  const status = pipelineExecutionStatusResponse.pipelineExecution.status;
  console.log("Pipeline Status", status);
  return status === 'InProgress';

}

export const handler = async(event, context) => {
  const codePipelineClient = new CodePipelineClient();
  const record = event.Records[0].dynamodb;
  console.log("----record----", record);
  if (record.hasOwnProperty("OldImage") && record.hasOwnProperty("NewImage")){
    console.log("Item Edited");
    return;
  }
  if (record.hasOwnProperty("OldImage") && !record.hasOwnProperty("NewImage")){
    console.log("Item Deleted, kicking off client offboard pieline");
    const startPipelineResponse = await codePipelineClient.send(new StartPipelineExecutionCommand({
      name: OFFBOARD_PIPELINE_NAME,
      clientRequestToken: context.awsRequestId,
    }));
    console.log("startPipelineResponse", startPipelineResponse)
    return;
  }
  if (!record.hasOwnProperty("OldImage") && record.hasOwnProperty("NewImage")){
    console.log("Item Created, kicking off pipeline");
    const startPipelineResponse = await codePipelineClient.send(new StartPipelineExecutionCommand({
      name: PIPELINE_NAME,
      clientRequestToken: context.awsRequestId,
    }));
    console.log("startPipelineResponse", startPipelineResponse)
  }



  // let isCodePipelineExecuting = true;
  // const sleepDelay = 5 * 1000;
  // const maxWait = 10 * 60 * 1000;
  // let waited = 0;
  //
  // while(isCodePipelineExecuting && waited < maxWait){
  //   console.log("isCodePipelineExecuting", isCodePipelineExecuting, "waited", waited);
  //   // Sleep
  //   await new Promise(resolve => setTimeout(() => resolve(), sleepDelay));
  //   waited += sleepDelay;
  //
  //   const getPipelineExecutionCommandResponse = await codePipelineClient.send(new GetPipelineExecutionCommand({
  //     pipelineName: PIPELINE_NAME,
  //     pipelineExecutionId: startPipelineResponse.pipelineExecutionId
  //   }));
  //
  //   isCodePipelineExecuting = isPipelineRunning(getPipelineExecutionCommandResponse);
  // }
};
