import crypto from 'crypto';

/**
 * Generate a unique ID with a prefix
 * @param {string} prefix - Prefix for the ID (e.g., 'EVT', 'PRO', 'GRP')
 * @returns {string} - Generated ID
 */
export const generateId = (prefix) => {
  const timestamp = Date.now().toString(36);
  const randomStr = crypto.randomBytes(4).toString('hex');
  return `${prefix}-${timestamp}-${randomStr}`;
};

/**
 * Generate IDs for different entities
 */
export const generateEventId = () => generateId('EVT');
export const generateProfessionalId = () => generateId('PRO');
export const generateGroupId = () => generateId('GRP');
export const generateCampId = () => generateId('CMP');
export const generateInjuredPersonId = () => generateId('INJ');
export const generateTaskId = () => generateId('TSK');
