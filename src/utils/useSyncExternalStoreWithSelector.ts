import { useSyncExternalStoreWithSelector as useSyncExternalStoreWithSelectorImpl } from "./useSyncExternalStoreWithSelector.native";

const fallback: typeof useSyncExternalStoreWithSelectorImpl = (
  _,
  getSnapshot,
  getServerSnapshot,
  selector
) => selector((getServerSnapshot || getSnapshot)());
export const useSyncExternalStoreWithSelector =
  typeof window !== "undefined" &&
  typeof window.document?.createElement === "function"
    ? useSyncExternalStoreWithSelectorImpl
    : fallback;
