import * as XLSX from 'xlsx';

export interface AccountData {
  公众号: string;
  帐号名: string;
  文章总数: number;
  文章总增量: number;
  超10W文章数: number;
  超10W文章数增量: number;
  阅读总数: number;
  阅读总数增量: number;
  平均阅读数: number;
  平均阅读数增量: number;
  推荐总数: number;
  推荐总数增量: number;
  平均推荐数: number;
  平均推荐数增量: number;
  发布次数: number;
  发布次数增量: number;
  头条文章阅读量: number;
  头条文章阅读增量: number;
  头条文章推荐数: number;
  最大阅读数: number;
  最大推荐数: number;
  推荐率: number;
  点赞总数: number;
  点赞数增量: number;
  最大点赞数: number;
  头条文章点赞总数: number;
  平均点赞数: number;
  平均点赞数增量: number;
  转发总量: number;
  最大转发数: number;
  头条转发总数: number;
  WCI: number;
  WCI增量: number;
  总排名: number;
  总排名变化: number;
  [key: string]: string | number; // 允许其他字段
}

export interface ProcessedAccountData extends AccountData {
  [key: string]: string | number;
}

/**
 * 解析数字，支持带"w"（万）和"+"的单位
 */
function parseNumber(value: string | number): number {
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value !== 'string') {
    return 0;
  }

  // 移除空格和加号
  const cleaned = value.toString().trim().replace(/\+/g, '');
  
  // 处理"w"单位（万）
  if (cleaned.includes('w')) {
    const numPart = cleaned.replace('w', '').replace('+', '');
    const num = parseFloat(numPart);
    return isNaN(num) ? 0 : num * 10000;
  }
  
  // 处理普通数字
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * 格式化数字显示
 */
export function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w';
  }
  return num.toLocaleString('zh-CN');
}

/**
 * 读取 Excel 文件并解析数据
 */
export async function readExcelFile(file: File): Promise<AccountData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // 读取第一个工作表
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 转换为 JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: ''
        }) as any[][];
        
        if (jsonData.length < 2) {
          reject(new Error('Excel 文件格式不正确，至少需要表头和数据行'));
          return;
        }
        
        // 第一行是表头
        const headers = jsonData[0] as string[];
        const dataRows = jsonData.slice(1);
        
        // 解析数据
        const accounts: AccountData[] = dataRows
          .filter(row => row && (row[0] || row[1])) // 过滤空行（检查公众号或帐号名）
          .map(row => {
            const account: any = {};
            headers.forEach((header, index) => {
              const value = row[index];
              // 字符串字段
              if (header === '公众号' || header === '帐号名') {
                account[header] = value?.toString() || '';
              } else {
                // 数字字段
                account[header] = parseNumber(value);
              }
            });
            return account as AccountData;
          });
        
        resolve(accounts);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };
    
    reader.readAsBinaryString(file);
  });
}

/**
 * 计算两个月份数据的变化
 * 注意：Excel 文件已经包含了增量数据，这里我们使用 Excel 中的增量字段
 */
export function getAccountKey(account: AccountData): string {
  // 使用帐号名作为唯一标识
  return account.帐号名 || account.公众号 || '';
}

/**
 * 安全获取字段值，如果出错返回错误信息
 */
function safeGetValue<T>(getter: () => T, fieldName: string): T | { error: string } {
  try {
    const value = getter();
    // 检查是否为有效数字（排除NaN和Infinity）
    if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
      return { error: `${fieldName}数据错误` };
    }
    return value;
  } catch (error) {
    return { error: `${fieldName}数据错误` };
  }
}

/**
 * 获取前端显示所需的数据（简化版，只显示10列）
 * @param account 当前月份账号数据
 * @param previousAccount 上个月账号数据（仅用于计算总转发数差值）
 */
export function getDisplayMetrics(
  account: AccountData, 
  previousAccount?: AccountData
) {
  // 计算总转发数的差值（当前月 - 上个月）
  // 如果没有上个月数据，返回null（不显示增量）
  let forwardIncrement: number | null = null;
  if (previousAccount) {
    try {
      const currentForward = account.转发总量 || 0;
      const previousForward = previousAccount.转发总量 || 0;
      forwardIncrement = currentForward - previousForward;
    } catch (error) {
      forwardIncrement = null;
    }
  }

  return {
    账号名称: safeGetValue(() => account.公众号 || account.帐号名 || '-', '账号名称'),
    发文数: {
      value: safeGetValue(() => account.文章总数 ?? 0, '发文数'),
      increment: safeGetValue(() => account.文章总增量 ?? 0, '发文数增量')
    },
    总阅读数: {
      value: safeGetValue(() => account.阅读总数 ?? 0, '总阅读数'),
      increment: safeGetValue(() => account.阅读总数增量 ?? 0, '总阅读数增量')
    },
    头条阅读: {
      value: safeGetValue(() => account.头条文章阅读量 ?? 0, '头条阅读'),
      increment: safeGetValue(() => account.头条文章阅读增量 ?? 0, '头条阅读增量')
    },
    '10万+': {
      value: safeGetValue(() => account.超10W文章数 ?? 0, '10万+'),
      increment: safeGetValue(() => account.超10W文章数增量 ?? 0, '10万+增量')
    },
    平均阅读: {
      value: safeGetValue(() => account.平均阅读数 ?? 0, '平均阅读'),
      increment: safeGetValue(() => account.平均阅读数增量 ?? 0, '平均阅读增量')
    },
    总在看数: {
      value: safeGetValue(() => account.推荐总数 ?? 0, '总在看数'),
      increment: safeGetValue(() => account.推荐总数增量 ?? 0, '总在看数增量')
    },
    总点赞数: {
      value: safeGetValue(() => account.点赞总数 ?? 0, '总点赞数'),
      increment: safeGetValue(() => account.点赞数增量 ?? 0, '总点赞数增量')
    },
    总转发数: {
      value: safeGetValue(() => account.转发总量 ?? 0, '总转发数'),
      increment: forwardIncrement // 特殊处理：当前月 - 上个月，如果没有上个月数据则为null
    },
    'WCI/排名': {
      value: safeGetValue(() => account.总排名 ?? 0, 'WCI/排名'),
      increment: safeGetValue(() => account.总排名变化 ?? 0, 'WCI/排名变化')
    }
  };
}

