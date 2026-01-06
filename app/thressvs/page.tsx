'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

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

// 格式化数字显示
function formatNumber(num: number): string {
  if (num >= 100000000) {
    return (num / 100000000).toFixed(2) + '亿';
  }
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toLocaleString('zh-CN');
}

// 格式化月份显示
function formatMonthDisplay(monthCode: string): string {
  const match = monthCode.match(/^(\d{4})(\d{2})$/);
  if (match) {
    return `${parseInt(match[2])}月`;
  }
  return monthCode;
}

// 获取年份
function getYear(monthCode: string): string {
  const match = monthCode.match(/^(\d{4})/);
  return match ? match[1] : '';
}

export default function ThreeVsPage() {
  const [data, setData] = useState<AccountYearlyStats[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/yearly-stats');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          setError(`加载数据失败: ${errorData.error || response.statusText}`);
          return;
        }
        const result = await response.json();
        if (result.data) {
          setData(result.data);
          setMonths(result.months || []);
        }
      } catch (err) {
        setError(`加载数据失败: ${err instanceof Error ? err.message : '网络错误'}`);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // 获取年份范围
  const yearRange = months.length > 0 
    ? `${getYear(months[0])}年` 
    : '全年';

  // 找出各项最大值用于高亮
  const maxRead = Math.max(...data.map(d => d.total.阅读总数));
  const maxHeadline = Math.max(...data.map(d => d.total.头条文章阅读量));
  const maxForward = Math.max(...data.map(d => d.total.转发总量));

  return (
    <div className={styles.container}>
      {/* 顶部导航 */}
      <div className={styles.toolbar}>
        <div className={styles.titleSection}>
          <a href="/" className={styles.backLink}>← 竞家数据统计看板</a>
          <div className={styles.divider}>/</div>
          <div className={styles.title}>全年统计</div>
        </div>
        <div className={styles.yearBadge}>{yearRange}</div>
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

      {/* 主内容区 */}
      <div className={styles.mainContent}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.loadingSpinner}></div>
            <div>加载中...</div>
          </div>
        ) : (
          <div className={styles.tablesGrid}>
            {/* 总阅读数对比表 */}
            <div className={styles.tableCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>📖</div>
                <h3 className={styles.cardTitle}>总阅读数</h3>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>账号</th>
                    <th>全年总量</th>
                    {months.map(month => (
                      <th key={month}>{formatMonthDisplay(month)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((account, idx) => (
                    <tr key={account.accountName} className={styles[`row${idx}`]}>
                      <td className={styles.accountName}>{account.accountName}</td>
                      <td className={`${styles.totalCell} ${account.total.阅读总数 === maxRead ? styles.maxValue : ''}`}>
                        {formatNumber(account.total.阅读总数)}
                      </td>
                      {months.map(month => {
                        const monthData = account.monthlyData.find(m => m.month === month);
                        return (
                          <td key={month}>
                            {monthData ? formatNumber(monthData.阅读总数) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 头条阅读对比表 */}
            <div className={styles.tableCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>🔥</div>
                <h3 className={styles.cardTitle}>头条阅读</h3>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>账号</th>
                    <th>全年总量</th>
                    {months.map(month => (
                      <th key={month}>{formatMonthDisplay(month)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((account, idx) => (
                    <tr key={account.accountName} className={styles[`row${idx}`]}>
                      <td className={styles.accountName}>{account.accountName}</td>
                      <td className={`${styles.totalCell} ${account.total.头条文章阅读量 === maxHeadline ? styles.maxValue : ''}`}>
                        {formatNumber(account.total.头条文章阅读量)}
                      </td>
                      {months.map(month => {
                        const monthData = account.monthlyData.find(m => m.month === month);
                        return (
                          <td key={month}>
                            {monthData ? formatNumber(monthData.头条文章阅读量) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 转发数对比表 */}
            <div className={styles.tableCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>🔄</div>
                <h3 className={styles.cardTitle}>转发数</h3>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>账号</th>
                    <th>全年总量</th>
                    {months.map(month => (
                      <th key={month}>{formatMonthDisplay(month)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((account, idx) => (
                    <tr key={account.accountName} className={styles[`row${idx}`]}>
                      <td className={styles.accountName}>{account.accountName}</td>
                      <td className={`${styles.totalCell} ${account.total.转发总量 === maxForward ? styles.maxValue : ''}`}>
                        {formatNumber(account.total.转发总量)}
                      </td>
                      {months.map(month => {
                        const monthData = account.monthlyData.find(m => m.month === month);
                        return (
                          <td key={month}>
                            {monthData ? formatNumber(monthData.转发总量) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 汇总对比卡片 */}
            <div className={styles.summaryCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>📊</div>
                <h3 className={styles.cardTitle}>全年汇总对比</h3>
              </div>
              <div className={styles.summaryGrid}>
                {data.map((account, idx) => (
                  <div key={account.accountName} className={`${styles.summaryItem} ${styles[`summary${idx}`]}`}>
                    <div className={styles.summaryName}>{account.accountName}</div>
                    <div className={styles.summaryStats}>
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>总阅读</span>
                        <span className={`${styles.statValue} ${account.total.阅读总数 === maxRead ? styles.highlight : ''}`}>
                          {formatNumber(account.total.阅读总数)}
                        </span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>头条阅读</span>
                        <span className={`${styles.statValue} ${account.total.头条文章阅读量 === maxHeadline ? styles.highlight : ''}`}>
                          {formatNumber(account.total.头条文章阅读量)}
                        </span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>转发</span>
                        <span className={`${styles.statValue} ${account.total.转发总量 === maxForward ? styles.highlight : ''}`}>
                          {formatNumber(account.total.转发总量)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

