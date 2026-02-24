'use client';

import Link from 'next/link';

export function InternalLinkRenderer({ href, children, ...props }: React.ComponentProps<'a'>) {
  if (typeof href === 'string' && href.startsWith('/notes/')) {
    return (
      <Link href={href} className="text-primary underline decoration-primary/40 hover:decoration-primary">
        {children}
      </Link>
    );
  }

  return <a href={href} {...props}>{children}</a>;
}
