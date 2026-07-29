import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, KeyRound, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Account credentials — username, email and password.
 * Shared by owners/staff (Settings), students and parents (Profile).
 */
export function AccountCard() {
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [currentPhone, setCurrentPhone] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUid(data.user?.id ?? null);
      setCurrentEmail(data.user?.email ?? null);
      setCurrentPhone(data.user?.phone ?? null);
    });
  }, []);

  const usernameQ = useQuery({
    enabled: !!uid,
    queryKey: ["my-username", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_usernames")
        .select("username")
        .eq("user_id", uid!)
        .maybeSingle();
      if (error) throw error;
      return data?.username ?? "";
    },
  });

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<"username" | "email" | "password" | null>(null);

  useEffect(() => {
    if (typeof usernameQ.data === "string") setUsername(usernameQ.data);
  }, [usernameQ.data]);
  useEffect(() => {
    if (currentEmail) setEmail(currentEmail);
  }, [currentEmail]);

  async function saveUsername(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,20}$/.test(u)) {
      toast.error("Username must be 3–20 characters: letters, numbers, dot or underscore.");
      return;
    }
    setBusy("username");
    const { error } = await supabase.rpc("set_my_username", { _username: u });
    setBusy(null);
    if (error) {
      toast.error(error.message.replace(/^.*?:\s*/, ""));
      return;
    }
    toast.success("Username saved — you can now sign in with it.");
    qc.invalidateQueries({ queryKey: ["my-username", uid] });
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (v === (currentEmail ?? "").toLowerCase()) {
      toast.info("That's already your email address.");
      return;
    }
    setBusy("email");
    const { error } = await supabase.auth.updateUser({ email: v });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCurrentEmail(v);
    toast.success("Email updated.");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setBusy("password");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    setConfirm("");
    toast.success("Password updated.");
  }

  return (
    <Card className="p-5 space-y-6">
      <div>
        <h2 className="text-base font-semibold">Login & Security</h2>
        <p className="text-sm text-muted-foreground">
          Sign in with your username, email{currentPhone ? " or phone" : ""} and password.
        </p>
      </div>

      {/* Username */}
      <form onSubmit={saveUsername} className="space-y-2">
        <Label htmlFor="acct-username" className="flex items-center gap-2 text-sm">
          <AtSign className="size-4 text-muted-foreground" /> Username
        </Label>
        <div className="flex gap-2">
          <Input
            id="acct-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. rahul.sharma"
            autoCapitalize="none"
            autoCorrect="off"
            maxLength={20}
          />
          <Button type="submit" disabled={busy === "username"}>
            {busy === "username" ? "Saving…" : "Save"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          3–20 characters — letters, numbers, dot or underscore. Optional, but handy if you'd
          rather not type your email every time.
        </p>
      </form>

      {/* Email */}
      <form onSubmit={saveEmail} className="space-y-2">
        <Label htmlFor="acct-email" className="flex items-center gap-2 text-sm">
          <Mail className="size-4 text-muted-foreground" /> Email
        </Label>
        <div className="flex gap-2">
          <Input
            id="acct-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoCapitalize="none"
          />
          <Button type="submit" variant="outline" disabled={busy === "email"}>
            {busy === "email" ? "Saving…" : "Update"}
          </Button>
        </div>
        {currentPhone ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="size-3" /> Phone on file: {currentPhone}
          </p>
        ) : null}
      </form>

      {/* Password */}
      <form onSubmit={savePassword} className="space-y-2">
        <Label htmlFor="acct-password" className="flex items-center gap-2 text-sm">
          <KeyRound className="size-4 text-muted-foreground" /> New password
        </Label>
        <Input
          id="acct-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />
        <Input
          aria-label="Confirm new password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          autoComplete="new-password"
        />
        <Button type="submit" variant="outline" disabled={busy === "password"}>
          {busy === "password" ? "Updating…" : "Change password"}
        </Button>
      </form>
    </Card>
  );
}
