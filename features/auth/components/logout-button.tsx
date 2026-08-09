"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/auth/login");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button onClick={() => setShowConfirm(true)}>Logout</Button>
      {showConfirm && (
        <ConfirmModal
          title="Logout?"
          message="Are you sure you want to logout? You will need to sign in again to access the admin dashboard."
          confirmLabel="Logout"
          confirmIcon={LogOut}
          busy={busy}
          onConfirm={logout}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
