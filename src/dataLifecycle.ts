import type { DataLifecycle, StatusPayload } from './types';

export type DataAction = {
  type: 'request';
} | {
  type: 'success';
  data: StatusPayload;
} | {
  type: 'overlay';
  data: StatusPayload;
} | {
  type: 'failure';
  message: string;
};

export const initialDataLifecycle: DataLifecycle = { phase: 'loading', data: null, failure: null };

export function dataLifecycleReducer(state: DataLifecycle, action: DataAction): DataLifecycle {
  if (action.type === 'request')
    return state.data ? { phase: 'refreshing', data: state.data, failure: null } : initialDataLifecycle;
  if (action.type === 'success')
    return { phase: 'ready', data: action.data, failure: null };
  if (action.type === 'overlay') {
    if (!state.data) return state;
    if (state.phase === 'stale') return { phase: 'stale', data: action.data, failure: state.failure };
    if (state.phase === 'refreshing') return { phase: 'refreshing', data: action.data, failure: null };
    return { phase: 'ready', data: action.data, failure: null };
  }
  return state.data
    ? { phase: 'stale', data: state.data, failure: action.message }
    : { phase: 'error', data: null, failure: action.message };
}
