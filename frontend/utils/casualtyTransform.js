/**
 * other_information field:
 * - JSON string: "{\"nameOrId\":\"...\",\"vitals\":{...}}"
 * - plain text string: "Name/ID: John Doe\nDescription: ..."
 * - null/undefined
 */

const parseOtherInformation = (otherInfo) => {
  if (!otherInfo) return { name: null, description: null, vitals: null, notes: null, raw: '' };
  
  // parse as json first
  try {
    const parsed = JSON.parse(otherInfo);
    return {
      name: parsed.nameOrId || null,
      description: parsed.description || null, 
      vitals: parsed.vitals || null,
      scores: parsed.scores || null,
      triageScore: parsed.triageScore || null,
      triagePriority: parsed.triagePriority || null,
      notes: parsed.additionalNotes || null,
      raw: otherInfo,
    };
  } catch (e) {
    // plaintext
    const lines = otherInfo.split('\n');
    const info = {
      name: null,
      description: null,
      vitals: null,
      notes: null,
      raw: otherInfo,
    };
    
    const descriptionLines = [];
    lines.forEach(line => {
      if (line.startsWith('Name/ID:')) {
        info.name = line.replace('Name/ID:', '').trim();
      } else if (line.startsWith('Description:')) {
        info.description = line.replace('Description:', '').trim();
      } else if (line.startsWith('Notes:') || line.startsWith('Additional Notes:')) {
        info.notes = line.replace(/^(Notes|Additional Notes):/, '').trim();
      } else if (!line.startsWith('BP:') && 
                 !line.startsWith('RR:') && 
                 !line.startsWith('GCS:') && 
                 !line.startsWith('Triage Score:') && 
                 !line.startsWith('Priority:')) {
        // only non-technical lines
        if (line.trim() && !line.match(/^(BP|RR|GCS|Triage Score|Priority):/)) {
          descriptionLines.push(line.trim());
        }
      }
    });
    
    if (info.description) {
      // alr set
    } else if (descriptionLines.length > 0) {
      info.description = descriptionLines.join('\n');
    }
    
    return info;
  }
};

/**
 * Transforms backend casualty object to frontend format
 * Backend fields: injured_person_id, color, breathing, conscious, bleeding, 
 *                 hospital_status, other_information, created_at, camp_location, etc.
 */
export const transformCasualty = (backendCasualty) => {
  if (!backendCasualty) return null;
  
  const parsedInfo = parseOtherInformation(backendCasualty.other_information);
  
  return {
    // backend IDs
    id: backendCasualty.injured_person_id,
    injured_person_id: backendCasualty.injured_person_id,
    event_id: backendCasualty.event_id,
    camp_id: backendCasualty.camp_id,
    
    // triage
    color: backendCasualty.color,
    triageLevel: backendCasualty.color, 
    
    // status fields
    breathing: backendCasualty.breathing,
    conscious: backendCasualty.conscious,
    bleeding: backendCasualty.bleeding,
    hospital_status: backendCasualty.hospital_status,
    
    // parsed information
    name: parsedInfo.name || 'Unknown',
    description: parsedInfo.description || parsedInfo.additionalNotes || '',
    injuries: parsedInfo.description || parsedInfo.additionalNotes || '',
    notes: parsedInfo.notes || parsedInfo.additionalNotes || '',
    vitals: parsedInfo.vitals || null,
    scores: parsedInfo.scores || null,
    triageScore: parsedInfo.triageScore || null,
    triagePriority: parsedInfo.triagePriority || null,
    
    // location
    location: backendCasualty.camp_location || backendCasualty.event_name || 'Unknown',
    camp_location: backendCasualty.camp_location,
    event_name: backendCasualty.event_name,
    
    // timestamps
    created_at: backendCasualty.created_at,
    updated_at: backendCasualty.updated_at,
    timestamp: backendCasualty.created_at, 
    
    // metadata
    created_by: backendCasualty.created_by,
    updated_by: backendCasualty.updated_by,
    event_status: backendCasualty.event_status,
    
    // keep original for reef
    original: backendCasualty,
  };
};

/**
 * transforms multiple casualties
 */
export const transformCasualties = (backendCasualties) => {
  if (!Array.isArray(backendCasualties)) return [];
  return backendCasualties.map(transformCasualty).filter(Boolean);
};

