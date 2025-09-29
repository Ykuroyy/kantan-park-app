import React, { useState, useRef, useEffect } from 'react';

const CameraTest: React.FC = () => {
  const [status, setStatus] = useState<string>('未開始');
  const [logs, setLogs] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage]);
  };

  // デバイス情報取得
  const getDevices = async () => {
    try {
      addLog('デバイス一覧を取得中...');
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      setDevices(deviceList);
      
      const videoDevices = deviceList.filter(device => device.kind === 'videoinput');
      addLog(`利用可能なカメラ: ${videoDevices.length}個`);
      
      videoDevices.forEach((device, index) => {
        addLog(`カメラ${index + 1}: ${device.label || 'Unknown Camera'} (${device.deviceId})`);
      });
    } catch (error) {
      addLog(`デバイス取得エラー: ${error}`);
    }
  };

  // 環境チェック
  const checkEnvironment = () => {
    addLog('=== 環境チェック開始 ===');
    
    // ブラウザ情報
    addLog(`ユーザーエージェント: ${navigator.userAgent}`);
    addLog(`プロトコル: ${window.location.protocol}`);
    addLog(`ホスト: ${window.location.host}`);
    
    // MediaDevices対応チェック
    if (!navigator.mediaDevices) {
      addLog('❌ navigator.mediaDevices が利用できません');
      setStatus('❌ ブラウザ非対応');
      return false;
    }
    addLog('✅ navigator.mediaDevices 対応');
    
    // getUserMedia対応チェック
    if (!navigator.mediaDevices.getUserMedia) {
      addLog('❌ getUserMedia が利用できません');
      setStatus('❌ getUserMedia非対応');
      return false;
    }
    addLog('✅ getUserMedia 対応');
    
    // HTTPS チェック
    const isSecure = window.location.protocol === 'https:' || 
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';
    
    if (!isSecure) {
      addLog('❌ HTTPS環境ではありません');
      setStatus('❌ HTTPS必須');
      return false;
    }
    addLog('✅ セキュア環境');
    
    addLog('=== 環境チェック完了 ===');
    setStatus('✅ 環境OK');
    return true;
  };

  // 基本的なカメラアクセステスト
  const testBasicCamera = async () => {
    try {
      addLog('基本カメラアクセステスト開始...');
      setStatus('📱 基本カメラテスト中');
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      addLog('✅ 基本カメラアクセス成功');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                addLog('✅ ビデオ再生成功');
                setIsStreaming(true);
                setStatus('✅ カメラ動作中');
              })
              .catch(error => {
                addLog(`❌ ビデオ再生失敗: ${error.message}`);
                setStatus('❌ 再生失敗');
              });
          }
        };
      }
    } catch (error: any) {
      addLog(`❌ 基本カメラアクセス失敗: ${error.name} - ${error.message}`);
      setStatus('❌ カメラアクセス失敗');
    }
  };

  // バックカメラテスト
  const testBackCamera = async () => {
    try {
      addLog('バックカメラテスト開始...');
      setStatus('📱 バックカメラテスト中');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      addLog('✅ バックカメラアクセス成功');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
        setStatus('✅ バックカメラ動作中');
      }
    } catch (error: any) {
      addLog(`❌ バックカメラアクセス失敗: ${error.name} - ${error.message}`);
      setStatus('❌ バックカメラ失敗');
    }
  };

  // フロントカメラテスト
  const testFrontCamera = async () => {
    try {
      addLog('フロントカメラテスト開始...');
      setStatus('📱 フロントカメラテスト中');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      addLog('✅ フロントカメラアクセス成功');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
        setStatus('✅ フロントカメラ動作中');
      }
    } catch (error: any) {
      addLog(`❌ フロントカメラアクセス失敗: ${error.name} - ${error.message}`);
      setStatus('❌ フロントカメラ失敗');
    }
  };

  // カメラ停止
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
    setStatus('⏹️ 停止済み');
    addLog('カメラを停止しました');
  };

  // ログクリア
  const clearLogs = () => {
    setLogs([]);
    setStatus('未開始');
  };

  // 初期化
  useEffect(() => {
    addLog('カメラテストコンポーネント初期化');
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>📱 スマホカメラテスト</h2>
      
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <strong>現在の状態: </strong>
        <span style={{ 
          padding: '4px 8px', 
          borderRadius: '4px', 
          backgroundColor: status.includes('✅') ? '#d4edda' : status.includes('❌') ? '#f8d7da' : '#fff3cd'
        }}>
          {status}
        </span>
      </div>

      {/* テストボタン */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={checkEnvironment}
          style={{ padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          🔍 環境チェック
        </button>
        
        <button 
          onClick={getDevices}
          style={{ padding: '10px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          📋 デバイス一覧
        </button>
        
        <button 
          onClick={testBasicCamera}
          style={{ padding: '10px 15px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          📱 基本カメラ
        </button>
        
        <button 
          onClick={testBackCamera}
          style={{ padding: '10px 15px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '5px' }}
        >
          📷 バックカメラ
        </button>
        
        <button 
          onClick={testFrontCamera}
          style={{ padding: '10px 15px', backgroundColor: '#fd7e14', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          🤳 フロントカメラ
        </button>
        
        {isStreaming && (
          <button 
            onClick={stopCamera}
            style={{ padding: '10px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px' }}
          >
            ⏹️ 停止
          </button>
        )}
        
        <button 
          onClick={clearLogs}
          style={{ padding: '10px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          🗑️ ログクリア
        </button>
      </div>

      {/* カメラビュー */}
      <div style={{ marginBottom: '20px' }}>
        {isStreaming ? (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline
            muted
            style={{
              width: '100%',
              maxHeight: '400px',
              borderRadius: '8px',
              backgroundColor: '#000',
              border: '2px solid #28a745'
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '300px',
            backgroundColor: '#e9ecef',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            border: '2px dashed #6c757d'
          }}>
            <p>📷 カメラ待機中</p>
          </div>
        )}
      </div>

      {/* デバイス情報 */}
      {devices.length > 0 && (
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '8px' }}>
          <h4>📋 検出されたデバイス</h4>
          {devices.map((device, index) => (
            <div key={device.deviceId} style={{ margin: '5px 0', fontSize: '14px' }}>
              <strong>{device.kind}:</strong> {device.label || `Device ${index + 1}`}
              <br />
              <small style={{ color: '#6c757d' }}>ID: {device.deviceId}</small>
            </div>
          ))}
        </div>
      )}

      {/* ログ表示 */}
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        border: '1px solid #dee2e6', 
        borderRadius: '8px', 
        padding: '15px',
        maxHeight: '400px',
        overflowY: 'auto'
      }}>
        <h4>📜 実行ログ</h4>
        {logs.length === 0 ? (
          <p style={{ color: '#6c757d' }}>ログはまだありません</p>
        ) : (
          <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
            {logs.map((log, index) => (
              <div key={index} style={{ 
                margin: '2px 0', 
                wordBreak: 'break-all',
                color: log.includes('❌') ? '#dc3545' : log.includes('✅') ? '#28a745' : '#333'
              }}>
                {log}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#6c757d' }}>
        <p><strong>💡 使い方:</strong></p>
        <ol>
          <li>「🔍 環境チェック」でブラウザ対応確認</li>
          <li>「📋 デバイス一覧」でカメラデバイス確認</li>
          <li>各カメラボタンでテスト実行</li>
          <li>ログでエラー詳細を確認</li>
        </ol>
      </div>
    </div>
  );
};

export default CameraTest;