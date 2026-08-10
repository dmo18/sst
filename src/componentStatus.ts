const NON_PROBLEM_COMPONENT_STATUS = /^(?:operational|available|up|ok|none|good|normal|healthy|not_available|n\/?a|not_applicable|unknown|under_maintenance|maintenance|scheduled_maintenance|planned_maintenance)$/;
const PROBLEM_COMPONENT_STATUS = /(?:degrad|partial[_-]?outage|major[_-]?outage|outage|unavailable|down|offline|disrupt|impaired|warning|error|failure)/;

export function normalizeComponentStatus(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

export function componentStatusIsProblem(value: unknown): boolean {
  const status = normalizeComponentStatus(value);
  if (!status || NON_PROBLEM_COMPONENT_STATUS.test(status)) return false;
  return PROBLEM_COMPONENT_STATUS.test(status);
}
