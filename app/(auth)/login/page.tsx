"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { loginSchema, type LoginInput } from "@/lib/schemas";
import { MOCK_STAFF } from "@/lib/mock";
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
  const { hydrate, isHydrated, token, login } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated && token) {
      router.replace("/dashboard");
    }
  }, [isHydrated, token, router]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { facilityId: "", password: "" },
  });

  async function onSubmit(data: LoginInput) {
    await new Promise((r) => setTimeout(r, 700));
    if (data.facilityId === "KLA-0421" && data.password === "password") {
      login("mock-token-123", MOCK_STAFF);
      router.replace("/dashboard");
    } else {
      toast.error("Invalid facility ID or password");
      form.setError("password", { message: "Invalid credentials" });
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface px-5">
      {/* Branding */}
      <div className="pt-14 pb-8 flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-xl">S</span>
        </div>
        <div>
          <p className="font-bold text-lg text-foreground leading-tight">SukaaliCheck</p>
          <p className="text-sm text-muted-foreground">Diabetes risk screening</p>
        </div>
      </div>

      {/* Heading */}
      <h1 className="text-2xl font-extrabold text-foreground mb-2">
        Sign in to your facility
      </h1>
      <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
        Use the credentials provided when your facility was registered.
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
                    placeholder="KLA-0421"
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
                <FormLabel>Password</FormLabel>
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
        <a
          href="mailto:sukaalicheck@example.com"
          className="text-sm text-primary font-medium"
        >
          Contact us at sukaalicheck@example.com
        </a>
      </div>
    </div>
  );
}
