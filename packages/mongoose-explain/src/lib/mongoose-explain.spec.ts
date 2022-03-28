import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Schema, SchemaDefinition, SchemaDefinitionType } from 'mongoose';

import type { Document } from 'mongodb';

import { explain } from './mongoose-explain';

interface Data {
  someProp: string;
}

const schemaDefinition: SchemaDefinition<SchemaDefinitionType<Data>> = {
  someProp: {
    type: String,
  },
};

const dataSchemaWithoutExplain = new Schema<Data>(schemaDefinition);
const DataModelWithoutExplain = mongoose.model<Data>('Data', dataSchemaWithoutExplain, 'data');

describe('explain plugin', () => {
  let mongoMemoryServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoMemoryServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoMemoryServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoMemoryServer.stop();
  });

  beforeEach(async () => {
    await DataModelWithoutExplain.deleteMany({});
    await DataModelWithoutExplain.create([
      {
        someProp: '42',
      },
      {
        someProp: '100',
      },
    ]);
  });

  it("passes the explanation to the callback for 'find' queries", async () => {
    // given
    const results: { operation: string; result: Document }[] = [];
    const underTest = explain({
      callback: (operation, result) => {
        results.push({ operation, result });
      },
    });

    const dataSchema = new Schema<Data>(schemaDefinition);
    dataSchema.plugin(underTest);
    const DataModel = mongoose.model<Data>('DataFind', dataSchema, 'data');

    // when
    const data = await DataModel.find({ someProp: '42' });

    // then
    expect(data).toHaveLength(1);
    expect(data[0]).toEqual(expect.objectContaining({ someProp: '42' }));
    expect(results).toHaveLength(1);
    expect(results[0]?.operation).toEqual('find');
    expect(results[0]?.result['ok']).toEqual(1);
  });

  it("passes the explanation to the callback for 'findOne' queries", async () => {
    // given
    const results: { operation: string; result: Document }[] = [];
    const underTest = explain({
      callback: (operation, result) => {
        results.push({ operation, result });
      },
    });

    const dataSchema = new Schema<Data>(schemaDefinition);
    dataSchema.plugin(underTest);
    const DataModel = mongoose.model<Data>('DataFindOne', dataSchema, 'data');

    // when
    const data = await DataModel.findOne({ someProp: '42' });

    // then
    expect(data).toEqual(expect.objectContaining({ someProp: '42' }));
    expect(results).toHaveLength(1);
    expect(results[0]?.operation).toEqual('findOne');
    expect(results[0]?.result['ok']).toEqual(1);
  });
});
