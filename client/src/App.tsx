import React, { useState } from 'react';
import './App.css';
import ParkingDashboard from './components/ParkingDashboard';
import ParkingRecords from './components/ParkingRecords';
import BrowserInfo from './components/BrowserInfo';
import CameraSwitcher from './components/CameraSwitcher';

type TabType = 'dashboard' | 'records' | 'info' | 'switcher';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('switcher');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <ParkingDashboard />;
      case 'records':
        return <ParkingRecords />;
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
            📷 撮影・記録
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
