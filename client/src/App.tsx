import React, { useState } from 'react';
import './App.css';
import CameraCapture from './components/CameraCapture';
import ParkingDashboard from './components/ParkingDashboard';
import ParkingRecords from './components/ParkingRecords';
import CameraTest from './components/CameraTest';
import SmartCameraCapture from './components/SmartCameraCapture';
import UltraSimpleCamera from './components/UltraSimpleCamera';
import BrowserInfo from './components/BrowserInfo';
import CameraSwitcher from './components/CameraSwitcher';

type TabType = 'camera' | 'dashboard' | 'records' | 'test' | 'smart' | 'ultra' | 'info' | 'switcher';

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
      case 'ultra':
        return <UltraSimpleCamera />;
      case 'info':
        return <BrowserInfo />;
      case 'switcher':
        return <CameraSwitcher />;
      default:
        return <CameraSwitcher />;
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>🚗 駐車場管理システム</h1>
        <div className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === 'switcher' ? 'active' : ''}`}
            onClick={() => setActiveTab('switcher')}
          >
            📷 カメラ選択
          </button>
          <button 
            className={`tab-btn ${activeTab === 'ultra' ? 'active' : ''}`}
            onClick={() => setActiveTab('ultra')}
          >
            🔬 デバッグ
          </button>
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
          <button 
            className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            📊 環境情報
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
