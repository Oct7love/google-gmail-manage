import { create } from 'zustand';
import type {
  Account,
  MessageDetail,
  MessageSummary,
  RefreshEvent,
} from '../../shared/types';
import { MESSAGES_PER_ACCOUNT } from '../../shared/constants';

type AppStatus = 'loading' | 'ready';

/**
 * dialogMode 表示账号编辑弹窗的状态：
 * - null：弹窗关闭
 * - 'new'：添加一个新账号
 * - { update: email }：为某个已存在账号更新应用密码
 */
export type DialogMode = null | 'new' | { update: string };

interface State {
  status: AppStatus;
  accounts: Account[];
  selectedEmail: string | null;
  messagesByEmail: Record<string, MessageSummary[]>;
  messageDetail: Record<string, MessageDetail>;
  selectedMessageId: string | null;
  refreshingEmails: Set<string>;
  dialogMode: DialogMode;

  init: () => Promise<void>;
  selectAccount: (email: string) => Promise<void>;
  selectMessage: (id: string) => Promise<void>;
  clearSelectedMessage: () => void;

  openAddDialog: () => void;
  openUpdateDialog: (email: string) => void;
  closeDialog: () => void;

  submitAdd: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  submitUpdate: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;

  removeAccount: (email: string) => Promise<void>;
  refreshOne: (email: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  onRefreshProgress: (evt: RefreshEvent) => void;
}

function detailKey(email: string, id: string): string {
  return `${email}:${id}`;
}

export const useStore = create<State>((set, get) => ({
  status: 'loading',
  accounts: [],
  selectedEmail: null,
  messagesByEmail: {},
  messageDetail: {},
  selectedMessageId: null,
  refreshingEmails: new Set(),
  dialogMode: null,

  init: async () => {
    const accounts = await window.api.accounts.list();
    const first = accounts[0]?.email ?? null;
    set({ accounts, status: 'ready', selectedEmail: first });
    if (first) await get().selectAccount(first);
  },

  selectAccount: async (email: string) => {
    set({ selectedEmail: email, selectedMessageId: null });
    const list = await window.api.messages.list(email, MESSAGES_PER_ACCOUNT);
    set((s) => ({ messagesByEmail: { ...s.messagesByEmail, [email]: list } }));
  },

  selectMessage: async (id: string) => {
    const email = get().selectedEmail;
    if (!email) return;
    set({ selectedMessageId: id });
    const key = detailKey(email, id);
    if (get().messageDetail[key]) return;
    const d = await window.api.messages.detail(email, id);
    if (d) set((s) => ({ messageDetail: { ...s.messageDetail, [key]: d } }));
  },

  clearSelectedMessage: () => set({ selectedMessageId: null }),

  openAddDialog: () => set({ dialogMode: 'new' }),
  openUpdateDialog: (email: string) => set({ dialogMode: { update: email } }),
  closeDialog: () => set({ dialogMode: null }),

  submitAdd: async (email, password) => {
    const res = await window.api.accounts.add({ email, password });
    if (res.ok && res.email) {
      const accounts = await window.api.accounts.list();
      // 不关闭 dialog：component 决定是关还是清空继续
      set({ accounts, selectedEmail: res.email });
      await get().selectAccount(res.email);
      return { ok: true };
    }
    return { ok: false, error: res.error };
  },

  submitUpdate: async (email, password) => {
    const res = await window.api.accounts.updatePassword({ email, password });
    if (res.ok) {
      const accounts = await window.api.accounts.list();
      set({ accounts, dialogMode: null });
      await get().selectAccount(email);
      return { ok: true };
    }
    return { ok: false, error: res.error };
  },

  removeAccount: async (email: string) => {
    const res = await window.api.accounts.remove(email);
    if (!res.ok) return;
    const accounts = await window.api.accounts.list();
    const nextSelected = accounts[0]?.email ?? null;
    set((s) => {
      const mb = { ...s.messagesByEmail };
      delete mb[email];
      return {
        accounts,
        selectedEmail: nextSelected,
        messagesByEmail: mb,
        selectedMessageId: null,
      };
    });
    if (nextSelected) await get().selectAccount(nextSelected);
  },

  refreshOne: async (email: string) => {
    set((s) => ({ refreshingEmails: new Set([...s.refreshingEmails, email]) }));
    await window.api.messages.sync(email, MESSAGES_PER_ACCOUNT);
    const list = await window.api.messages.list(email, MESSAGES_PER_ACCOUNT);
    const accounts = await window.api.accounts.list();
    set((s) => {
      const next = new Set(s.refreshingEmails);
      next.delete(email);
      return {
        refreshingEmails: next,
        messagesByEmail: { ...s.messagesByEmail, [email]: list },
        accounts,
      };
    });
  },

  refreshAll: async () => {
    const emails = get().accounts.map((a) => a.email);
    set((s) => ({ refreshingEmails: new Set([...s.refreshingEmails, ...emails]) }));
    await window.api.refresh.all();
    const accounts = await window.api.accounts.list();
    const selected = get().selectedEmail;
    set({ accounts });
    if (selected) {
      const list = await window.api.messages.list(selected, MESSAGES_PER_ACCOUNT);
      set((s) => ({ messagesByEmail: { ...s.messagesByEmail, [selected]: list } }));
    }
  },

  onRefreshProgress: (evt) => {
    set((s) => {
      const next = new Set(s.refreshingEmails);
      if (evt.phase === 'start') next.add(evt.email);
      else next.delete(evt.email);
      return { refreshingEmails: next };
    });
  },
}));
