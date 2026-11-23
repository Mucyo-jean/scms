// Client-side read cache.
//
// The backend is the source of truth. `/api/bootstrap` returns a role-scoped
// snapshot (own requests, department queue, notifications, ...) and every
// mutation refreshes it. Keeping the snapshot in one external store preserves
// the synchronous selectors the UI components were built around.

import { useSyncExternalStore } from 'react';
import { apiRequest } from './client';

const EMPTY = {
  me: null,
  departments: [],
  users: [],
  requests: [],
  notifications: [],
  audit: [],
  ready: false,
  error: null,
};

let state = EMPTY;
const listeners = new Set();

const emit = () => listeners.forEach((listener) => listener());

export const getState = () => state;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setState(patch) {
  state = { ...state, ...patch };
  emit();
}

export function resetState() {
  state = EMPTY;
  emit();
}

let inflight = null;

export function refresh() {
  if (inflight) return inflight;
  inflight = apiRequest('/bootstrap')
    .then((data) => {
      state = { ...data, ready: true, error: null };
      emit();
      return state;
    })
    .catch((error) => {
      state = { ...state, ready: true, error: error.message };
      emit();
      throw error;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

export const useDb = (selector = (snapshot) => snapshot) =>
  selector(useSyncExternalStore(subscribe, getState));
