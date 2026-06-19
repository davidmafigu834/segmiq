import { Preferences } from "@capacitor/preferences";

const TOKEN_KEY = "segmiq_field_token";
const CLIENT_ID_KEY = "segmiq_field_client_id";
const USER_NAME_KEY = "segmiq_field_user_name";
const USER_ROLE_KEY = "segmiq_field_user_role";

export async function getToken(): Promise<string | null> {
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  return value ?? null;
}

export async function setSession(
  token: string,
  clientId: string | null,
  name: string,
  role: string
): Promise<void> {
  await Preferences.set({ key: TOKEN_KEY, value: token });
  await Preferences.set({ key: CLIENT_ID_KEY, value: clientId ?? "" });
  await Preferences.set({ key: USER_NAME_KEY, value: name });
  await Preferences.set({ key: USER_ROLE_KEY, value: role });
}

export async function setClientId(clientId: string): Promise<void> {
  await Preferences.set({ key: CLIENT_ID_KEY, value: clientId });
}

export async function clearSession(): Promise<void> {
  await Preferences.remove({ key: TOKEN_KEY });
  await Preferences.remove({ key: CLIENT_ID_KEY });
  await Preferences.remove({ key: USER_NAME_KEY });
  await Preferences.remove({ key: USER_ROLE_KEY });
}

export async function getClientId(): Promise<string | null> {
  const { value } = await Preferences.get({ key: CLIENT_ID_KEY });
  return value || null;
}

export async function getUserName(): Promise<string | null> {
  const { value } = await Preferences.get({ key: USER_NAME_KEY });
  return value ?? null;
}

export async function getRole(): Promise<string | null> {
  const { value } = await Preferences.get({ key: USER_ROLE_KEY });
  return value ?? null;
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return Boolean(token);
}
