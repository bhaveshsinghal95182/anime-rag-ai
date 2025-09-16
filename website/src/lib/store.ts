import { create } from "zustand";

type PendingMessageStore = {
  pendingMessage?: string;
  pendingConsumed: boolean;
  setPendingMessage: (msg?: string) => void;
  consumePendingMessage: () => void;
  clearPendingMessage: () => void;
};

type SetFn<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;

export const usePendingMessageStore = create<PendingMessageStore>((set: SetFn<PendingMessageStore>) => ({
  pendingMessage: undefined,
  pendingConsumed: false,
  setPendingMessage: (msg: string | undefined) => set(() => ({ pendingMessage: msg, pendingConsumed: false })),
  consumePendingMessage: () => set(() => ({ pendingConsumed: true })),
  clearPendingMessage: () => set(() => ({ pendingMessage: undefined, pendingConsumed: false })),
}));

export default usePendingMessageStore;
