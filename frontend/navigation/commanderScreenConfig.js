/**
 * Central config for commander screen names and titles.
 * Use these everywhere so we never show raw camelCase to the user.
 */
export const COMMANDER_SCREEN_TITLES = {
  CommanderDashboard: "Dashboard",
  CommanderDrillSetup: "Drill Setup",
  CommanderChecklist: "Officer Checklist",
  CommanderProfile: "Profile & Events",
  CommanderUsers: "Users",
};

/** Convert route name to display title (e.g. CommanderDrillSetup → "Drill Setup") */
export function formatCommanderTitle(routeName) {
  if (!routeName || typeof routeName !== "string") return "Command";
  if (COMMANDER_SCREEN_TITLES[routeName]) return COMMANDER_SCREEN_TITLES[routeName];
  const withoutPrefix = routeName.replace(/^Commander/, "");
  return withoutPrefix.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}

/** Main nav items (Profile is shown separately at bottom of drawer with avatar) */
export const COMMANDER_MENU_ITEMS = [
  { name: "Dashboard", screen: "CommanderDashboard", icon: "layout" },
  { name: "Drill Setup", screen: "CommanderDrillSetup", icon: "play-circle" },
  { name: "Officer Checklist", screen: "CommanderChecklist", icon: "clipboard" },
  { name: "Users Management", screen: "CommanderUsers", icon: "users" },
];
