export const STORAGE_KEYS = {
  TRAILS: 'trails',
  STATE: 'trackerState',
  CONFIG: 'copysmithConfig',
};

export const RETENTION_DAYS_OPTIONS = [1, 7, 30, 0];

export const DEFAULT_NOISE_PATTERNS = [
  /关注我们.*?\n/g,
  /展开剩余\d+条?/g,
  /版权所有.*?\n/g,
  /转载请注明.*?\n/g,
  /点击上方.*?关注/g,
  /扫码.*?公众号/g,
  /广告\s*$/g,
  /^\s*[\d]+\s*评论\s*$/gm,
  /分享到.*?(?=\n|$)/g,
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
    rules: [
      { id: 'R001', name: '移除常见模板噪声', enabled: true, builtin: true, description: '正则匹配常见网页噪声' },
      { id: 'R002', name: '中文引号统一', enabled: true, builtin: true, description: '"..." → "..."' },
      { id: 'R003', name: '软换行修复', enabled: true, builtin: true, description: '合并句中被打断的软换行' },
      { id: 'R004', name: '代码块缩进保留', enabled: true, builtin: true, description: '检测 <pre>/<code> 上下文' },
      { id: 'R005', name: '多余空行压缩', enabled: true, builtin: true, description: '3+ 连续换行 → 2 个' },
      { id: 'R006', name: 'Markdown 化（实验性）', enabled: false, builtin: true, description: '标题/列表转 Markdown' },
      { id: 'R007', name: '表格结构保留', enabled: false, builtin: true, description: '复制表格保留 TS 格式' },
    ],
    preserveCodeBlocks: true,
    normalizeQuotes: true,
    fixSoftLineBreaks: true,
    skipInputFields: true,
    hotkeyBypass: 'Ctrl+Shift+C',
    retentionDays: 7,
    trackIncognito: false,
    blacklist: [],
  };
}
