import React, { useState, useEffect } from 'react';
import api from '../api/config';
import './ParkingDashboard.css';

interface ParkingSpot {
  spot_number: number;
  is_occupied: boolean;
  license_plate?: string;
  check_in_time?: string;
  record_id?: number;
}

const ParkingDashboard: React.FC = () => {
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchParkingSpots();
    const interval = setInterval(fetchParkingSpots, 30000); // 30秒ごとに更新
    return () => clearInterval(interval);
  }, []);

  const fetchParkingSpots = async () => {
    try {
      const response = await api.get('/api/parking-spots');
      setParkingSpots(response.data);
      setLoading(false);
    } catch (error) {
      console.error('駐車場情報の取得に失敗しました:', error);
      setLoading(false);
    }
  };

  const handleSpotClick = (spot: ParkingSpot) => {
    setSelectedSpot(spot);
    setShowModal(true);
  };

  const handleCheckOut = async (recordId: number, spotNumber: number) => {
    try {
      await api.put(`/api/parking-records/${recordId}/checkout`);
      setShowModal(false);
      fetchParkingSpots(); // データを再取得
    } catch (error) {
      console.error('チェックアウトに失敗しました:', error);
    }
  };

  const getSpotClass = (spot: ParkingSpot) => {
    if (spot.is_occupied) {
      // 駐車時間によって色を変える
      const checkInTime = new Date(spot.check_in_time!);
      const now = new Date();
      const hoursDiff = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > 48) return 'spot occupied long-term'; // 48時間以上
      if (hoursDiff > 24) return 'spot occupied medium-term'; // 24時間以上
      return 'spot occupied short-term'; // 24時間未満
    }
    return 'spot available';
  };

  const formatDuration = (checkInTime: string) => {
    const start = new Date(checkInTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}時間${minutes}分`;
    }
    return `${minutes}分`;
  };

  const occupiedSpots = parkingSpots.filter(spot => spot.is_occupied).length;
  const availableSpots = 100 - occupiedSpots;

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>駐車場情報を読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="parking-dashboard">
      <div className="dashboard-header">
        <h2>🅿️ 駐車場現在状況</h2>
        <div className="status-summary">
          <div className="status-card occupied">
            <span className="status-number">{occupiedSpots}</span>
            <span className="status-label">使用中</span>
          </div>
          <div className="status-card available">
            <span className="status-number">{availableSpots}</span>
            <span className="status-label">空車</span>
          </div>
        </div>
      </div>

      <div className="legend">
        <div className="legend-item">
          <div className="legend-color available"></div>
          <span>空車</span>
        </div>
        <div className="legend-item">
          <div className="legend-color short-term"></div>
          <span>24時間未満</span>
        </div>
        <div className="legend-item">
          <div className="legend-color medium-term"></div>
          <span>24-48時間</span>
        </div>
        <div className="legend-item">
          <div className="legend-color long-term"></div>
          <span>48時間以上</span>
        </div>
      </div>

      <div className="parking-grid">
        {parkingSpots.map((spot) => (
          <div
            key={spot.spot_number}
            className={getSpotClass(spot)}
            onClick={() => handleSpotClick(spot)}
          >
            <div className="spot-number">{spot.spot_number}</div>
            {spot.is_occupied && (
              <div className="spot-info">
                <div className="license-plate">{spot.license_plate}</div>
                <div className="duration">
                  {formatDuration(spot.check_in_time!)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* モーダル */}
      {showModal && selectedSpot && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>駐車スペース {selectedSpot.spot_number}</h3>
              <button 
                className="close-btn"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {selectedSpot.is_occupied ? (
                <>
                  <div className="info-row">
                    <strong>ナンバープレート:</strong>
                    <span>{selectedSpot.license_plate}</span>
                  </div>
                  <div className="info-row">
                    <strong>入庫時間:</strong>
                    <span>{new Date(selectedSpot.check_in_time!).toLocaleString('ja-JP')}</span>
                  </div>
                  <div className="info-row">
                    <strong>駐車時間:</strong>
                    <span>{formatDuration(selectedSpot.check_in_time!)}</span>
                  </div>
                  
                  <div className="modal-actions">
                    <button 
                      className="checkout-btn"
                      onClick={() => handleCheckOut(selectedSpot.record_id!, selectedSpot.spot_number)}
                    >
                      🚗 チェックアウト
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-spot-info">
                  <p>🅿️ この駐車スペースは現在空いています</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParkingDashboard;