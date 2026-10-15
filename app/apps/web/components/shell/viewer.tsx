"use client";
import { api } from "@drink/backend/api";
import { useAuthActions } from "@convex-dev/auth/react";
import type { Permission } from "@drink/shared";
import { useConvexAuth, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LogoTile } from "@/components/ui/misc";
import { ForcePasswordChange } from "./force-password-change";

export interface Viewer {
  _id: string;
  name: string;
  role: "artist" | "manager";
  email: string | null;
  permissions: Permission[];
  mustChangePassword: boolean;
}

const ViewerContext = createContext<Viewer | null>(null);

export function useViewer(): Viewer {
  const v = useContext(ViewerContext);
  if (!v) throw new Error("useViewer outside AuthGate");
  return v;
}
export const useIsArtist = () => useViewer().role === "artist";

/** UI gating only — every Convex function re-checks the same permission server-side. */
export function useCan(permission: Permission): boolean {
  const v = useViewer();
  return v.role === "artist" || v.permissions.includes(permission);
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <LogoTile size={56} className="animate-pulse" />
    </div>
  );
}

/** Staff-only area. Auth is enforced in every Convex function too — this only routes the UI. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const path = usePathname();
  const viewer = useQuery(api.settings.viewer, isAuthenticated ? {} : "skip");
  const { signOut } = useAuthActions();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace(`/sign-in?next=${encodeURIComponent(path)}`);
  }, [isLoading, isAuthenticated, router, path]);

  if (isLoading || !isAuthenticated || viewer === undefined) return <Splash />;
  if (viewer === null) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[400px] flex-col items-start justify-center gap-4 px-4">
        <LogoTile size={48} />
        <p>Your account isn&apos;t active. Ask the artist to re-enable it.</p>
        <Button onClick={() => void signOut()}>Sign out</Button>
      </div>
    );
  }
  if (viewer.mustChangePassword) return <ForcePasswordChange name={viewer.name} />;
  return <ViewerContext.Provider value={viewer as Viewer}>{children}</ViewerContext.Provider>;
}
