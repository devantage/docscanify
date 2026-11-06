import type { JSX } from 'react';

import { UpdatePrompt } from '@/features/pwa/UpdatePrompt';
import { ImportProgress } from '@/features/scan/ImportProgress';

import { AppHeader } from './AppHeader';
import { CurrentStep } from './CurrentStep';

/**
 * Layout of the app: the top bar and, below it, the workspace with the current step. It also
 * offers new versions of the app.
 */
export function AppShell(): JSX.Element {
  return (
    <div className="app">
      <AppHeader />
      <main className="workspace">
        <CurrentStep />
        <ImportProgress />
      </main>
      <UpdatePrompt />
    </div>
  );
}
