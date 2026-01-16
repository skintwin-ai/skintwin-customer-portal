import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LogOut, PanelLeft, Settings, Sparkles } from "lucide-react";
import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

interface AppDashboardLayoutProps {
  children: ReactNode;
  title: string;
  navItems: NavItem[];
  currentPath: string;
}

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export function AppDashboardLayout({
  children,
  title,
  navItems,
  currentPath,
}: AppDashboardLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-rose-500" />
            <span className="text-2xl font-bold">SkinTwin</span>
          </div>
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent
        setSidebarWidth={setSidebarWidth}
        title={title}
        navItems={navItems}
        currentPath={currentPath}
      >
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: ReactNode;
  setSidebarWidth: (width: number) => void;
  title: string;
  navItems: NavItem[];
  currentPath: string;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  title,
  navItems,
  currentPath,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role: string | undefined) => {
    switch (role) {
      case "admin":
        return "Admin";
      case "salon_owner":
        return "Salon Owner";
      case "therapist":
        return "Therapist";
      case "retail_customer":
        return "Customer";
      default:
        return "User";
    }
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="h-5 w-5 text-rose-500 shrink-0" />
                  <span className="font-semibold tracking-tight truncate">
                    SkinTwin
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {navItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.href)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal"
                    >
                      <span className={isActive ? "text-primary" : ""}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t">
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton className="h-14">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-rose-100 text-rose-700">
                          {getInitials(user?.name)}
                        </AvatarFallback>
                      </Avatar>
                      {!isCollapsed && (
                        <div className="flex flex-col items-start min-w-0">
                          <span className="truncate font-medium text-sm">
                            {user?.name || "User"}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {getRoleBadge(user?.role)}
                          </span>
                        </div>
                      )}
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    align="start"
                    className="w-56"
                  >
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setLocation("/settings")}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => logout()}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        {!isCollapsed && !isMobile && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors z-10"
            onMouseDown={() => setIsResizing(true)}
          />
        )}
      </div>

      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {isMobile && <SidebarTrigger className="-ml-1" />}
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{title}</h1>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6 bg-muted/30">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}

export default AppDashboardLayout;
