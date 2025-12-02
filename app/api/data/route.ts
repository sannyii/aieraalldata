import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

// 确保使用正确的数据目录路径
const DATA_DIR = path.resolve(process.cwd(), 'data');

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
  
  if (cleaned.includes('w')) {
    const numPart = cleaned.replace('w', '').replace('+', '');
    const num = parseFloat(numPart);
    return isNaN(num) ? 0 : num * 10000;
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

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
  [key: string]: string | number;
}

// GET /api/data - 获取所有可用的月份列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    // 如果指定了月份，返回该月份的数据
    if (month) {
      const monthDir = path.resolve(DATA_DIR, month);
      
      // 调试信息
      console.log('数据目录:', DATA_DIR);
      console.log('月份目录:', monthDir);
      console.log('月份目录是否存在:', fs.existsSync(monthDir));
      
      if (!fs.existsSync(monthDir)) {
        return NextResponse.json({ 
          error: `月份文件夹不存在: ${monthDir}` 
        }, { status: 404 });
      }

      // 查找该文件夹中的 Excel 文件
      let files: string[];
      try {
        files = fs.readdirSync(monthDir, { encoding: 'utf8' });
      } catch (readDirError) {
        return NextResponse.json({ 
          error: `无法读取文件夹: ${month}` 
        }, { status: 500 });
      }
      
      const excelFile = files.find(file => 
        file.endsWith('.xlsx') || file.endsWith('.xls')
      );

      if (!excelFile) {
        return NextResponse.json({ 
          error: `未找到 Excel 文件，文件夹中的文件: ${files.join(', ')}` 
        }, { status: 404 });
      }

      // 使用 path.resolve 确保路径正确，处理中文文件名
      const filePath = path.resolve(monthDir, excelFile);
      
      // 调试信息
      console.log('Excel 文件名:', excelFile);
      console.log('完整文件路径:', filePath);
      console.log('文件是否存在:', fs.existsSync(filePath));
      
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ 
          error: `文件不存在: ${excelFile}，路径: ${filePath}` 
        }, { status: 404 });
      }

      // 检查文件权限
      try {
        fs.accessSync(filePath, fs.constants.R_OK);
      } catch (accessError) {
        const errorMsg = accessError instanceof Error ? accessError.message : '未知错误';
        return NextResponse.json({ 
          error: `无法读取文件: ${excelFile}，请检查文件权限` 
        }, { status: 403 });
      }

      // 读取 Excel 文件
      let workbook;
      try {
        // 先尝试使用同步方式读取文件内容，然后再解析
        // 这样可以更好地处理文件访问错误
        const fileBuffer = fs.readFileSync(filePath);
        workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      } catch (readError) {
        const errorMsg = readError instanceof Error ? readError.message : '未知错误';
        const errorCode = (readError as any)?.code;
        
        // 记录详细错误信息用于调试
        console.error('读取 Excel 文件详细错误:', {
          filePath,
          excelFile,
          errorMsg,
          errorCode,
          fileExists: fs.existsSync(filePath)
        });
        
        // 如果是文件访问错误，提供更友好的提示
        if (errorMsg.includes('Cannot access file') || 
            errorMsg.includes('ENOENT') || 
            errorMsg.includes('ENOTFOUND') ||
            errorCode === 'ENOENT' ||
            errorCode === 'EACCES') {
          return NextResponse.json({ 
            error: `无法访问文件: ${excelFile}。请确保：1) 文件未被其他程序（如 Excel）打开；2) 文件权限正确；3) 文件路径正确。` 
          }, { status: 404 });
        }
        
        return NextResponse.json({ 
          error: `读取 Excel 文件失败: ${errorMsg}${errorCode ? ` (${errorCode})` : ''}` 
        }, { status: 500 });
      }
      
      // 检查是否有工作表
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return NextResponse.json({ error: 'Excel 文件中没有工作表' }, { status: 400 });
      }
      
      // 读取第一个工作表
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      if (!worksheet) {
        return NextResponse.json({ error: '无法读取工作表数据' }, { status: 400 });
      }
      
      // 转换为 JSON
      let jsonData: any[][];
      try {
        jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: ''
        }) as any[][];
      } catch (parseError) {
        return NextResponse.json({ 
          error: `解析 Excel 数据失败: ${parseError instanceof Error ? parseError.message : '未知错误'}` 
        }, { status: 400 });
      }
      
      if (!jsonData || jsonData.length < 2) {
        return NextResponse.json({ error: 'Excel 文件格式不正确，至少需要表头和数据行' }, { status: 400 });
      }
      
      // 第一行是表头
      const headers = jsonData[0] as string[];
      if (!headers || headers.length === 0) {
        return NextResponse.json({ error: 'Excel 文件缺少表头' }, { status: 400 });
      }
      
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
      
      return NextResponse.json({ data: accounts });
    }

    // 否则返回所有可用的月份列表（只返回有Excel文件的月份）
    if (!fs.existsSync(DATA_DIR)) {
      return NextResponse.json({ months: [] });
    }

    let months: string[] = [];
    try {
      months = fs.readdirSync(DATA_DIR)
        .filter(item => {
          try {
            const itemPath = path.join(DATA_DIR, item);
            if (!fs.statSync(itemPath).isDirectory() || !/^\d{6}$/.test(item)) {
              return false;
            }
            // 检查文件夹中是否有Excel文件
            const files = fs.readdirSync(itemPath);
            return files.some(file => file.endsWith('.xlsx') || file.endsWith('.xls'));
          } catch (err) {
            // 忽略无法访问的文件夹
            return false;
          }
        })
        .sort()
        .reverse(); // 最新的在前
    } catch (readDirError) {
      console.error('读取目录失败:', readDirError);
      // 即使读取目录失败，也返回空数组，不抛出错误
      return NextResponse.json({ months: [] });
    }

    return NextResponse.json({ months });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: '服务器错误', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

