

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { MessageSquare, Smartphone, Settings, Shield, Wifi, Users, Camera, Download, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Messages",
    url: createPageUrl("Dashboard"),
    icon: MessageSquare,
  },
  {
    title: "Photos", 
    url: createPageUrl("Photos"),
    icon: Camera, // Changed from Smartphone to Camera
  },
  {
    title: "Contacts", // New item added
    url: createPageUrl("Contacts"),
    icon: Users, // New icon for Contacts
  },
  {
    title: "Device Recovery",
    url: createPageUrl("ReverseSync"),
    icon: Download,
  },
  {
    title: "Sync Status",
    url: createPageUrl("SyncStatus"),
    icon: Wifi,
  },
  {
    title: "Settings",
    url: createPageUrl("Settings"),
    icon: Settings,
  },
];

export default function Layout({ children, currentPageName, signOut }) {
  const location = useLocation();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  return (
    <SidebarProvider>
      <style>{`
        :root {
          --md-sys-color-primary: 64 96 176;
          --md-sys-color-on-primary: 255 255 255;
          --md-sys-color-primary-container: 217 226 255;
          --md-sys-color-on-primary-container: 0 28 58;
          --md-sys-color-secondary: 84 95 113;
          --md-sys-color-on-secondary: 255 255 255;
          --md-sys-color-secondary-container: 216 227 248;
          --md-sys-color-on-secondary-container: 17 28 43;
          --md-sys-color-tertiary: 112 86 122;
          --md-sys-color-on-tertiary: 255 255 255;
          --md-sys-color-tertiary-container: 249 216 255;
          --md-sys-color-on-tertiary-container: 40 21 47;
          --md-sys-color-error: 186 26 26;
          --md-sys-color-on-error: 255 255 255;
          --md-sys-color-error-container: 255 218 214;
          --md-sys-color-on-error-container: 65 0 2;
          --md-sys-color-background: 254 247 255;
          --md-sys-color-on-background: 26 28 30;
          --md-sys-color-surface: 254 247 255;
          --md-sys-color-on-surface: 26 28 30;
          --md-sys-color-surface-variant: 224 226 236;
          --md-sys-color-on-surface-variant: 67 71 78;
          --md-sys-color-outline: 115 119 127;
          --md-sys-color-outline-variant: 195 198 208;
          --md-sys-color-shadow: 0 0 0;
          --md-sys-color-scrim: 0 0 0;
          --md-sys-color-inverse-surface: 47 48 51;
          --md-sys-color-inverse-on-surface: 241 240 244;
          --md-sys-color-inverse-primary: 170 200 255;
          --md-sys-color-surface-dim: 214 207 218;
          --md-sys-color-surface-bright: 254 247 255;
          --md-sys-color-surface-container-lowest: 255 255 255;
          --md-sys-color-surface-container-low: 247 242 250;
          --md-sys-color-surface-container: 241 237 244;
          --md-sys-color-surface-container-high: 236 231 239;
          --md-sys-color-surface-container-highest: 230 225 233;
        }
        
        body {
          font-family: 'Google Sans', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
          background: rgb(var(--md-sys-color-surface));
          color: rgb(var(--md-sys-color-on-surface));
        }
        
        .material-sidebar {
          background: rgb(var(--md-sys-color-surface-container-low));
          border-right: 1px solid rgb(var(--md-sys-color-outline-variant));
        }
        
        .material-nav-item {
          border-radius: 28px;
          margin: 4px 12px;
          transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
        }
        
        .material-nav-item:hover {
          background: rgb(var(--md-sys-color-secondary-container));
          color: rgb(var(--md-sys-color-on-secondary-container));
        }
        
        .material-nav-item.active {
          background: rgb(var(--md-sys-color-secondary-container));
          color: rgb(var(--md-sys-color-on-secondary-container));
        }
        
        .material-card {
          background: rgb(var(--md-sys-color-surface-container-low));
          border: 1px solid rgb(var(--md-sys-color-outline-variant));
          border-radius: 12px;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        
        .material-fab {
          border-radius: 16px;
          background: rgb(var(--md-sys-color-primary-container));
          color: rgb(var(--md-sys-color-on-primary-container));
        }
        
        .material-chip {
          border-radius: 8px;
          background: rgb(var(--md-sys-color-surface-container-high));
          color: rgb(var(--md-sys-color-on-surface-variant));
          border: 1px solid rgb(var(--md-sys-color-outline-variant));
        }
      `}</style>
      
      <div className="min-h-screen flex w-full">
        <Sidebar className="material-sidebar">
          <SidebarHeader className="border-b border-slate-200/50 p-6 flex justify-center items-center">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/783863c6d_FIGLogoai.png" 
              alt="Fig Messenger Logo" 
              className="h-10 w-auto" 
            />
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wider px-4 py-3" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`material-nav-item ${
                          location.pathname === item.url ? 'active' : ''
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-8">
              <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wider px-4 py-3" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>
                Security Status
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="px-4 py-3 space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Shield className="w-4 h-4" style={{ color: 'rgb(var(--md-sys-color-tertiary))' }} />
                    <span style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>OTP Verified</span>
                    <div className="ml-auto w-2 h-2 rounded-full animate-pulse" style={{ background: 'rgb(var(--md-sys-color-tertiary))' }}></div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Smartphone className="w-4 h-4" style={{ color: 'rgb(var(--md-sys-color-primary))' }} />
                    <span style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>Device Connected</span>
                    <div className="ml-auto w-2 h-2 rounded-full animate-pulse" style={{ background: 'rgb(var(--md-sys-color-primary))' }}></div>
                  </div>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgb(var(--md-sys-color-primary-container))' }}>
                  <span className="font-medium text-sm" style={{ color: 'rgb(var(--md-sys-color-on-primary-container))' }}>U</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: 'rgb(var(--md-sys-color-on-surface))' }}>Secure User</p>
                  <p className="text-xs truncate" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>End-to-end encrypted</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full flex-shrink-0"
                onClick={handleSignOut}
                aria-label="Log out"
              >
                <LogOut className="w-5 h-5 text-slate-600" />
              </Button>
            </div>
          </SidebarFooter>
          {/* --- END OF UPDATED SECTION --- */}
        </Sidebar>

        <main className="flex-1 flex flex-col" style={{ background: 'rgb(var(--md-sys-color-background))' }}>
          <header className="backdrop-blur-sm border-b px-6 py-4 md:hidden" style={{ 
            background: 'rgba(var(--md-sys-color-surface), 0.8)',
            borderColor: 'rgb(var(--md-sys-color-outline-variant))'
          }}>
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200" />
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/783863c6d_FIGLogoai.png" 
                alt="Fig Messenger Logo" 
                className="h-8 w-auto" 
              />
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

