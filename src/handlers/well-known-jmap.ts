import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const wellKnownJmapHandler = async (
	event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
	if (event.httpMethod !== 'GET') {
		throw new Error(`wellKnownJmap only accept GET method, you tried: ${event.httpMethod}`);
	}
	console.info('received:', event);

	const response: APIGatewayProxyResult = {
		statusCode: 200,
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			capabilities: {},
			apiUrl: process.env.API_URL || '',
			primaryAccounts: {},
		}),
	};

	console.info(`response from: ${event.path} statusCode: ${response.statusCode}`);
	return response;
};

