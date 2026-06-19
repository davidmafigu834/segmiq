import { apiPostPublic } from "./api";
import {
  clearSession,
  getClientId,
  getToken,
  getUserName,
  isLoggedIn,
  setSession,
} from "./session";

export type AuthUser = {
  clientId: string | null;
  role: string;
  name: string;
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
  await setSession(token, user.clientId, user.name ?? "");
  return user;
}

export async function logout(): Promise<void> {
  await clearSession();
}

export { getToken, getClientId, getUserName, isLoggedIn };
