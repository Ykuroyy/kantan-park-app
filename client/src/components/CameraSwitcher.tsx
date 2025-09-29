import React, { useState, useRef, useEffect } from 'react';

interface CameraDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

const CameraSwitcher: React.FC = () => {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage]);
  };

  // カメラデバイス一覧を取得
  const getDevices = async () => {
    try {
      addLog('カメラデバイス一覧を取得中...');
      
      // まず基本的な権限を取得
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // すぐに停止
      
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      
      const cameraDevices: CameraDevice[] = videoDevices.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `カメラ ${device.deviceId.slice(0, 8)}`,
        groupId: device.groupId
      }));
      
      setDevices(cameraDevices);
      addLog(`${cameraDevices.length}個のカメラデバイスを検出`);
      
      // 背面カメラを自動選択（トリプルカメラを優先）
      const backCamera = cameraDevices.find(d => 
        d.label.includes('トリプル') || 
        d.label.includes('背面') ||
        d.label.includes('メイン')
      ) || cameraDevices.find(d => !d.label.includes('前面'));
      
      if (backCamera) {
        setSelectedDeviceId(backCamera.deviceId);
        addLog(`背面カメラを自動選択: ${backCamera.label}`);
      }
      
    } catch (error) {
      addLog(`デバイス取得エラー: ${error}`);
    }
  };

  // 指定されたカメラでストリーミング開始
  const startCamera = async (deviceId?: string) => {
    try {
      const targetDeviceId = deviceId || selectedDeviceId;
      if (!targetDeviceId) {
        addLog('❌ カメラが選択されていません');
        return;
      }

      // 現在のストリームを停止
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        setCurrentStream(null);
      }

      const device = devices.find(d => d.deviceId === targetDeviceId);
      addLog(`カメラ起動開始: ${device?.label}`);

      // 指定されたデバイスでストリーミング開始
      const constraints = {
        video: {
          deviceId: { exact: targetDeviceId },
          width: { ideal: 1920, max: 4096 },
          height: { ideal: 1080, max: 2160 }
        }
      };

      addLog(`制約: ${JSON.stringify(constraints)}`);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      addLog('✅ ストリーム取得成功');
      addLog(`ストリームID: ${stream.id}`);
      
      // ビデオトラック情報を表示
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        addLog(`実際の設定: ${JSON.stringify(settings)}`);
        addLog(`解像度: ${settings.width}x${settings.height}`);
        addLog(`フレームレート: ${settings.frameRate}fps`);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCurrentStream(stream);
        
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                addLog('✅ ビデオ再生成功');
                setIsStreaming(true);
              })
              .catch(error => {
                addLog(`❌ 再生エラー: ${error}`);
              });
          }
        };
      }
      
    } catch (error: any) {
      addLog(`❌ カメラ起動エラー: ${error.name} - ${error.message}`);
      
      if (error.name === 'OverconstrainedError') {
        addLog('💡 このカメラは指定された解像度をサポートしていません');
        // フォールバック: 基本設定で再試行
        try {
          addLog('フォールバック: 基本設定で再試行');
          const basicConstraints = {
            video: { deviceId: { exact: deviceId || selectedDeviceId } }
          };
          const stream = await navigator.mediaDevices.getUserMedia(basicConstraints);
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setCurrentStream(stream);
            setIsStreaming(true);
            addLog('✅ フォールバック成功');
          }
        } catch (fallbackError) {
          addLog(`❌ フォールバックも失敗: ${fallbackError}`);
        }
      }
    }
  };

  // カメラ停止
  const stopCamera = () => {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      setCurrentStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    addLog('カメラ停止');
  };

  // 初期化
  useEffect(() => {
    getDevices();
  }, []);

  // カメラ推奨度を計算（背面カメラを優先）
  const getCameraPriority = (label: string): number => {
    if (label.includes('トリプル')) return 5;
    if (label.includes('デュアル広角')) return 4;
    if (label.includes('背面') && !label.includes('超広角') && !label.includes('望遠')) return 3;
    if (label.includes('超広角')) return 2;
    if (label.includes('望遠')) return 1;
    return 0; // 前面カメラ
  };

  // カメラを推奨順にソート
  const sortedDevices = [...devices].sort((a, b) => 
    getCameraPriority(b.label) - getCameraPriority(a.label)
  );

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>📷 カメラ切り替え（背面カメラ対応）</h2>
      
      {/* カメラ選択 */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <h3>📱 利用可能なカメラ</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          {sortedDevices.map((device) => {
            const priority = getCameraPriority(device.label);
            const isRecommended = priority >= 3;
            
            return (
              <div 
                key={device.deviceId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px',
                  border: selectedDeviceId === device.deviceId ? '2px solid #007bff' : '1px solid #dee2e6',
                  borderRadius: '6px',
                  backgroundColor: selectedDeviceId === device.deviceId ? '#e7f3ff' : 'white',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedDeviceId(device.deviceId)}
              >
                <input
                  type="radio"
                  checked={selectedDeviceId === device.deviceId}
                  onChange={() => setSelectedDeviceId(device.deviceId)}
                  style={{ marginRight: '10px' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {device.label}
                    {isRecommended && (
                      <span style={{ 
                        backgroundColor: '#28a745', 
                        color: 'white', 
                        fontSize: '12px', 
                        padding: '2px 6px', 
                        borderRadius: '10px' 
                      }}>
                        推奨
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    ID: {device.deviceId.slice(0, 16)}...
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div style={{ marginTop: '15px', textAlign: 'center' }}>
          <button
            onClick={() => getDevices()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            🔄 デバイス再検索
          </button>
          
          {!isStreaming ? (
            <button
              onClick={() => startCamera()}
              disabled={!selectedDeviceId}
              style={{
                padding: '12px 24px',
                backgroundColor: selectedDeviceId ? '#007bff' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: selectedDeviceId ? 'pointer' : 'not-allowed',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              📷 選択されたカメラで起動
            </button>
          ) : (
            <button
              onClick={stopCamera}
              style={{
                padding: '12px 24px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              ⏹️ カメラ停止
            </button>
          )}
        </div>
      </div>

      {/* ビデオ表示エリア */}
      <div style={{
        marginBottom: '20px',
        border: '3px solid #dee2e6',
        borderRadius: '12px',
        overflow: 'hidden',
        backgroundColor: '#000'
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            minHeight: isStreaming ? 'auto' : '300px'
          }}
        />
        {!isStreaming && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
            textAlign: 'center',
            fontSize: '18px'
          }}>
            📷 カメラを選択して起動してください
          </div>
        )}
      </div>

      {/* クイック切り替えボタン */}
      {devices.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4>🚀 クイック切り替え</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {sortedDevices.slice(0, 5).map((device) => {
              const isActive = isStreaming && selectedDeviceId === device.deviceId;
              const isRecommended = getCameraPriority(device.label) >= 3;
              
              return (
                <button
                  key={device.deviceId}
                  onClick={() => {
                    setSelectedDeviceId(device.deviceId);
                    startCamera(device.deviceId);
                  }}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 
                      isActive ? '#28a745' : 
                      isRecommended ? '#007bff' : '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    position: 'relative'
                  }}
                >
                  {device.label.length > 15 ? 
                    device.label.substring(0, 15) + '...' : 
                    device.label
                  }
                  {isRecommended && (
                    <div style={{
                      position: 'absolute',
                      top: '-5px',
                      right: '-5px',
                      backgroundColor: '#ffc107',
                      color: '#000',
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      fontSize: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      ★
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ログ表示 */}
      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        padding: '15px',
        maxHeight: '300px',
        overflowY: 'auto'
      }}>
        <h4>📋 カメラ切り替えログ</h4>
        {logs.length === 0 ? (
          <p style={{ color: '#6c757d' }}>ログはまだありません</p>
        ) : (
          <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
            {logs.map((log, index) => (
              <div
                key={index}
                style={{
                  margin: '2px 0',
                  padding: '2px 4px',
                  borderRadius: '2px',
                  backgroundColor:
                    log.includes('❌') ? '#f8d7da' :
                    log.includes('✅') ? '#d4edda' :
                    log.includes('💡') ? '#fff3cd' : 'transparent',
                  color:
                    log.includes('❌') ? '#721c24' :
                    log.includes('✅') ? '#155724' :
                    log.includes('💡') ? '#856404' : '#495057',
                  wordBreak: 'break-word'
                }}
              >
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraSwitcher;