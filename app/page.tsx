'use client';

import { useState, useEffect, useRef } from 'react';
import { AccountData, getDisplayMetrics, getAccountKey, formatNumber } from '@/lib/excelReader';
import html2canvas from 'html2canvas';
import styles from './page.module.css';

// 将月份代码（如 202511）转换为显示格式（2025年11月）
function formatMonthDisplay(monthCode: string): string {
  const match = monthCode.match(/^(\d{4})(\d{2})$/);
  if (match) {
    const year = match[1];
    const month = parseInt(match[2]);
    return `${year}年${month}月`;
  }
  return monthCode;
}

// 解析月份字符串为可比较的数值
function parseMonthKey(monthKey: string): number {
  // 支持 202511 格式
  const match1 = monthKey.match(/^(\d{4})(\d{2})$/);
  if (match1) {
    return parseInt(monthKey);
  }
  // 支持 2025年11月 格式
  const match2 = monthKey.match(/(\d{4})[年\-]?(\d{1,2})/);
  if (match2) {
    const year = parseInt(match2[1]);
    const month = parseInt(match2[2]);
    return year * 100 + month;
  }
  return 0;
}

// 按月份排序
function sortMonths(months: string[]): string[] {
  return months.sort((a, b) => {
    const aValue = parseMonthKey(a);
    const bValue = parseMonthKey(b);
    return bValue - aValue; // 降序，最新的在前
  });
}

export default function Home() {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [currentData, setCurrentData] = useState<AccountData[]>([]);
  const [previousData, setPreviousData] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  // 加载可用的月份列表
  useEffect(() => {
    const loadMonths = async () => {
      try {
        const response = await fetch('/api/data');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          setError(`加载月份列表失败: ${errorData.error || response.statusText}`);
          return;
        }
        const result = await response.json();
        if (result.months) {
          const sortedMonths = sortMonths(result.months);
          setAvailableMonths(sortedMonths);
          // 自动选择最新的月份
          if (sortedMonths.length > 0 && !selectedMonth) {
            setSelectedMonth(sortedMonths[0]);
          }
        } else {
          setAvailableMonths([]);
        }
      } catch (error) {
        setError(`加载月份列表失败: ${error instanceof Error ? error.message : '网络错误'}`);
        // 即使失败也保持 UI 可见
        setAvailableMonths([]);
      }
    };

    loadMonths();
  }, []);

  // 加载选中月份的数据
  useEffect(() => {
    const loadData = async () => {
      if (!selectedMonth || !availableMonths.includes(selectedMonth)) {
        setCurrentData([]);
        setPreviousData([]);
        setError('');
        return;
      }

      setLoading(true);
      setError('');
      
      try {
        // 1. 加载当前月份数据
        const currentResponse = await fetch(`/api/data?month=${selectedMonth}`);
        
        // 检查响应状态
        if (!currentResponse.ok) {
          const errorData = await currentResponse.json().catch(() => ({}));
          const errorMsg = errorData.error || `HTTP ${currentResponse.status}`;
          setError(`加载${formatMonthDisplay(selectedMonth)}数据失败: ${errorMsg}`);
          setCurrentData([]);
          return;
        }
        
        const currentResult = await currentResponse.json();
        
        if (currentResult.error) {
          setError(`加载${formatMonthDisplay(selectedMonth)}数据失败: ${currentResult.error}`);
          setCurrentData([]);
        } else {
          const currentMonthData = currentResult.data || [];
          setCurrentData(currentMonthData);
          if (currentMonthData.length === 0) {
            setError(`${formatMonthDisplay(selectedMonth)}暂无数据`);
          } else {
            // 清除之前的错误
            setError('');
          }
        }

        // 2. 查找上一个月的数据（仅用于计算总转发数差值）
        // 注意：sortedMonths 是降序排列（最新的在前），所以上一个月是 currentIndex + 1
        const sortedMonths = sortMonths([...availableMonths]);
        const currentIndex = sortedMonths.indexOf(selectedMonth);
        
        if (currentIndex >= 0 && currentIndex + 1 < sortedMonths.length) {
          // 有上一个月，尝试加载（静默失败，不影响当前月数据显示）
          try {
            const previousMonth = sortedMonths[currentIndex + 1];
            const previousResponse = await fetch(`/api/data?month=${previousMonth}`);
            
            if (previousResponse.ok) {
              const previousResult = await previousResponse.json();
              if (!previousResult.error && previousResult.data && previousResult.data.length > 0) {
                setPreviousData(previousResult.data);
              } else {
                setPreviousData([]);
              }
            } else {
              // 上个月数据加载失败不影响当前月数据显示
              setPreviousData([]);
            }
          } catch (prevError) {
            // 上个月数据加载失败不影响当前月数据显示
            setPreviousData([]);
          }
        } else {
          setPreviousData([]);
        }
      } catch (error) {
        setError(`加载数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
        // 即使出错也保持UI显示
        setCurrentData([]);
        setPreviousData([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedMonth, availableMonths]);

  // 根据账号名称查找上一个月的数据
  const findPreviousAccountData = (account: AccountData): AccountData | undefined => {
    const key = getAccountKey(account);
    return previousData.find(prev => getAccountKey(prev) === key);
  };

  // 导出图片功能
  const exportToImage = async () => {
    if (!tableRef.current || !selectedMonth || currentData.length === 0) {
      return;
    }

    setExporting(true);
    try {
      // 创建标题
      const title = `${formatMonthDisplay(selectedMonth)}竞家数据统计看板`;
      
      // 使用 html2canvas 捕获表格
      const canvas = await html2canvas(tableRef.current, {
        background: '#ffffff',
        scale: 2, // 提高图片质量
        logging: false,
        useCORS: true,
      } as any);

      // 创建新的 canvas 来添加标题
      const finalCanvas = document.createElement('canvas');
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('无法创建画布上下文');
      }

      // 设置标题样式
      const titleHeight = 60;
      const padding = 20;
      finalCanvas.width = canvas.width + padding * 2;
      finalCanvas.height = canvas.height + titleHeight + padding * 2;

      // 填充白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

      // 绘制标题
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, finalCanvas.width / 2, titleHeight / 2);

      // 绘制表格
      ctx.drawImage(canvas, padding, titleHeight + padding);

      // 转换为图片并下载
      finalCanvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('无法创建图片');
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (error) {
      setError(`导出图片失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* 顶部工具栏 */}
      <div className={styles.toolbar}>
        <div className={styles.title}>竞家数据统计看板</div>
        <div className={styles.controls}>
          {availableMonths.length > 0 && (
            <select
              className={styles.monthSelector}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {availableMonths.map(month => (
                <option key={month} value={month}>
                  {formatMonthDisplay(month)}
                </option>
              ))}
            </select>
          )}
          {selectedMonth && currentData.length > 0 && (
            <button
              className={styles.exportButton}
              onClick={exportToImage}
              disabled={exporting}
            >
              {exporting ? '导出中...' : '导出图片'}
            </button>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className={styles.errorAlert}>
          <span className={styles.errorText}>⚠️ {error}</span>
          <button 
            className={styles.errorClose}
            onClick={() => setError('')}
          >
            ×
          </button>
        </div>
      )}

      {/* 数据表格 */}
      <div className={styles.tableContainer}>
        <div ref={tableRef} className={styles.tableWrapper}>
          <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.accountNameCell}>账号名称</th>
              <th>发文数</th>
              <th>总阅读数（万）</th>
              <th>头条阅读（万）</th>
              <th>10万+</th>
              <th>平均阅读</th>
              <th>总在看数</th>
              <th>总点赞数</th>
              <th>总转发数</th>
              <th className={styles.rankCell}>WCI/排名</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className={styles.empty}>
                  <div className={styles.loading}>
                    <div className={styles.loadingSpinner}></div>
                    <div>加载中...</div>
                  </div>
                </td>
              </tr>
            ) : currentData.length === 0 ? (
              <tr>
                <td colSpan={10} className={styles.empty}>
                  {availableMonths.length === 0 
                    ? '请在 data 文件夹中放置 Excel 文件' 
                    : selectedMonth 
                      ? `${formatMonthDisplay(selectedMonth)} 暂无数据，请检查文件格式`
                      : '请选择月份'}
                </td>
              </tr>
            ) : (
              currentData.map((account, index) => {
                const previousAccount = findPreviousAccountData(account);
                const metrics = getDisplayMetrics(account, previousAccount);
                
                return (
                  <tr key={index}>
                    <td className={`${styles.accountName} ${styles.accountNameCell}`}>
                      {typeof metrics.账号名称 === 'string' 
                        ? metrics.账号名称 
                        : (metrics.账号名称 as { error: string }).error || '-'}
                    </td>
                    <td>
                      <DataCell
                        value={metrics.发文数.value}
                        increment={metrics.发文数.increment}
                      />
                    </td>
                    <td>
                      <DataCell
                        value={metrics.总阅读数.value}
                        increment={metrics.总阅读数.increment}
                      />
                    </td>
                    <td>
                      <DataCell
                        value={metrics.头条阅读.value}
                        increment={metrics.头条阅读.increment}
                      />
                    </td>
                    <td>
                      <DataCell
                        value={metrics['10万+'].value}
                        increment={metrics['10万+'].increment}
                      />
                    </td>
                    <td>
                      <DataCell
                        value={metrics.平均阅读.value}
                        increment={metrics.平均阅读.increment}
                      />
                    </td>
                    <td>
                      <DataCell
                        value={metrics.总在看数.value}
                        increment={metrics.总在看数.increment}
                      />
                    </td>
                    <td>
                      <DataCell
                        value={metrics.总点赞数.value}
                        increment={metrics.总点赞数.increment}
                      />
                    </td>
                    <td>
                      <DataCell
                        value={metrics.总转发数.value}
                        increment={metrics.总转发数.increment}
                      />
                    </td>
                    <td className={styles.rankCell}>
                      <DataCell
                        value={metrics['WCI/排名'].value}
                        increment={metrics['WCI/排名'].increment}
                        isRank={true}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

// 数据单元格组件
function DataCell({ 
  value, 
  increment, 
  isRank = false
}: { 
  value: number | { error: string }; 
  increment: number | null | { error: string };
  isRank?: boolean;
}) {
  // 处理错误情况
  const hasValueError = typeof value === 'object' && value !== null && 'error' in value;
  const hasIncrementError = typeof increment === 'object' && increment !== null && 'error' in increment;
  const incrementValue = typeof increment === 'number' ? increment : (increment === null ? null : 0);
  const valueNumber = typeof value === 'number' ? value : 0;

  const isIncrease = incrementValue !== null && incrementValue > 0;
  const isDecrease = incrementValue !== null && incrementValue < 0;
  const hasChange = incrementValue !== null && incrementValue !== 0;

  // 对于排名：正数用红色，负数用绿色
  // 对于其他字段：正数用红色（增加），负数用绿色（减少）
  const displayIncrease = isRank ? isIncrease : isIncrease;
  const displayDecrease = isRank ? isDecrease : isDecrease;

  // 格式化显示值
  const formatValue = (val: number) => {
    if (isRank) {
      return val.toLocaleString('zh-CN');
    }
    return formatNumber(val);
  };

  return (
    <div className={styles.dataCell}>
      {hasValueError ? (
        <div className={styles.errorValue}>
          {(value as { error: string }).error}
        </div>
      ) : (
        <div className={styles.valueWrapper}>
          <div className={styles.value}>
            {formatValue(valueNumber)}
          </div>
          {hasIncrementError ? (
            <div className={styles.errorIncrement}>
              {(increment as { error: string }).error}
            </div>
          ) : hasChange && incrementValue !== null ? (
            <div
              className={`${styles.change} ${
                displayIncrease ? styles.increase : displayDecrease ? styles.decrease : ''
              }`}
            >
              {incrementValue > 0 ? '+' : ''}{formatValue(incrementValue)}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

