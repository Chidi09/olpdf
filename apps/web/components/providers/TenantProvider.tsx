'use client'

import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_BRAND } from '@/lib/branding';

interface TenantBranding {
  name?: string;
  logo_url?: string;
  primary_color?: string;
  accent_color?: string;
  favicon_url?: string;
}

interface TenantContextType {
  tenant: any | null;
  branding: TenantBranding;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  branding: {},
  isLoading: true,
});

export const useTenant = () => useContext(TenantContext);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<any | null>(null);
  const [branding, setBranding] = useState<TenantBranding>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function resolveTenant() {
      try {
        const res = await fetch('/api/tenants/resolve');
        if (res.ok) {
          const data = await res.ok ? await res.json() : null;
          if (data) {
            setTenant(data);
            setBranding({
              name: data.name,
              logo_url: data.logo_url,
              primary_color: data.primary_color,
              accent_color: data.accent_color,
              favicon_url: data.favicon_url,
            });

            // Apply CSS variables for white-labeling
            if (data.primary_color) {
              document.documentElement.style.setProperty('--accent', data.primary_color);
            }
            if (data.name) {
              document.title = data.name;
            }
            if (data.favicon_url) {
              const link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
              if (link) link.href = data.favicon_url;
            } else {
              const link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
              if (link) link.href = DEFAULT_BRAND.favicon;
            }
          }
        }
      } catch (e) {
        console.error('Tenant resolution failed', e);
      } finally {
        setIsLoading(false);
      }
    }

    resolveTenant();
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, branding, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}
