// Compatibility shim. The app no longer stores data in the browser: `useDb`
// now subscribes to the role-scoped cache fed by the FastAPI backend, and
// `resetDb` asks the development API to re-seed the demo database.

export { getState, refresh, resetState, subscribe, useDb } from './store';
export { resetDemoData as resetDb } from './api';
