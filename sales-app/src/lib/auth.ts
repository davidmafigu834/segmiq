import { apiPostPublic } from "./api";
import {
  clearSession,
  getClientId,
  getClientMode,
  getUserName,
  isLoggedIn,
  setSession,
  type ClientMode,
} from "./session";

export type AuthUser = {
  userId: string;
  name: string;
  clientId: string;
  role: string;
  clientMode: ClientMode;
};

type LoginResponse = {
  token: string;
  user: AuthUser;
};

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await apiPostPublic<LoginResponse | { error?: string }>("/api/sales/app/auth", {
    email: email.trim(),
    password,
  });

  if (!res.ok || !("token" in res.data)) {
    const apiError = (res.data as { error?: string }).error;
    if (res.status === 403 && apiError) throw new Error(apiError);
    if (res.status === 400 && apiError === "Invalid JSON") {
      throw new Error("Could not reach the server. Try again or reinstall the latest app.");
    }
    if (res.status === 307 || res.status === 308) {
      throw new Error("Server redirect blocked sign-in. Update the app and try again.");
    }
    throw new Error(
      apiError === "Unauthorized"
        ? "Invalid email or password."
        : apiError ?? "Invalid email or password."
    );
  }

  const { token, user } = res.data as LoginResponse;
  await setSession({
    token,
    userId: user.userId,
    clientId: user.clientId,
    name: user.name ?? "",
    clientMode: user.clientMode ?? "team",
  });
  return user;
}

export async function logout(): Promise<void> {
  await clearSession();
}

export { getClientId, getUserName, getClientMode, isLoggedIn };
