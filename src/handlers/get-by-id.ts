import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, GetCommandInput } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.SAMPLE_TABLE as string;

export const getByIdHandler = async (
	event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
	if (event.httpMethod !== 'GET') {
		throw new Error(`getMethod only accept GET method, you tried: ${event.httpMethod}`);
	}
	console.info('received:', event);

	const id = event.pathParameters?.id as string;

	const params: GetCommandInput = {
		TableName: tableName,
		Key: { id },
	};

	let item: unknown | undefined;
	try {
		const data = await ddbDocClient.send(new GetCommand(params));
		item = data.Item as unknown | undefined;
	} catch (err) {
		console.log('Error', err);
	}

	const response: APIGatewayProxyResult = {
		statusCode: 200,
		body: JSON.stringify(item),
	};

	console.info(`response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`);
	return response;
};

