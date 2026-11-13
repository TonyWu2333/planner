import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { state, replaceAll } from './store.js';
import { today } from './date.js';

export async function exportBackup() {
  const name = `planner-backup-${today().replaceAll('-', '')}.json`;
  const text = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks: state.tasks }, null, 2);
  if (Capacitor.isNativePlatform()) {
    // 写到缓存目录，再调起系统分享，用户自己选发到微信 / 网盘 / 文件管理
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title: '可及清单备份', files: [uri] });
    } catch {
      /* 用户取消分享 */
    }
  } else {
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([text], { type: 'application/json' })),
      download: name,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

// 返回 { ok, count, message }
export async function importBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
    if (!Array.isArray(data.tasks)) throw new Error();
  } catch {
    return { ok: false, message: '这不是有效的备份文件' };
  }
  if (!confirm(`用备份里的 ${data.tasks.length} 条任务替换当前的 ${state.tasks.length} 条？`)) return { ok: false };
  replaceAll(data.tasks);
  return { ok: true, message: `已恢复 ${data.tasks.length} 条任务` };
}
