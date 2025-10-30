import { getAllItemsHandler } from '../../../src/handlers/get-all-items';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

describe('Test getAllItemsHandler', () => {
	const ddbMock = mockClient(DynamoDBDocumentClient);

	beforeEach(() => {
		ddbMock.reset();
	});

	it('should return ids', async () => {
		const items = [{ id: 'id1' }, { id: 'id2' }];

		ddbMock.on(ScanCommand).resolves({
			Items: items,
		});

		const event = {
			httpMethod: 'GET',
		} as any;

		const result = await getAllItemsHandler(event);

		const expectedResult = {
			statusCode: 200,
			body: JSON.stringify(items),
		};

		expect(result).toEqual(expectedResult);
	});
});

