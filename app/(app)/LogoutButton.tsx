'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearSwCaches } from '@/lib/clearSwCaches';
import { logoutAction } from '@/app/login/actions';

// Purge the SW pages cache before the server action redirects to /login,
// closing the window where a cached /notes could be served. /login mount
// re-runs the same clear as a second pass.
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size="icon-xs" title="Abmelden" onClick={clearSwCaches}>
        <LogOut />
      </Button>
    </form>
  );
}
