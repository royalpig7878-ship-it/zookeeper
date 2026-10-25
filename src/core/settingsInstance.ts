import { browserStore } from './save';
import { createSettingsStore } from './settings';

/** The one set of settings the running game shares. */
export const settings = createSettingsStore(browserStore);
