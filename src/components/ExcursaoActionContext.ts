import { createContext } from 'react';
export const ExcursaoActionContext = createContext<{ current: boolean } | null>(null);
