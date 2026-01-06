import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const DATA_DIR = path.resolve(process.cwd(), 'data');

// 需要统计的三家账号
const TARGET_ACCOUNTS = ['新智元', '机器之心', '量子位'];

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

  const cleaned = value.toString().trim().replace(/\+/g, '');
  
  if (cleaned.toLowerCase().includes('w')) {
    const numPart = cleaned.replace(/[wW]/g, '').replace('+', '');
    const num = parseFloat(numPart);
    return isNaN(num) ? 0 : num * 10000;
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

interface MonthlyData {
  month: string;
  阅读总数: number;
  头条文章阅读量: number;
  转发总量: number;
}

interface AccountYearlyStats {
  accountName: string;
  monthlyData: MonthlyData[];
  total: {
    阅读总数: number;
    头条文章阅读量: number;
    转发总量: number;
  };
}

export async function GET() {
  try {
    // 获取所有月份文件夹
    if (!fs.existsSync(DATA_DIR)) {
      return NextResponse.json({ error: '数据目录不存在' }, { status: 404 });
    }

    const months = fs.readdirSync(DATA_DIR)
      .filter(item => {
        try {
          const itemPath = path.join(DATA_DIR, item);
          if (!fs.statSync(itemPath).isDirectory() || !/^\d{6}$/.test(item)) {
            return false;
          }
          const files = fs.readdirSync(itemPath);
          return files.some(file => file.endsWith('.xlsx') || file.endsWith('.xls'));
        } catch {
          return false;
        }
      })
      .sort();

    // 初始化三家账号的统计数据
    const statsMap: Map<string, AccountYearlyStats> = new Map();
    TARGET_ACCOUNTS.forEach(name => {
      statsMap.set(name, {
        accountName: name,
        monthlyData: [],
        total: {
          阅读总数: 0,
          头条文章阅读量: 0,
          转发总量: 0,
        }
      });
    });

    // 遍历每个月份读取数据
    for (const month of months) {
      const monthDir = path.resolve(DATA_DIR, month);
      const files = fs.readdirSync(monthDir);
      const excelFile = files.find(file => file.endsWith('.xlsx') || file.endsWith('.xls'));
      
      if (!excelFile) continue;

      const filePath = path.resolve(monthDir, excelFile);
      
      try {
        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) continue;
        
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: ''
        }) as any[][];
        
        if (jsonData.length < 2) continue;
        
        const headers = jsonData[0] as string[];
        const dataRows = jsonData.slice(1);
        
        // 找到需要的列索引
        const accountNameIdx = headers.findIndex(h => h === '公众号' || h === '帐号名');
        const readTotalIdx = headers.findIndex(h => h === '阅读总数');
        const headlineReadIdx = headers.findIndex(h => h === '头条文章阅读量');
        const forwardTotalIdx = headers.findIndex(h => h === '转发总量');
        
        // 遍历数据行，查找三家账号
        for (const row of dataRows) {
          if (!row || !row[accountNameIdx]) continue;
          
          const accountName = row[accountNameIdx]?.toString().trim();
          
          if (TARGET_ACCOUNTS.includes(accountName)) {
            const stats = statsMap.get(accountName);
            if (stats) {
              const monthData: MonthlyData = {
                month,
                阅读总数: readTotalIdx >= 0 ? parseNumber(row[readTotalIdx]) : 0,
                头条文章阅读量: headlineReadIdx >= 0 ? parseNumber(row[headlineReadIdx]) : 0,
                转发总量: forwardTotalIdx >= 0 ? parseNumber(row[forwardTotalIdx]) : 0,
              };
              
              stats.monthlyData.push(monthData);
              stats.total.阅读总数 += monthData.阅读总数;
              stats.total.头条文章阅读量 += monthData.头条文章阅读量;
              stats.total.转发总量 += monthData.转发总量;
            }
          }
        }
      } catch (error) {
        console.error(`读取 ${month} 数据失败:`, error);
        continue;
      }
    }

    // 转换为数组返回
    const result = TARGET_ACCOUNTS.map(name => statsMap.get(name)!);
    
    return NextResponse.json({ 
      data: result,
      months: months 
    });
  } catch (error) {
    return NextResponse.json(
      { error: '服务器错误', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

