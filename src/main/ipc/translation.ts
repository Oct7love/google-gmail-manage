import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels';
import { translateToChinese } from '../translation';

export interface TranslateResult {
  ok: boolean;
  text?: string;
  error?: string;
}

export function registerTranslationIpc(): void {
  ipcMain.handle(
    IpcChannels.Translation.Translate,
    async (_e, text: string): Promise<TranslateResult> => {
      try {
        const translated = await translateToChinese(text);
        return { ok: true, text: translated };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg };
      }
    },
  );
}
