// Client for /api/account (login, Plus, profiles, saved medicines, alerts).
// The session is an HttpOnly cookie set by the server; nothing about it is stored in the page.

export interface Me {
  phone: string;
  plan: "free" | "plus";
  plan_until: string | null;
  profiles: { id: number; name: string }[];
  limits: { profiles: number };
}

export interface CloudSaved {
  id: number;
  profile_id: number;
  key: string;
  data: any;
  best_unit_price: number | null;
  refill_every_days: number | null;
  next_refill: string | null;
}

export interface Alert {
  kind: "price_drop" | "refill_due";
  saved_id: number;
  profile_id: number;
  medicine: string;
  option?: string;
  unit_now?: number;
  unit_before?: number;
  date?: string;
}

/** Plus price shown on the plans page (test mode: nothing is charged). */
export const PLUS_PRICE = 49;

async function call(method: "GET" | "POST", query: string | null, body?: Record<string, unknown>) {
  let r: Response;
  try {
    r = await fetch(`/api/account${query ? `?action=${query}` : ""}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : { Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new Error("network");
  }
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error ?? "account_error");
  return j;
}

const post = (action: string, extra: Record<string, unknown> = {}) => call("POST", null, { action, ...extra });

export const accountApi = {
  /** The signed-in user, null when signed out; "unavailable" when accounts aren't set up on this deployment. */
  async me(): Promise<{ user: Me; sms: boolean } | null | "unavailable"> {
    try {
      return await call("GET", "me");
    } catch (e: any) {
      if (e.message === "not_signed_in") return null;
      if (e.message === "not_configured" || e.message === "network") return "unavailable";
      throw e;
    }
  },
  requestOtp: (phone: string): Promise<{ sent: true; test_code?: string }> => post("request_otp", { phone }),
  verifyOtp: (phone: string, code: string, consent: boolean): Promise<{ user: Me; created: boolean }> => post("verify_otp", { phone, code, consent }),
  logout: () => post("logout"),
  deleteAccount: () => post("delete_account"),
  subscribe: (): Promise<{ user: Me }> => post("subscribe"),
  cancel: (): Promise<{ user: Me }> => post("cancel"),
  addProfile: (name: string): Promise<{ user: Me }> => post("add_profile", { name }),
  renameProfile: (id: number, name: string): Promise<{ user: Me }> => post("rename_profile", { id, name }),
  removeProfile: (id: number): Promise<{ user: Me }> => post("remove_profile", { id }),
  saved: (): Promise<{ saved: CloudSaved[] }> => call("GET", "saved"),
  save: (b: { profile_id: number; key: string; data: unknown; best_unit_price: number | null }): Promise<{ saved: CloudSaved[] }> => post("save", b),
  unsave: (id: number): Promise<{ saved: CloudSaved[] }> => post("unsave", { id }),
  reminder: (id: number, every_days: number | null, next_refill: string | null): Promise<{ saved: CloudSaved[] }> => post("reminder", { id, every_days, next_refill }),
  alerts: (): Promise<{ alerts: Alert[] }> => call("GET", "alerts"),
};
