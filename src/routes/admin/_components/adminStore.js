import { persisted } from "svelte-persisted-store";

export const token = persisted('sista_auth_token', null);
export const record = persisted('sista_auth_record', null);