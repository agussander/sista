import { persisted } from "svelte-persisted-store";

export const participo = persisted("device_played", false);
export const recordId = persisted("device_record_id", null);
export const number = persisted("device_number", null);
export const paso = persisted("device_state", 0);