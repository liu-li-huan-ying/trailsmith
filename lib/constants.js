export const STORAGE_KEYS = {
  TRAILS: 'trails',
  STATE: 'trackerState',
  CONFIG: 'copysmithConfig',
};

/**
 * 净化规则：Copy Smith 的唯一事实源。
 * - R001–R005 已实现，逐条可在设置页开关。
 * - enabled 为默认值；options 页保存后以用户配置为准。
 */
export const DEFAULT_RULES = [
  {
    id: 'R001',
    name: '清理模板噪声',
    description: '按正则移除“关注我们 / 扫码关注 / 展开剩余”等页面模板文案',
    enabled: true,
  },
  {
    id: 'R002',
    name: '中文引号统一',
    description: '英文直引号 "..." 转为中文弯引号“...”',
    enabled: true,
  },
  {
    id: 'R003',
    name: '软换行修复',
    description: '合并句中被打断的换行，还原连续句子',
    enabled: true,
  },
  {
    id: 'R004',
    name: '代码块保护',
    description: '命中 <pre> / <code> 时只压缩空行，不动缩进与内容',
    enabled: true,
  },
  {
    id: 'R005',
    name: '空行压缩',
    description: '3 个以上连续换行压缩为 1 个空行',
    enabled: true,
  },
];

export const RETENTION_CHOICES = [
  { value: 1, label: '1 天' },
  { value: 7, label: '7 天' },
  { value: 30, label: '30 天' },
  { value: 0, label: '永久保留' },
];

export const PAYMENT_DOMAINS = [
  'alipay.com',
  'alipayobjects.com',
  'wechatpay.cn',
  'weixin.qq.com',
  'paypal.com',
  'stripe.com',
];

export function defaultConfig() {
  return {
    enabled: true,
    /** 在输入框 / 可编辑区域内复制时跳过净化（真实行为开关，非文本变换） */
    skipInputFields: true,
    hotkeyBypass: 'Ctrl+Shift+C',
    retentionDays: 7,
    trackIncognito: false,
    blacklist: [],
    rules: DEFAULT_RULES.map((r) => ({ ...r })),
  };
}
