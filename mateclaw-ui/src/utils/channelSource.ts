const SOURCE_LABELS: Record<string, string> = {
  web: 'Web',
  feishu: 'Feishu',
  dingtalk: 'DingTalk',
  telegram: 'Telegram',
  discord: 'Discord',
  wecom: 'WeChat Work',
  weixin: 'WeChat',
  qq: 'QQ',
  slack: 'Slack',
  cron: 'Tarea programada',
}

const ICON_CHANNELS = ['web', 'feishu', 'dingtalk', 'telegram', 'discord', 'wecom', 'weixin', 'qq', 'slack', 'cron']

export function channelIconUrl(source?: string): string {
  const key = source || 'web'
  if (ICON_CHANNELS.includes(key)) return `/icons/channels/${key}.svg`
  return '/icons/channels/web.svg'
}

export function sourceLabel(source?: string): string {
  return SOURCE_LABELS[source || 'web'] || 'Web'
}
