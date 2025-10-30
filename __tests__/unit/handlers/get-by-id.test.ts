import { getByIdHandler } from '../../../src/handlers/get-by-id';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

describe('Test getByIdHandler', () => {
	const ddbMock = mockClient(DynamoDBDocumentClient);

	beforeEach(() => {
		ddbMock.reset();
	});

	it('should get item by id', async () => {
		const item = { id: 'id1' };

		ddbMock.on(GetCommand).resolves({
			Item: item,
		});

		const event = {
			httpMethod: 'GET',
			pathParameters: {
				id: 'id1',
			},
		} as any;

		const result = await getByIdHandler(event);

		const expectedResult = {
			statusCode: 200,
			body: JSON.stringify(item),
		};

		expect(result).toEqual(expectedResult);
	});
});

