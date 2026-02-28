/**
 * In-memory store for commander backend when PostgreSQL isn't available.
 * Use with USE_MEMORY_STORE=1. Seed user: commander@test.com / commander123
 */
import bcrypt from 'bcrypt';

const professionals = new Map();
const passwords = new Map();
let activeDrill = null;
const resourceRequests = [];

// Seed default commander user (password: commander123)
async function seed() {
  const email = 'commander@test.com';
  const professionalId = 'PRO-memory-commander-1';
  const hash = await bcrypt.hash('commander123', 10);
  professionals.set(email.toLowerCase(), {
    professional_id: professionalId,
    name: 'Commander (Local)',
    email,
    phone_number: null,
    role: 'Commander',
    group_id: null,
    current_camp_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  passwords.set(professionalId, { password_hash: hash });
}

let seeded = false;
async function ensureSeeded() {
  if (!seeded) {
    await seed();
    seeded = true;
  }
}

export async function findProfessionalByEmail(email) {
  await ensureSeeded();
  const row = professionals.get((email || '').toLowerCase());
  if (!row) return null;
  const pass = passwords.get(row.professional_id);
  return { ...row, password_hash: pass?.password_hash };
}

export async function findProfessionalById(professionalId) {
  await ensureSeeded();
  for (const p of professionals.values()) {
    if (p.professional_id === professionalId) return p;
  }
  return null;
}

export async function getActiveDrill() {
  await ensureSeeded();
  return activeDrill;
}

export async function setActiveDrill(drill) {
  activeDrill = drill;
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
  return resourceRequests;
}

export async function listProfessionals() {
  await ensureSeeded();
  return Array.from(professionals.values());
}

export async function updateProfessional(id, updates) {
  await ensureSeeded();
  for (const p of professionals.values()) {
    if (p.professional_id === id) {
      Object.assign(p, updates, { updated_at: new Date().toISOString() });
      return p;
    }
  }
  return null;
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
