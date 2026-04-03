import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { isAuthEnabled } from '@/lib/users';

export const metadata: Metadata = { title: 'Einrichtung' };

export default async function SetupPage() {
  const hasUsers = await isAuthEnabled();
  if (hasUsers) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Einrichtung erforderlich</CardTitle>
          <CardDescription>
            Es sind noch keine Benutzer eingerichtet.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-6">
          <p className="text-sm text-muted-foreground">
            Erstelle einen Benutzer auf dem Server:
          </p>
          <pre className="rounded-md bg-muted p-3 text-sm">
            {'bun run user add <benutzername>'}
          </pre>
          <p className="text-sm text-muted-foreground">
            Starte danach die App neu und melde dich an.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
