import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, ScanCommandInput } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.SAMPLE_TABLE as string;

export const getAllItemsHandler = async (
	event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
	if (event.httpMethod !== 'GET') {
		throw new Error(`getAllItems only accept GET method, you tried: ${event.httpMethod}`);
	}
	console.info('received:', event);

	const params: ScanCommandInput = {
		TableName: tableName,
	};

	let items: unknown[] | undefined;
	try {
		const data = await ddbDocClient.send(new ScanCommand(params));
		items = data.Items as unknown[] | undefined;
	} catch (err) {
		console.log('Error', err);
	}

	const response: APIGatewayProxyResult = {
		statusCode: 200,
		body: JSON.stringify(items),
	};

	console.info(`response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`);
	return response;
};

