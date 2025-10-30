import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, PutCommandInput } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.SAMPLE_TABLE as string;

export const putItemHandler = async (
	event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
	if (event.httpMethod !== 'POST') {
		throw new Error(`postMethod only accepts POST method, you tried: ${event.httpMethod} method.`);
	}
	console.info('received:', event);

	const body = JSON.parse(event.body ?? '{}') as { id: string; name: string };
	const id = body.id;
	const name = body.name;

	const params: PutCommandInput = {
		TableName: tableName,
		Item: { id, name },
	};

	try {
		const data = await ddbDocClient.send(new PutCommand(params));
		console.log('Success - item added or updated', data);
	} catch (err: unknown) {
		console.log('Error', (err as Error).stack ?? err);
	}

	const response: APIGatewayProxyResult = {
		statusCode: 200,
		body: JSON.stringify(body),
	};

	console.info(`response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`);
	return response;
};

