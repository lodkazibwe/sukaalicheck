"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { loginSchema, type LoginInput } from "@/lib/schemas";
import { loginFacility, facilityToStaff } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

export default function LoginPage() {
  const router = useRouter();
  const { hydrate, isHydrated, token, scope, setToken, login } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated || !token) return;
    if (scope === "facility") router.replace("/dashboard");
    else if (scope === "payment_done") router.replace("/change-password");
    else if (scope === "first_login") router.replace("/payment");
  }, [isHydrated, token, scope, router]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { facilityId: "", password: "" },
  });

  async function onSubmit(data: LoginInput) {
    try {
      const res = await loginFacility(data.facilityId, data.password);
      if (res.scope === "first_login") {
        setToken(res.access_token, "first_login");
        router.replace("/payment");
      } else if (res.scope === "payment_done") {
        setToken(res.access_token, "payment_done");
        router.replace("/change-password");
      } else if (res.scope === "facility") {
        login(res.access_token, facilityToStaff(res.facility));
        router.replace("/dashboard");
      } else {
        setToken(res.access_token, res.scope);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      toast.error(msg);
      form.setError("password", { message: " " });
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface px-5">
      {/* Branding */}
      <div className="pt-14 pb-8 flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0">
          <Image
            src="/logos/SukaaliCheck.png"
            alt="SukaaliCheck"
            fill
            sizes="48px"
            className="object-contain"
            priority
          />
        </div>
        <div>
          <p className="font-bold text-lg text-foreground leading-tight">SukaaliCheck</p>
          <p className="text-sm text-muted-foreground">Diabetes type 2 risk predictor</p>
        </div>
      </div>

      {/* Heading */}
      <h1 className="text-2xl font-extrabold text-foreground mb-2">Sign in to your facility</h1>
      <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
        Use your Facility ID and password. First-time users: enter the activation code sent to
        your email.
      </p>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <FormField
            control={form.control}
            name="facilityId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Facility ID</FormLabel>
                <FormControl>
                  <Input
                    placeholder="KLA-CLI-PR-001"
                    autoComplete="username"
                    autoCapitalize="characters"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password or activation code</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            className="w-full mt-2"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </Form>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="py-8 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">Need an account?</p>
        <a href="mailto:sukaalicheckug@gmail.com" className="text-sm text-primary font-medium">
          Contact us at sukaalicheckug@gmail.com
        </a>
      </div>
    </div>
  );
}
