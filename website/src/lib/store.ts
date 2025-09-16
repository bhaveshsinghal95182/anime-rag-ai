import { create } from "zustand";

type PendingMessageStore = {
  pendingMessage?: string;
  pendingConsumed: boolean;
  setPendingMessage: (msg?: string) => void;
  consumePendingMessage: () => void;
  clearPendingMessage: () => void;
};

export const usePendingMessageStore = create<PendingMessageStore>((set: any) => ({
  pendingMessage: undefined,
  pendingConsumed: false,
  setPendingMessage: (msg: string | undefined) => set(() => ({ pendingMessage: msg, pendingConsumed: false })),
  consumePendingMessage: () => set(() => ({ pendingConsumed: true })),
  clearPendingMessage: () => set(() => ({ pendingMessage: undefined, pendingConsumed: false })),
}));

export default usePendingMessageStore;
