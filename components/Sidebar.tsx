'use client'; // Needed for Tooltip and potential future client-side interactions

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, Settings, User } from 'lucide-react'; // Example icons

import { cn } from '../lib/utils';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

// Define the props for the Sidebar component, including className
interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

// Define the navigation items
const navItems: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/projects', label: 'Projects', icon: Package },
  // Add more items as needed
  // { href: '/settings', label: 'Settings', icon: Settings },
];

// Correctly define the Sidebar component accepting SidebarProps
export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname(); // Hook to get the current path

  return (
    // Use aside semantic element for sidebar
    <aside className={cn('flex h-screen flex-col border-r bg-card sticky top-0', className)}>
      <TooltipProvider delayDuration={0}>
        {/* Main navigation section */}
        <nav className="flex flex-col items-center gap-4 px-2 py-5">
          {navItems.map((item) => {
            // Determine if the current nav item is active
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link href={item.href}>
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'} // Use secondary variant for active, ghost otherwise
                      size="icon" // Render button as an icon
                      className={cn(
                        'rounded-lg',
                         // Apply specific styles for active state
                         isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                      )}
                      aria-label={item.label} // Accessibility label
                    >
                      <item.icon className="h-5 w-5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                {/* Tooltip content shown on hover */}
                <TooltipContent side="right" sideOffset={5}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Bottom navigation section (Settings, Profile) */}
        <nav className="mt-auto flex flex-col items-center gap-4 px-2 py-5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/settings"> {/* Placeholder link */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-auto rounded-lg text-muted-foreground"
                  aria-label="Settings"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={5}>
              Settings
            </TooltipContent>
          </Tooltip>
           <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/profile"> {/* Placeholder link */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-lg text-muted-foreground"
                  aria-label="Profile"
                >
                  <User className="h-5 w-5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={5}>
              Profile
            </TooltipContent>
          </Tooltip>
        </nav>
      </TooltipProvider>
    </aside>
  );
}

// Export the component as default
export default Sidebar;