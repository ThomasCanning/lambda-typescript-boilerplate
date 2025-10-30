import { putItemHandler } from '../../../src/handlers/put-item';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

describe('Test putItemHandler', function () {
	const ddbMock = mockClient(DynamoDBDocumentClient);

	beforeEach(() => {
		ddbMock.reset();
	});

	it('should add id to the table', async () => {
		const returnedItem = { id: 'id1', name: 'name1' };

		ddbMock.on(PutCommand).resolves({
			returnedItem,
		} as any);

		const event = {
			httpMethod: 'POST',
			body: '{"id": "id1","name": "name1"}',
		} as any;

		const result = await putItemHandler(event);

		const expectedResult = {
			statusCode: 200,
			body: JSON.stringify(returnedItem),
		};

		expect(result).toEqual(expectedResult);
	});
});

