/**
 * PostgREST resource-embed hints.
 *
 * `clients (` from `leads` is ambiguous once any join table has both
 * `lead_id` and `client_id` — PostgREST then infers a second M2M path.
 * Always pin the direct FK.
 */
export const LEADS_CLIENTS_EMBED = "clients!leads_client_id_fkey";
export const USERS_CLIENTS_EMBED = "clients!users_client_id_fkey";
