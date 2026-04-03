"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, ListChecks, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import { logoutAction } from "@/app/login/actions";
import { NotesSidebarContent } from "./NotesSidebarContent";
import { TodosSidebarContent } from "./TodosSidebarContent";
import { useData } from "./DataProvider";

const tabs = [
  { href: "/notes", label: "Notizen", icon: FileText },
  { href: "/todos", label: "Aufgaben", icon: ListChecks },
] as const;

interface AppSidebarProps {
  authEnabled: boolean;
}

export function AppSidebar({ authEnabled }: AppSidebarProps) {
  const { notes, todos } = useData();
  const pathname = usePathname();
  const router = useRouter();
  const isTodos = pathname.startsWith("/todos");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) {
        return;
      }

      if (e.key === "1") {
        e.preventDefault();
        router.push("/notes");
      } else if (e.key === "2") {
        e.preventDefault();
        router.push("/todos");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [router]);

  return (
    <Sidebar variant="floating">
      <SidebarHeader className="gap-3">
        <div className="flex items-center gap-3">
          <SidebarMenu className="flex-row gap-1">
            {tabs.map((tab) => (
              <SidebarMenuItem key={tab.href}>
                <SidebarMenuButton
                  asChild
                  isActive={
                    tab.href === "/todos" ? isTodos : !isTodos
                  }
                  size="sm"
                >
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
            <ThemeToggle size="icon-xs" />
            {authEnabled && (
              <form action={logoutAction}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-xs"
                  title="Abmelden"
                >
                  <LogOut />
                </Button>
              </form>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {isTodos ? (
          <TodosSidebarContent todos={todos} />
        ) : (
          <NotesSidebarContent notes={notes} />
        )}
      </SidebarContent>
    </Sidebar>
  );
}
