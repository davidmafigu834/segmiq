import { apiGet, apiPostPublic } from "./api";
import {
  clearSession,
  getClientId,
  getRole,
  getToken,
  getUserName,
  isLoggedIn,
  setClientId,
  setSession,
} from "./session";

export type AuthUser = {
  clientId: string | null;
  role: string;
  name: string;
};

export type CloudClient = {
  id: string;
  name: string;
  slug: string;
};

type LoginResponse = {
  token: string;
  user: AuthUser;
};

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await apiPostPublic<LoginResponse | { error?: string }>("/api/cloud/app/auth", {
    email: email.trim(),
    password,
  });

  if (!res.ok || !("token" in res.data)) {
    const apiError = (res.data as { error?: string }).error;
    throw new Error(
      apiError === "Unauthorized" ? "Invalid email or password." : apiError ?? "Invalid email or password."
    );
  }

  const { token, user } = res.data as LoginResponse;

  if (user.role !== "SUPER_ADMIN" && !user.clientId) {
    throw new Error(
      "This account is not linked to a Cloud client. Sign in with your cloud.segmiq.com account."
    );
  }

  await setSession(token, user.clientId, user.name ?? "", user.role);
  return user;
}

/** Super admins have no client_id on login — pick or restore one before loading projects. */
export async function resolveActiveClientId(): Promise<{
  clientId: string | null;
  clients: CloudClient[];
  error?: string;
}> {
  const stored = await getClientId();
  if (stored) return { clientId: stored, clients: [] };

  const role = await getRole();
  if (role !== "SUPER_ADMIN") {
    return {
      clientId: null,
      clients: [],
      error: "Your account is not linked to a Cloud client. Sign in with your cloud.segmiq.com account.",
    };
  }

  const res = await apiGet<CloudClient[] | { error?: string }>("/api/cloud/app/clients");
  if (!res.ok) {
    return {
      clientId: null,
      clients: [],
      error: (res.data as { error?: string }).error ?? "Failed to load clients.",
    };
  }

  const clients = Array.isArray(res.data) ? res.data : [];
  if (clients.length === 0) {
    return { clientId: null, clients: [], error: "No Cloud clients found." };
  }

  if (clients.length === 1) {
    await setClientId(clients[0]!.id);
    return { clientId: clients[0]!.id, clients };
  }

  return { clientId: null, clients };
}

export async function logout(): Promise<void> {
  await clearSession();
}

export { getToken, getClientId, getUserName, getRole, isLoggedIn, setClientId };
