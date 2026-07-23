import type { DataLifecycle, StatusPayload } from './types';

export type DataAction = { type: 'request' } | { type: 'success'; data: StatusPayload } | { type: 'failure'; message: string };

export const initialDataLifecycle: DataLifecycle = { phase: 'loading', data: null, failure: null };

export function dataLifecycleReducer(state: DataLifecycle, action: DataAction): DataLifecycle {
  if (action.type === 'request') return state.data ? { phase: 'refreshing', data: state.data, failure: null } : initialDataLifecycle;
  if (action.type === 'success') return { phase: 'ready', data: action.data, failure: null };
  return state.data
    ? { phase: 'stale', data: state.data, failure: action.message }
    : { phase: 'error', data: null, failure: action.message };
}
