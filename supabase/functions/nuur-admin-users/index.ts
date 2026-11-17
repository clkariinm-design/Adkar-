import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond(405, { error: "Method not allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");

  if (!url || !anonKey || !serviceRoleKey || !authHeader?.startsWith("Bearer ")) {
    return respond(500, { error: "Server configuration or authorization is missing" });
  }

  try {
    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await callerClient.auth.getUser();
    const caller = authData.user;
    if (authError || !caller || caller.is_anonymous) {
      return respond(401, { error: "A non-anonymous signed-in account is required" });
    }

    const { data: adminRecord, error: adminCheckError } = await callerClient
      .from("app_admins").select("role").eq("user_id", caller.id).maybeSingle();
    if (adminCheckError || adminRecord?.role !== "owner") {
      return respond(403, { error: "Owner access required" });
    }

    const adminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = await req.json().catch(() => null);
    if (!body || typeof body.action !== "string") return respond(400, { error: "A valid action is required" });

    if (body.action === "list") {
      const page = Number.isInteger(body.page) ? Math.max(1, Math.min(body.page, 1000)) : 1;
      const perPage = Number.isInteger(body.perPage) ? Math.max(1, Math.min(body.perPage, 100)) : 50;
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error) return respond(502, { error: "Could not retrieve users" });
      const users = (data.users ?? []).map((u) => ({
        id: u.id, email: u.email ?? null, created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null, email_confirmed_at: u.email_confirmed_at ?? null,
        banned_until: u.banned_until ?? null, is_anonymous: u.is_anonymous ?? false,
      }));
      return respond(200, { users, page, perPage, returned: users.length });
    }

    if (body.action === "search") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!email || email.length > 254) return respond(400, { error: "A valid email search term is required" });
      const matches: Record<string, unknown>[] = [];
      const perPage = 100;
      for (let page = 1; page <= 100; page++) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (error) return respond(502, { error: "Could not search users" });
        const batch = data.users ?? [];
        for (const u of batch) {
          if ((u.email ?? "").toLowerCase().includes(email)) matches.push({
            id: u.id, email: u.email ?? null, created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at ?? null, email_confirmed_at: u.email_confirmed_at ?? null,
            banned_until: u.banned_until ?? null, is_anonymous: u.is_anonymous ?? false,
          });
        }
        if (batch.length < perPage) break;
      }
      return respond(200, { users: matches, search: email, capped: matches.length >= 10000 });
    }

    if (body.action === "ban" || body.action === "unban") {
      const userId = typeof body.userId === "string" ? body.userId : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        return respond(400, { error: "A valid userId UUID is required" });
      }
      if (userId === caller.id) return respond(400, { error: "You cannot suspend your own owner account" });
      const { data: targetAdmin, error: targetAdminError } = await adminClient
        .from("app_admins").select("role").eq("user_id", userId).maybeSingle();
      if (targetAdminError) return respond(502, { error: "Could not verify target account privileges" });
      if (targetAdmin) return respond(409, { error: "Admin accounts cannot be suspended through user management" });

      const { data: updated, error: updateError } = await adminClient.auth.admin.updateUserById(
        userId, { ban_duration: body.action === "ban" ? "876000h" : "none" },
      );
      if (updateError || !updated.user) return respond(502, { error: "The account status could not be changed" });
      const { error: auditError } = await adminClient.from("admin_activity_logs").insert({
        actor_user_id: caller.id, action: body.action === "ban" ? "USER_SUSPENDED" : "USER_RESTORED",
        table_name: "auth.users", record_key: userId, old_data: null,
        new_data: { banned_until: updated.user.banned_until ?? null },
      });
      if (auditError) return respond(200, {
        success: true, audit_logged: false,
        warning: "Account status changed, but the audit record could not be written",
        user: { id: updated.user.id, email: updated.user.email ?? null, banned_until: updated.user.banned_until ?? null },
      });
      return respond(200, {
        success: true, audit_logged: true,
        user: { id: updated.user.id, email: updated.user.email ?? null, banned_until: updated.user.banned_until ?? null },
      });
    }
    return respond(400, { error: "Unsupported action" });
  } catch {
    return respond(500, { error: "Unexpected server error" });
  }
});
