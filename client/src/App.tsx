import React, { useState } from 'react';
import './App.css';
import CameraCapture from './components/CameraCapture';
import ParkingDashboard from './components/ParkingDashboard';
import ParkingRecords from './components/ParkingRecords';

type TabType = 'camera' | 'dashboard' | 'records';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('camera');

  const renderContent = () => {
    switch (activeTab) {
      case 'camera':
        return <CameraCapture />;
      case 'dashboard':
        return <ParkingDashboard />;
      case 'records':
        return <ParkingRecords />;
      default:
        return <CameraCapture />;
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>🚗 駐車場管理システム</h1>
        <div className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
            onClick={() => setActiveTab('camera')}
          >
            📷 カメラ撮影
          </button>
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            🅿️ 駐車場状況
          </button>
          <button 
            className={`tab-btn ${activeTab === 'records' ? 'active' : ''}`}
            onClick={() => setActiveTab('records')}
          >
            📊 履歴・レポート
          </button>
        </div>
      </header>
      
      <main className="app-content">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
