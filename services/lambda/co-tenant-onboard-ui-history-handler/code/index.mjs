import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import

// Constants
const DYNAMODB_TABLE_NAME = "sensing-solution-tenant";
const REGION = process.env.region;

const formatDDResponse = (items = [])=>{
  const toReturn = [];
  items.forEach(item =>{
    const itemObj = {};
    Object.keys(item).forEach(key =>{
      const firstKey = Object.keys(item[key])[0];
      itemObj[key] = item[key][firstKey];
    });
    toReturn.push(itemObj);
  });
  return toReturn;
};

const formatForUI = (thisAccountResponse = [])=>{
  const toReturn = [];
  if (thisAccountResponse.length > 0){
    thisAccountResponse.forEach(v =>{
      const item = [];
      item.push(v.id);
      item.push(v.host);
      item.push(v.creationDt);
      item.push(v.onboardDt);

      toReturn.push(item);
    })
  }
  return toReturn;
}

const returnResponse = (status, messsage, data)=>{
  return {
    'statusCode': 200,
    'headers': {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
      "Access-Control-Allow-Credentials": true,
    },
    'body': JSON.stringify({
      status,
      messsage,
      data
    })
  };
};

export const handler = async(event) => {
  try {
    const thisAccountDynamodbClient = new DynamoDBClient({
      region: REGION
    });

    const input = {
      TableName: DYNAMODB_TABLE_NAME,
      AttributesToGet: [
        "id",
        "host",
        "creationDt",
        "onboardDt",
      ],
    }
    const command = new ScanCommand(input);

    const thisAccountQueryResponse = await thisAccountDynamodbClient.send(command);

    let thisAccountHistory = [];

    if (thisAccountQueryResponse && thisAccountQueryResponse.Items && thisAccountQueryResponse.Items.length > 0){
      thisAccountHistory = formatDDResponse(thisAccountQueryResponse.Items)
    }

    const formatedForUI = formatForUI(thisAccountHistory)
    return returnResponse("success", "success", {headers: ["Tenant ID", "Host", "Creation at", "Processed At"], data: formatedForUI})
  } catch (e){
    return returnResponse("error", e, [])
  }
};
