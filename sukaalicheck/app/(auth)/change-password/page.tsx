"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Lock, Loader2 } from "lucide-react";

import { changePasswordSchema, type ChangePasswordInput } from "@/lib/schemas";
import { changePassword, facilityToStaff } from "@/lib/api";
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

export default function ChangePasswordPage() {
  const router = useRouter();
  const { hydrate, isHydrated, token, scope, login } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!token || scope !== "payment_done") {
      router.replace("/login");
    }
  }, [isHydrated, token, scope, router]);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(data: ChangePasswordInput) {
    if (!token) return;
    try {
      const res = await changePassword(token, data.newPassword, data.confirmPassword);
      login(res.access_token, facilityToStaff(res.facility));
      router.replace("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set password. Please try again.");
    }
  }

  if (!isHydrated || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface px-5 max-w-lg mx-auto">
      {/* Header */}
      <div className="pt-14 pb-8 flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="font-bold text-lg text-foreground leading-tight">Set your password</p>
          <p className="text-sm text-muted-foreground">Final step — create a secure password</p>
        </div>
      </div>

      <h1 className="text-2xl font-extrabold text-foreground mb-2">Choose a password</h1>
      <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
        You&apos;ll use this password every time you sign in. Make it at least 8 characters.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Repeat your password"
                    autoComplete="new-password"
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
                Saving…
              </>
            ) : (
              "Save password and go to dashboard"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
