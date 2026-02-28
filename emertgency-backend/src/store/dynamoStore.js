/**
 * DynamoDB Local store for commander backend.
 * Run DynamoDB Local: npm run dynamodb:start (Docker) or docker run -p 8000:8000 amazon/dynamodb-local
 * Then start commander with: USE_DYNAMODB=1 npm run dev:commander
 */
import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import bcrypt from 'bcrypt';

const endpoint = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
const region = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region, endpoint });
const doc = DynamoDBDocumentClient.from(client);

const TABLE_PROFESSIONALS = 'commander_professionals';
const TABLE_PASSWORDS = 'commander_passwords';
const TABLE_DRILLS = 'commander_drills';

let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  for (const [name, attrs, keySchema] of [
    [TABLE_PROFESSIONALS, [{ AttributeName: 'email_lower', AttributeType: 'S' }], [{ AttributeName: 'email_lower', KeyType: 'HASH' }]],
    [TABLE_PASSWORDS, [{ AttributeName: 'professionalId', AttributeType: 'S' }], [{ AttributeName: 'professionalId', KeyType: 'HASH' }]],
    [TABLE_DRILLS, [{ AttributeName: 'id', AttributeType: 'S' }], [{ AttributeName: 'id', KeyType: 'HASH' }]],
  ]) {
    try {
      await client.send(new CreateTableCommand({
        TableName: name,
        AttributeDefinitions: attrs,
        KeySchema: keySchema,
        BillingMode: 'PAY_PER_REQUEST',
      }));
    } catch (e) {
      if (e.name !== 'ResourceInUseException') throw e;
    }
  }
  // Seed default user
  const email = 'commander@test.com';
  const professionalId = 'PRO-dynamo-commander-1';
  const hash = await bcrypt.hash('commander123', 10);
  await doc.send(new PutCommand({
    TableName: TABLE_PROFESSIONALS,
    Item: {
      email_lower: email.toLowerCase(),
      email,
      professional_id: professionalId,
      name: 'Commander (DynamoDB)',
      role: 'Commander',
      group_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }));
  await doc.send(new PutCommand({
    TableName: TABLE_PASSWORDS,
    Item: { professionalId, password_hash: hash },
  }));
  tablesReady = true;
}

export async function findProfessionalByEmail(email) {
  await ensureTables();
  const key = (email || '').toLowerCase();
  const r = await doc.send(new GetCommand({
    TableName: TABLE_PROFESSIONALS,
    Key: { email_lower: key },
  }));
  const row = r.Item;
  if (!row) return null;
  const pass = await doc.send(new GetCommand({
    TableName: TABLE_PASSWORDS,
    Key: { professionalId: row.professional_id },
  }));
  return { ...row, password_hash: pass.Item?.password_hash };
}

export async function findProfessionalById(professionalId) {
  await ensureTables();
  const r = await doc.send(new ScanCommand({
    TableName: TABLE_PROFESSIONALS,
    FilterExpression: 'professional_id = :id',
    ExpressionAttributeValues: { ':id': professionalId },
  }));
  const row = r.Items?.[0];
  if (!row) return null;
  const { password_hash, ...rest } = row;
  return rest;
}

let activeDrill = null;
export async function getActiveDrill() {
  await ensureTables();
  if (activeDrill) return activeDrill;
  const r = await doc.send(new GetCommand({
    TableName: TABLE_DRILLS,
    Key: { id: 'active' },
  }));
  return r.Item ? JSON.parse(r.Item.data || '{}') : null;
}

export async function setActiveDrill(drill) {
  await ensureTables();
  activeDrill = drill;
  await doc.send(new PutCommand({
    TableName: TABLE_DRILLS,
    Item: { id: 'active', data: JSON.stringify(drill), updated_at: new Date().toISOString() },
  }));
  return drill;
}

export async function getCasualtyStatistics() {
  return {
    red: { color: 'red', in_treatment: 0, transported: 0, total: 0 },
    yellow: { color: 'yellow', in_treatment: 0, transported: 0, total: 0 },
    green: { color: 'green', in_treatment: 0, transported: 0, total: 0 },
    black: { color: 'black', in_treatment: 0, transported: 0, total: 0 },
  };
}

export async function getResourceRequests() {
  return [];
}

export async function listProfessionals() {
  await ensureTables();
  const r = await doc.send(new ScanCommand({ TableName: TABLE_PROFESSIONALS }));
  return (r.Items || []).map(({ password_hash, ...p }) => p);
}

export async function updateProfessional(id, updates) {
  await ensureTables();
  const r = await doc.send(new ScanCommand({
    TableName: TABLE_PROFESSIONALS,
    FilterExpression: 'professional_id = :id',
    ExpressionAttributeValues: { ':id': id },
  }));
  const row = r.Items?.[0];
  if (!row) return null;
  const updated = { ...row, ...updates, updated_at: new Date().toISOString() };
  await doc.send(new PutCommand({ TableName: TABLE_PROFESSIONALS, Item: updated }));
  const { password_hash: _, ...out } = updated;
  return out;
}

export default {
  findProfessionalByEmail,
  findProfessionalById,
  getActiveDrill,
  setActiveDrill,
  getCasualtyStatistics,
  getResourceRequests,
  listProfessionals,
  updateProfessional,
};
