const EMPTY_PRIORITY_STATS = {
  red: { total: 0, transported: 0, in_treatment: 0 },
  yellow: { total: 0, transported: 0, in_treatment: 0 },
  green: { total: 0, transported: 0, in_treatment: 0 },
  black: { total: 0, transported: 0, in_treatment: 0 },
};

export const toInt = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const clonePriorityStats = (stats = EMPTY_PRIORITY_STATS) => ({
  red: { ...EMPTY_PRIORITY_STATS.red, ...(stats.red || {}) },
  yellow: { ...EMPTY_PRIORITY_STATS.yellow, ...(stats.yellow || {}) },
  green: { ...EMPTY_PRIORITY_STATS.green, ...(stats.green || {}) },
  black: { ...EMPTY_PRIORITY_STATS.black, ...(stats.black || {}) },
});

export const mergeDashboardStats = ({ casualtyStats, checklistData }) => {
  const merged = clonePriorityStats(casualtyStats || EMPTY_PRIORITY_STATS);

  if (checklistData?.transportEntries) {
    merged.red.transported = Array.isArray(checklistData.transportEntries.priority1)
      ? checklistData.transportEntries.priority1.length
      : toInt(merged.red.transported);
    merged.yellow.transported = Array.isArray(checklistData.transportEntries.priority2)
      ? checklistData.transportEntries.priority2.length
      : toInt(merged.yellow.transported);
    merged.green.transported = Array.isArray(checklistData.transportEntries.priority3)
      ? checklistData.transportEntries.priority3.length
      : toInt(merged.green.transported);
  }

  merged.red.in_treatment = Math.max(0, toInt(merged.red.total) - toInt(merged.red.transported));
  merged.yellow.in_treatment = Math.max(0, toInt(merged.yellow.total) - toInt(merged.yellow.transported));
  merged.green.in_treatment = Math.max(0, toInt(merged.green.total) - toInt(merged.green.transported));

  return merged;
};

export const getDashboardTotal = (stats) =>
  toInt(stats?.red?.total) + toInt(stats?.yellow?.total) + toInt(stats?.green?.total) + toInt(stats?.black?.total);

export const transportEntriesToFeed = (transportEntries) => {
  const priorityToLabel = {
    priority1: "Priority 1",
    priority2: "Priority 2",
    priority3: "Priority 3",
  };

  return ["priority1", "priority2", "priority3"].flatMap((priorityKey) => {
    const entries = Array.isArray(transportEntries?.[priorityKey]) ? transportEntries[priorityKey] : [];
    return entries.map((entry, index) => ({
      id: `${priorityKey}-${entry?.tagNumber || "tag"}-${entry?.time || index}`,
      name: entry?.tagNumber || "Unknown tag",
      status: `${priorityToLabel[priorityKey]} transported`,
      time: entry?.time || "-",
    }));
  });
};

export { EMPTY_PRIORITY_STATS };
