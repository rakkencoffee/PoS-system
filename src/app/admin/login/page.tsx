'use client';

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ALLOWED_ROLES = ["ADMIN", "MANAGER"];
const DEFAULT_DESTINATION = "/admin/edc-monitor";

// Only follow callbackUrl back into the admin area -- anything else (an
// absolute URL, "//evil.com", a kiosk path) falls back to the default so this
// page can't be used as an open redirect.
function safeDestination(callbackUrl: string | null) {
  if (callbackUrl && callbackUrl.startsWith("/admin/") && !callbackUrl.startsWith("/admin/login")) {
    return callbackUrl;
  }
  return DEFAULT_DESTINATION;
}

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const destination = safeDestination(searchParams.get("callbackUrl"));
  const { data: session, status } = useSession();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const role = (session?.user as { role?: string } | undefined)?.role;
  const hasAccess = status === "authenticated" && !!role && ALLOWED_ROLES.includes(role);
  const isWrongRole = status === "authenticated" && !hasAccess;

  useEffect(() => {
    if (hasAccess) router.replace(destination);
  }, [hasAccess, destination, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const result = await signIn("credentials", { username, password, redirect: false });

    if (result?.error) {
      setError("Username atau password salah");
      setIsLoading(false);
      return;
    }

    router.replace(destination);
    router.refresh();
  };

  if (status === "loading" || hasAccess) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <img src="/rakken-icon.svg" alt="Rakken Coffee" className="mb-2 h-12 w-12 object-contain" />
          <CardTitle>Admin RAKKEN</CardTitle>
          <CardDescription>Masuk pakai akun Admin atau Manager</CardDescription>
        </CardHeader>
        <CardContent>
          {isWrongRole ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-zinc-600">
                Akun <span className="font-semibold text-zinc-900">{session?.user?.name}</span> tidak punya akses
                ke halaman admin.
              </p>
              <Button variant="outline" className="w-full" onClick={() => signOut({ redirect: false })}>
                Login sebagai user lain
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Masuk..." : "Masuk"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-zinc-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900" />
        </div>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}
