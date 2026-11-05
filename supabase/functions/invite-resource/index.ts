import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const REDIRECT = "https://slow409.github.io/Project-progress/";
const cors = { "Access-Control-Allow-Origin": "https://slow409.github.io", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);
    const { data: identity, error: authError } = await admin.auth.getUser(token);
    if (authError || !identity.user) return json({ error: "unauthorized" }, 401);
    let body;
    try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
    const projectId = String(body.project_id || "");
    const resourceId = String(body.resource_id || "");
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: "invalid_email" }, 400);
    const { data: project } = await admin.from("projects").select("owner_user_id").eq("id", projectId).maybeSingle();
    if (!project || project.owner_user_id !== identity.user.id) return json({ error: "owner_required" }, 403);
    const { data: resource } = await admin.from("resources").select("id,auth_user_id,name").eq("id", resourceId).eq("project_id", projectId).maybeSingle();
    if (!resource) return json({ error: "resource_not_found" }, 404);
    if (resource.auth_user_id) return json({ error: "resource_already_linked" }, 409);
    // The account directory stays on the server and is never returned to clients.
    let account = null;
    for (let page = 1; page <= 100; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      account = data.users.find(u => u.email?.toLowerCase() === email) || null;
      if (account || data.users.length < 100) break;
      if (page === 100) return json({ error: "account_lookup_limit" }, 503);
    }
    let invited = false;
    if (!account) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: REDIRECT });
      if (error || !data.user) return json({ error: "invite_failed" }, 400);
      account = data.user; invited = true;
    }
    // Compare-and-set prevents concurrent requests from replacing an existing mapping.
    const { data: updated, error } = await admin.from("resources").update({ email, auth_user_id: account.id, access_enabled: true }).eq("id", resourceId).eq("project_id", projectId).is("auth_user_id", null).select("id");
    if (error || !updated?.length) return json({ error: "resource_link_failed", invitation_sent: invited }, 409);
    await admin.from("resource_access_events").insert({ project_id: projectId, resource_id: resourceId, event_type: "account_linked", email, actor_user_id: identity.user.id });
    if (invited) await admin.from("resource_access_events").insert({ project_id: projectId, resource_id: resourceId, event_type: "invite_sent", email, actor_user_id: identity.user.id });
    return json({ ok: true, invited, resource: resource.name });
  } catch { return json({ error: "request_failed" }, 500); }
});
