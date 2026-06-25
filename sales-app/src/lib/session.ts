import { Preferences } from "@capacitor/preferences";

const TOKEN_KEY = "segmiq_sales_token";
const USER_ID_KEY = "segmiq_sales_user_id";
const CLIENT_ID_KEY = "segmiq_sales_client_id";
const USER_NAME_KEY = "segmiq_sales_user_name";
const CLIENT_MODE_KEY = "segmiq_sales_client_mode";

export type ClientMode = "team" | "solo";

export async function getToken(): Promise<string | null> {
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  return value ?? null;
}

export async function setSession(params: {
  token: string;
  userId: string;
  clientId: string;
  name: string;
  clientMode: ClientMode;
}): Promise<void> {
  await Preferences.set({ key: TOKEN_KEY, value: params.token });
  await Preferences.set({ key: USER_ID_KEY, value: params.userId });
  await Preferences.set({ key: CLIENT_ID_KEY, value: params.clientId });
  await Preferences.set({ key: USER_NAME_KEY, value: params.name });
  await Preferences.set({ key: CLIENT_MODE_KEY, value: params.clientMode });
}

export async function clearSession(): Promise<void> {
  await Preferences.remove({ key: TOKEN_KEY });
  await Preferences.remove({ key: USER_ID_KEY });
  await Preferences.remove({ key: CLIENT_ID_KEY });
  await Preferences.remove({ key: USER_NAME_KEY });
  await Preferences.remove({ key: CLIENT_MODE_KEY });
}

export async function getUserId(): Promise<string | null> {
  const { value } = await Preferences.get({ key: USER_ID_KEY });
  return value ?? null;
}

export async function getClientId(): Promise<string | null> {
  const { value } = await Preferences.get({ key: CLIENT_ID_KEY });
  return value ?? null;
}

export async function getUserName(): Promise<string | null> {
  const { value } = await Preferences.get({ key: USER_NAME_KEY });
  return value ?? null;
}

export async function getClientMode(): Promise<ClientMode> {
  const { value } = await Preferences.get({ key: CLIENT_MODE_KEY });
  return value === "solo" ? "solo" : "team";
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return Boolean(token);
}
