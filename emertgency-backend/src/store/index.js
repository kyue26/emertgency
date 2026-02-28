/**
 * Commander store: in-memory (default) or DynamoDB Local when USE_DYNAMODB=1
 */
const useDynamo = process.env.USE_DYNAMODB === '1' || process.env.USE_DYNAMODB === 'true';

export async function findProfessionalByEmail(email) {
  const m = useDynamo ? await import('./dynamoStore.js') : await import('./memoryStore.js');
  return m.findProfessionalByEmail(email);
}
export async function findProfessionalById(id) {
  const m = useDynamo ? await import('./dynamoStore.js') : await import('./memoryStore.js');
  return m.findProfessionalById(id);
}
export async function getActiveDrill() {
  const m = useDynamo ? await import('./dynamoStore.js') : await import('./memoryStore.js');
  return m.getActiveDrill();
}
export async function setActiveDrill(drill) {
  const m = useDynamo ? await import('./dynamoStore.js') : await import('./memoryStore.js');
  return m.setActiveDrill(drill);
}
export async function getCasualtyStatistics() {
  const m = useDynamo ? await import('./dynamoStore.js') : await import('./memoryStore.js');
  return m.getCasualtyStatistics();
}
export async function getResourceRequests() {
  const m = useDynamo ? await import('./dynamoStore.js') : await import('./memoryStore.js');
  return m.getResourceRequests();
}
export async function listProfessionals() {
  const m = useDynamo ? await import('./dynamoStore.js') : await import('./memoryStore.js');
  return m.listProfessionals();
}
export async function updateProfessional(id, updates) {
  const m = useDynamo ? await import('./dynamoStore.js') : await import('./memoryStore.js');
  return m.updateProfessional(id, updates);
}
