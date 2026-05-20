import Link from 'next/link';
import { SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { LogoutButton } from './LogoutButton';
import { NAV_TABS, isTabActive } from './navTabs';

interface AppSidebarHeaderProps {
  authEnabled: boolean;
  pathname: string;
}

export function AppSidebarHeader({ authEnabled, pathname }: AppSidebarHeaderProps) {
  return (
    <SidebarHeader className="gap-3">
      <div className="flex items-center gap-3">
        <SidebarMenu className="flex-row gap-1">
          {NAV_TABS.map((tab) => (
            <SidebarMenuItem key={tab.href}>
              <SidebarMenuButton asChild isActive={isTabActive(tab.href, pathname)} size="sm">
                <Link href={tab.href}>
                  <tab.icon />
                  <span>{tab.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <SyncStatusIndicator />
          {authEnabled && <LogoutButton />}
        </div>
      </div>
    </SidebarHeader>
  );
}
