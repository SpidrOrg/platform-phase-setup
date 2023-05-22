import { DynamoDBClient, PutItemCommand, QueryCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";

// Constants
const DYNAMODB_TABLE_NAME = "sensing-solution-tenant";
const DYNAMODB_TABLE_NAME_GSI = "host-index";
const REGION = process.env.region;

const formatFormInputForDDitem = (formInput)=> {
  const toReturn = {...formInput};
  toReturn.categories = formInput.categories.split(",");
  toReturn.categories = JSON.stringify(toReturn.categories)
  toReturn.chosenModel = JSON.stringify(formInput.chosenModel);
  return toReturn;
}

const returnResponse = (status, message)=>{
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
      message
    })
  };
}

export const handler = async(event) => {
  const formValues = JSON.parse(event.body);

  const givenHost = formValues.host;
  const tenantId = formValues.tenantId ?? Math.floor(1000000000 + Math.random() * 9000000000)

  const thisAccountDynamodbClient = new DynamoDBClient({
    region: REGION
  });

  const hostExitsQueryResult = await thisAccountDynamodbClient.send(new QueryCommand({
    TableName: DYNAMODB_TABLE_NAME,
    IndexName: DYNAMODB_TABLE_NAME_GSI,
    KeyConditionExpression: "host = :host_name",
    ExpressionAttributeValues: {
      ":host_name": {"S": `${givenHost}`}
    },
    ProjectionExpression: "#attr",
    ExpressionAttributeNames: {"#attr":"id"}
  })).catch(e => {
    return {
      isError: true,
      errorMessage: e
    }
  });

  if (hostExitsQueryResult.isError){
    return returnResponse("fail", hostExitsQueryResult.errorMessage);
  }

  const hostAlreadyExists = hostExitsQueryResult && hostExitsQueryResult.Items && hostExitsQueryResult.Items.length > 0;

  if (hostAlreadyExists){
    console.log("host already exists, returning...");
    return returnResponse("fail", "Host already exists");
  }

  const idExitsQueryResult = await thisAccountDynamodbClient.send(new GetItemCommand({
    TableName: DYNAMODB_TABLE_NAME,
    Key: {
      id: {
        N: `${tenantId}`
      }
    },
    AttributesToGet: [
      "id",
    ],
  })).catch(e => {
    return {
      isError: true,
      errorMessage: e
    }
  });
  if (idExitsQueryResult.isError){
    return returnResponse("fail", idExitsQueryResult.errorMessage);
  }
  const idAlreadyExists = idExitsQueryResult && idExitsQueryResult.Item && idExitsQueryResult.Item.id;

  if (idAlreadyExists){
    console.log("ID already exists, returning...");
    return returnResponse("fail", "ID already exists..., please retry.");
  }

  const input = {
    TableName: "sensing-solution-tenant",
    Item: {
      "id": {
        "N": `${tenantId}`
      },
      "adminEmail": {
        "S": formValues.adminEmail
      },
      "categories": {
        "S": JSON.stringify(formValues.categories.split(","))
      },
      "choosenModel": {
        "S": JSON.stringify(formValues.chosenModel)
      },
      "clientspecificsources": {
        "SS": [
          "Google Trends",
          "SimilarWeb"
        ]
      },
      "dataLookbackMonths": {
        "N": "60"
      },
      "frequency": {
        "N": `${formValues.frequency}`
      },
      "horizons": {
        "S": "[\"1_3m\", \"4_6m\", \"7_9m\", \"10_12m\",\"1m\",\"3m\", \"6m\", \"12m\"]"
      },
      "host": {
        "S": `${formValues.host}`
      },
      "init_dt_x_end": {
        "S": `${formValues.endDate}`
      },
      "init_dt_x_start": {
        "S": `${formValues.startDate}`
      },
      "name": {
        "S": `${formValues.name}`
      },
      "orgId": {
        "S": "7112574756"
      },
      "phone": {
        "S": `${formValues.phone}`
      },
      "selectedDataSources": {
        "SS": formValues.selectedDataSources
      },
      "selectedClientDataSources": {
        "SS": formValues.selectedClientDataSources
      },
      "creationDt": {
        "S": new Date().toISOString()
      },
      "onboardDt": {
        "S": "pending"
      }
    }
  };

  const thisAccountDynamodbQueryResult = await thisAccountDynamodbClient.send(new PutItemCommand(input)).catch(e => {
    return {
      isError: true,
      errorMessage: e
    }
  });

  if (thisAccountDynamodbQueryResult.isError){
    return returnResponse("fail", thisAccountDynamodbQueryResult.errorMessage);
  }
  return returnResponse("success", "success");
};
