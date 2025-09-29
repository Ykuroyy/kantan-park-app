import React, { useState } from 'react';
import './App.css';
import CameraCapture from './components/CameraCapture';
import ParkingDashboard from './components/ParkingDashboard';
import ParkingRecords from './components/ParkingRecords';
import CameraTest from './components/CameraTest';
import SmartCameraCapture from './components/SmartCameraCapture';

type TabType = 'camera' | 'dashboard' | 'records' | 'test' | 'smart';

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
      case 'test':
        return <CameraTest />;
      case 'smart':
        return <SmartCameraCapture />;
      default:
        return <SmartCameraCapture />;
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>🚗 駐車場管理システム</h1>
        <div className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === 'smart' ? 'active' : ''}`}
            onClick={() => setActiveTab('smart')}
          >
            📱 スマートカメラ
          </button>
          <button 
            className={`tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
            onClick={() => setActiveTab('camera')}
          >
            📷 標準カメラ
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
          <button 
            className={`tab-btn ${activeTab === 'test' ? 'active' : ''}`}
            onClick={() => setActiveTab('test')}
          >
            🔧 カメラテスト
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
