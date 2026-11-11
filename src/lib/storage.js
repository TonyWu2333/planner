// 唯一和"存在哪"打交道的文件。以后换 SQLite / 加云同步，只改这里。
// Preferences 在手机上是安卓原生 SharedPreferences，在浏览器里自动退化成 localStorage。
import { Preferences } from '@capacitor/preferences';

const KEY = 'planner-data';
const SETTINGS_KEY = 'planner-settings';

export async function load() {
  const { value } = await Preferences.get({ key: KEY });
  if (!value) return { version: 1, tasks: [] };
  try {
    const data = JSON.parse(value);
    if (!Array.isArray(data.tasks)) throw new Error('bad shape');
    return data;
  } catch (e) {
    // 数据损坏时先留一份原文，避免被下一次保存覆盖掉
    await Preferences.set({ key: `${KEY}-corrupt-${Date.now()}`, value });
    console.error('数据解析失败，已另存', e);
    return { version: 1, tasks: [] };
  }
}

export async function save(data) {
  await Preferences.set({ key: KEY, value: JSON.stringify(data) });
}

export async function loadSettings() {
  const { value } = await Preferences.get({ key: SETTINGS_KEY });
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

export async function saveSettings(s) {
  await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(s) });
}
