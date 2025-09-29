import React, { useState, useEffect } from 'react';

const BrowserInfo: React.FC = () => {
  const [browserInfo, setBrowserInfo] = useState<any>({});

  useEffect(() => {
    const gatherBrowserInfo = () => {
      const info: any = {
        // 基本情報
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        
        // 画面情報
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        colorDepth: window.screen.colorDepth,
        pixelDepth: window.screen.pixelDepth,
        
        // ウィンドウ情報
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        
        // URL情報
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        port: window.location.port,
        pathname: window.location.pathname,
        
        // 機能チェック
        hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        hasEnumerateDevices: !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices),
        hasPermissions: 'permissions' in navigator,
        hasServiceWorker: 'serviceWorker' in navigator,
        hasWebRTC: 'RTCPeerConnection' in window,
        
        // 日時
        timestamp: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      // デバイス情報推測
      const ua = navigator.userAgent;
      info.isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      info.isIOS = /iPad|iPhone|iPod/.test(ua);
      info.isAndroid = /Android/.test(ua);
      info.isChrome = /Chrome/.test(ua) && !/Edge/.test(ua);
      info.isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
      info.isFirefox = /Firefox/.test(ua);
      info.isEdge = /Edge/.test(ua);

      // ブラウザ名と推定バージョン
      if (info.isChrome) {
        const match = ua.match(/Chrome\/(\d+)/);
        info.browserName = 'Chrome';
        info.browserVersion = match ? match[1] : 'Unknown';
      } else if (info.isSafari) {
        const match = ua.match(/Version\/(\d+)/);
        info.browserName = 'Safari';
        info.browserVersion = match ? match[1] : 'Unknown';
      } else if (info.isFirefox) {
        const match = ua.match(/Firefox\/(\d+)/);
        info.browserName = 'Firefox';
        info.browserVersion = match ? match[1] : 'Unknown';
      } else if (info.isEdge) {
        const match = ua.match(/Edge\/(\d+)/);
        info.browserName = 'Edge';
        info.browserVersion = match ? match[1] : 'Unknown';
      } else {
        info.browserName = 'Unknown';
        info.browserVersion = 'Unknown';
      }

      setBrowserInfo(info);
    };

    gatherBrowserInfo();
  }, []);

  const InfoRow: React.FC<{ label: string; value: any; type?: 'good' | 'bad' | 'warning' | 'normal' }> = ({ 
    label, 
    value, 
    type = 'normal' 
  }) => {
    const colors: Record<string, { bg: string; color: string }> = {
      good: { bg: '#d4edda', color: '#155724' },
      bad: { bg: '#f8d7da', color: '#721c24' },
      warning: { bg: '#fff3cd', color: '#856404' },
      normal: { bg: '#f8f9fa', color: '#495057' }
    };

    const style = colors[type] || colors.normal;

    return (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 12px',
        margin: '2px 0',
        backgroundColor: style.bg,
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <strong style={{ color: style.color }}>{label}:</strong>
        <span style={{ color: style.color, wordBreak: 'break-all', maxWidth: '60%', textAlign: 'right' }}>
          {typeof value === 'boolean' ? (value ? '✅ はい' : '❌ いいえ') : String(value)}
        </span>
      </div>
    );
  };

  const copyToClipboard = () => {
    const text = Object.entries(browserInfo)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
      alert('ブラウザ情報をクリップボードにコピーしました');
    }).catch(() => {
      alert('クリップボードへのコピーに失敗しました');
    });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📊 ブラウザ・デバイス情報</h2>
        <button 
          onClick={copyToClipboard}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          📋 コピー
        </button>
      </div>

      {/* 基本環境情報 */}
      <div style={{ marginBottom: '20px' }}>
        <h3>🌐 基本環境</h3>
        <InfoRow label="ブラウザ" value={`${browserInfo.browserName} ${browserInfo.browserVersion}`} />
        <InfoRow label="OS/Platform" value={browserInfo.platform} />
        <InfoRow label="モバイル" value={browserInfo.isMobile} type={browserInfo.isMobile ? 'warning' : 'normal'} />
        <InfoRow label="iOS" value={browserInfo.isIOS} />
        <InfoRow label="Android" value={browserInfo.isAndroid} />
        <InfoRow label="言語" value={`${browserInfo.language} (対応: ${browserInfo.languages?.join(', ')})`} />
        <InfoRow label="タイムゾーン" value={browserInfo.timezone} />
      </div>

      {/* セキュリティ・プロトコル */}
      <div style={{ marginBottom: '20px' }}>
        <h3>🔒 セキュリティ</h3>
        <InfoRow 
          label="プロトコル" 
          value={browserInfo.protocol} 
          type={browserInfo.protocol === 'https:' ? 'good' : 'bad'} 
        />
        <InfoRow label="ホスト" value={browserInfo.hostname} />
        <InfoRow label="ポート" value={browserInfo.port || 'デフォルト'} />
        <InfoRow 
          label="Cookie" 
          value={browserInfo.cookieEnabled} 
          type={browserInfo.cookieEnabled ? 'good' : 'bad'} 
        />
        <InfoRow 
          label="オンライン状態" 
          value={browserInfo.onLine} 
          type={browserInfo.onLine ? 'good' : 'bad'} 
        />
      </div>

      {/* カメラ・メディア対応 */}
      <div style={{ marginBottom: '20px' }}>
        <h3>📷 カメラ・メディア対応</h3>
        <InfoRow 
          label="getUserMedia" 
          value={browserInfo.hasGetUserMedia} 
          type={browserInfo.hasGetUserMedia ? 'good' : 'bad'} 
        />
        <InfoRow 
          label="enumerateDevices" 
          value={browserInfo.hasEnumerateDevices} 
          type={browserInfo.hasEnumerateDevices ? 'good' : 'bad'} 
        />
        <InfoRow 
          label="Permissions API" 
          value={browserInfo.hasPermissions} 
          type={browserInfo.hasPermissions ? 'good' : 'warning'} 
        />
        <InfoRow 
          label="WebRTC" 
          value={browserInfo.hasWebRTC} 
          type={browserInfo.hasWebRTC ? 'good' : 'warning'} 
        />
      </div>

      {/* 画面・ディスプレイ情報 */}
      <div style={{ marginBottom: '20px' }}>
        <h3>🖥️ 画面情報</h3>
        <InfoRow label="画面解像度" value={`${browserInfo.screenWidth} × ${browserInfo.screenHeight}`} />
        <InfoRow label="利用可能サイズ" value={`${browserInfo.availWidth} × ${browserInfo.availHeight}`} />
        <InfoRow label="ウィンドウサイズ" value={`${browserInfo.windowWidth} × ${browserInfo.windowHeight}`} />
        <InfoRow label="ピクセル比" value={browserInfo.devicePixelRatio} />
        <InfoRow label="色深度" value={`${browserInfo.colorDepth}bit`} />
      </div>

      {/* カメラ問題の診断結果 */}
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#e7f3ff', 
        borderRadius: '8px',
        border: '2px solid #007bff'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#0056b3' }}>🔍 カメラ問題診断</h3>
        
        {/* HTTPS チェック */}
        {browserInfo.protocol !== 'https:' && (
          <div style={{ 
            padding: '10px', 
            backgroundColor: '#f8d7da', 
            borderRadius: '4px', 
            marginBottom: '10px',
            color: '#721c24'
          }}>
            ❌ <strong>HTTPS必須:</strong> カメラ機能はHTTPS環境でのみ動作します。
          </div>
        )}

        {/* ブラウザ対応チェック */}
        {!browserInfo.hasGetUserMedia && (
          <div style={{ 
            padding: '10px', 
            backgroundColor: '#f8d7da', 
            borderRadius: '4px', 
            marginBottom: '10px',
            color: '#721c24'
          }}>
            ❌ <strong>ブラウザ非対応:</strong> このブラウザはカメラ機能をサポートしていません。
          </div>
        )}

        {/* iOS Safari の制限 */}
        {browserInfo.isIOS && browserInfo.isSafari && (
          <div style={{ 
            padding: '10px', 
            backgroundColor: '#fff3cd', 
            borderRadius: '4px', 
            marginBottom: '10px',
            color: '#856404'
          }}>
            ⚠️ <strong>iOS Safari:</strong> ユーザー操作後にのみカメラアクセス可能。プライベートブラウジングでは制限あり。
          </div>
        )}

        {/* 推奨対処法 */}
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#d4edda', 
          borderRadius: '4px',
          color: '#155724'
        }}>
          <strong>💡 推奨対処法:</strong>
          <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
            <li>ブラウザでカメラアクセス許可を確認</li>
            <li>他のカメラアプリを閉じる</li>
            <li>ページを更新して再試行</li>
            <li>Chrome または Firefox の最新版を使用</li>
            {browserInfo.isMobile && <li>「ファイルから選択」で代替利用</li>}
          </ul>
        </div>
      </div>

      {/* 詳細なUserAgent */}
      <div style={{ marginTop: '20px' }}>
        <h3>🔍 詳細情報</h3>
        <div style={{
          padding: '10px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '12px',
          wordBreak: 'break-all',
          border: '1px solid #dee2e6'
        }}>
          <strong>User Agent:</strong><br />
          {browserInfo.userAgent}
        </div>
      </div>
    </div>
  );
};

export default BrowserInfo;