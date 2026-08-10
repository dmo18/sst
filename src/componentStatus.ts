const HEALTHY_COMPONENT_STATUS = /^(?:operational|available|up|ok|none|good|normal|healthy)$/;
const NEUTRAL_COMPONENT_STATUS = /^(?:not_available|n\/?a|not_applicable|unknown|under_maintenance|maintenance|scheduled_maintenance|planned_maintenance)$/;
const PROBLEM_COMPONENT_STATUS = /(?:degrad|partial[_-]?outage|major[_-]?outage|outage|unavailable|down|offline|disrupt|impaired|warning|error|failure)/;

export type ComponentStatusDisposition = 'healthy' | 'problem' | 'neutral';

export function normalizeComponentStatus(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

export function componentStatusDisposition(value: unknown): ComponentStatusDisposition {
  const status = normalizeComponentStatus(value);
  if (HEALTHY_COMPONENT_STATUS.test(status)) return 'healthy';
  if (!status || NEUTRAL_COMPONENT_STATUS.test(status)) return 'neutral';
  return PROBLEM_COMPONENT_STATUS.test(status) ? 'problem' : 'neutral';
}

export function componentStatusIsProblem(value: unknown): boolean {
  return componentStatusDisposition(value) === 'problem';
}
