/** Copy dictionaries for the niu-lai sound board settings tab. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  tab: '牛来音效',
  title: '牛来音效',
  description: '发消息时播放"妈妈"，任务完成时播放"牛来"。',
  enabled: '启用音效',
  volume: '音量',
  mamaLabel: '发消息音效（妈妈）',
  niulaiLabel: '完成音效（牛来）',
  builtin: '内置默认',
  custom: '自定义',
  choose: '选择音频…',
  preview: '试听',
  reset: '恢复默认',
  fileTooLarge: '音频文件过大（上限 4 MB），请换一个小一点的文件。',
} satisfies Record<string, string>

/** niu-lai locale key union. */
export type NiuLaiLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  tab: 'Niu Lai sounds',
  title: 'Niu Lai sounds',
  description: 'Plays "Mama" when a message is sent and "Niu Lai" when a task completes.',
  enabled: 'Enable sounds',
  volume: 'Volume',
  mamaLabel: 'Send sound (Mama)',
  niulaiLabel: 'Complete sound (Niu Lai)',
  builtin: 'Built-in default',
  custom: 'Custom',
  choose: 'Choose audio…',
  preview: 'Preview',
  reset: 'Reset to default',
  fileTooLarge: 'The audio file is too large (4 MB limit). Please pick a smaller file.',
} satisfies Record<NiuLaiLocaleKey, string>

/** Dictionary namespace owned by this plugin. */
export const NS = 'niu-lai'
