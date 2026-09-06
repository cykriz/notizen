'use client';

import { useActionState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PREFIX } from '@/lib/localCache';
import { localStorageKeys, removeLocal } from '@/lib/localStorageState';
import { clearSwCachesWhenReady } from '@/lib/clearSwCaches';
import { loginAction, type LoginState } from './actions';

const initialState: LoginState = { error: null };

function clearLocalCaches() {
  // localStorageKeys() is a snapshot, so removing inside the loop is safe.
  for (const key of localStorageKeys()) {
    if (key.startsWith(PREFIX)) {
      removeLocal(key);
    }
  }
}

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  useEffect(() => {
    clearLocalCaches();
    // Second pass after the logout button's synchronous one, and the only pass
    // that lands when the previous page was not yet controlled by the SW.
    void clearSwCachesWhenReady();
  }, []);

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Anmelden</CardTitle>
        </CardHeader>
        <CardContent className="px-6">
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Benutzername</Label>
              <Input id="username" name="username" type="text" autoComplete="username" autoFocus required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Passwort</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {state.error !== null && <p className="text-sm text-destructive">{state.error}</p>}
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Anmelden\u2026' : 'Anmelden'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
