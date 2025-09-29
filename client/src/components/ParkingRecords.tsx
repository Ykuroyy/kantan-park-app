import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ParkingRecords.css';

interface ParkingRecord {
  id: number;
  license_plate: string;
  spot_number: number;
  check_in_time: string;
  check_out_time?: string;
  image_path?: string;
  staff_id?: string;
  notes?: string;
  duration_hours?: number;
}

const ParkingRecords: React.FC = () => {
  const [records, setRecords] = useState<ParkingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [searchLicense, setSearchLicense] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'parked' | 'departed'>('all');

  useEffect(() => {
    fetchRecords();
  }, [dateFilter, filterStatus]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        startDate: dateFilter.start,
        endDate: dateFilter.end,
        status: filterStatus
      });
      
      const response = await axios.get(`/api/parking-records?${params}`);
      setRecords(response.data);
    } catch (error) {
      console.error('記録の取得に失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams({
        startDate: dateFilter.start,
        endDate: dateFilter.end,
        status: filterStatus
      });

      const response = await axios.get(`/api/export-excel?${params}`, {
        responseType: 'blob'
      });

      // ファイルダウンロード
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `parking_records_${dateFilter.start}_${dateFilter.end}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('エクセル出力に失敗しました:', error);
      alert('エクセル出力に失敗しました');
    }
  };

  const filteredRecords = records.filter(record => {
    if (searchLicense && !record.license_plate.toLowerCase().includes(searchLicense.toLowerCase())) {
      return false;
    }
    return true;
  });

  const formatDuration = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}分`;
    }
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return minutes > 0 ? `${wholeHours}時間${minutes}分` : `${wholeHours}時間`;
  };

  const getStatusBadge = (record: ParkingRecord) => {
    if (record.check_out_time) {
      return <span className="status-badge departed">出庫済み</span>;
    }
    return <span className="status-badge parked">駐車中</span>;
  };

  const getCurrentParkingDuration = (checkInTime: string) => {
    const start = new Date(checkInTime);
    const now = new Date();
    const diffHours = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
    return formatDuration(diffHours);
  };

  if (loading) {
    return (
      <div className="records-loading">
        <div className="loading-spinner"></div>
        <p>記録を読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="parking-records">
      <div className="records-header">
        <h2>📊 駐車記録・レポート</h2>
        
        <div className="controls-section">
          <div className="filters">
            <div className="date-filter">
              <label>
                開始日:
                <input
                  type="date"
                  value={dateFilter.start}
                  onChange={(e) => setDateFilter(prev => ({...prev, start: e.target.value}))}
                />
              </label>
              <label>
                終了日:
                <input
                  type="date"
                  value={dateFilter.end}
                  onChange={(e) => setDateFilter(prev => ({...prev, end: e.target.value}))}
                />
              </label>
            </div>
            
            <div className="status-filter">
              <label>
                状態:
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'parked' | 'departed')}
                >
                  <option value="all">すべて</option>
                  <option value="parked">駐車中</option>
                  <option value="departed">出庫済み</option>
                </select>
              </label>
            </div>
            
            <div className="license-search">
              <label>
                ナンバープレート検索:
                <input
                  type="text"
                  placeholder="例: 品川123あ1234"
                  value={searchLicense}
                  onChange={(e) => setSearchLicense(e.target.value)}
                />
              </label>
            </div>
          </div>
          
          <button className="export-btn" onClick={handleExportExcel}>
            📊 Excel出力
          </button>
        </div>
      </div>

      <div className="records-summary">
        <div className="summary-card">
          <h3>📈 サマリー</h3>
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-label">総記録数:</span>
              <span className="stat-value">{filteredRecords.length}</span>
            </div>
            <div className="stat">
              <span className="stat-label">現在駐車中:</span>
              <span className="stat-value">
                {filteredRecords.filter(r => !r.check_out_time).length}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">出庫済み:</span>
              <span className="stat-value">
                {filteredRecords.filter(r => r.check_out_time).length}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="records-table-container">
        <table className="records-table">
          <thead>
            <tr>
              <th>ナンバープレート</th>
              <th>駐車位置</th>
              <th>入庫時間</th>
              <th>出庫時間</th>
              <th>駐車時間</th>
              <th>状態</th>
              <th>スタッフID</th>
              <th>備考</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => (
              <tr key={record.id}>
                <td className="license-plate-cell">
                  {record.license_plate}
                </td>
                <td className="spot-number-cell">
                  {record.spot_number}番
                </td>
                <td className="datetime-cell">
                  {new Date(record.check_in_time).toLocaleString('ja-JP')}
                </td>
                <td className="datetime-cell">
                  {record.check_out_time 
                    ? new Date(record.check_out_time).toLocaleString('ja-JP')
                    : '-'
                  }
                </td>
                <td className="duration-cell">
                  {record.check_out_time && record.duration_hours
                    ? formatDuration(record.duration_hours)
                    : getCurrentParkingDuration(record.check_in_time)
                  }
                </td>
                <td className="status-cell">
                  {getStatusBadge(record)}
                </td>
                <td className="staff-cell">
                  {record.staff_id || '-'}
                </td>
                <td className="notes-cell">
                  {record.notes || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredRecords.length === 0 && (
          <div className="no-records">
            <p>📋 指定した条件に一致する記録がありません</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParkingRecords;