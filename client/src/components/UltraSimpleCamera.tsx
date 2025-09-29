import React, { useState, useRef } from 'react';

const UltraSimpleCamera: React.FC = () => {
  const [status, setStatus] = useState<string>('待機中');
  const [logs, setLogs] = useState<string[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage]);
  };

  const startUltraSimpleCamera = async () => {
    addLog('=== 超シンプルカメラテスト開始 ===');
    setStatus('🔄 テスト中');
    
    try {
      // Step 1: 基本チェック
      addLog('Step 1: navigator.mediaDevices チェック');
      if (!navigator.mediaDevices) {
        throw new Error('navigator.mediaDevices が利用できません');
      }
      addLog('✅ navigator.mediaDevices OK');

      // Step 2: getUserMedia チェック
      addLog('Step 2: getUserMedia チェック');
      if (!navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia が利用できません');
      }
      addLog('✅ getUserMedia OK');

      // Step 3: 最もシンプルな設定でカメラアクセス
      addLog('Step 3: 最シンプル設定でカメラアクセス');
      addLog('制約: { video: true }');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true 
      });
      
      addLog('✅ カメラストリーム取得成功');
      addLog(`ストリームID: ${mediaStream.id}`);
      addLog(`トラック数: ${mediaStream.getTracks().length}`);
      
      // Step 4: ビデオトラック情報
      const videoTracks = mediaStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const track = videoTracks[0];
        addLog(`ビデオトラック: ${track.label}`);
        addLog(`トラック状態: ${track.readyState}`);
        addLog(`設定: ${JSON.stringify(track.getSettings())}`);
      }

      // Step 5: ビデオ要素に割り当て
      addLog('Step 5: ビデオ要素にストリーム割り当て');
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        
        // Step 6: 再生開始
        addLog('Step 6: ビデオ再生開始');
        
        // loadedmetadataイベント待ち
        videoRef.current.onloadedmetadata = () => {
          addLog('✅ メタデータ読み込み完了');
          if (videoRef.current) {
            const video = videoRef.current;
            addLog(`ビデオ解像度: ${video.videoWidth}x${video.videoHeight}`);
            
            video.play()
              .then(() => {
                addLog('✅ ビデオ再生成功');
                setStatus('✅ カメラ動作中');
              })
              .catch(error => {
                addLog(`❌ ビデオ再生失敗: ${error.message}`);
                setStatus('❌ 再生失敗');
              });
          }
        };

        videoRef.current.onerror = (error) => {
          addLog(`❌ ビデオエラー: ${error}`);
          setStatus('❌ ビデオエラー');
        };

        // 既にメタデータが読み込まれている場合
        if (videoRef.current.readyState >= 1) {
          addLog('メタデータ既読み込み済み - 即座に再生');
          videoRef.current.play();
        }
      } else {
        throw new Error('ビデオ要素が見つかりません');
      }

    } catch (error: any) {
      addLog(`❌ エラー発生: ${error.name || 'Unknown'}`);
      addLog(`❌ エラーメッセージ: ${error.message}`);
      addLog(`❌ エラー詳細: ${JSON.stringify(error)}`);
      setStatus(`❌ エラー: ${error.message}`);

      // 具体的なエラー対処法
      if (error.name === 'NotAllowedError') {
        addLog('💡 対処法: ブラウザでカメラアクセスを許可してください');
      } else if (error.name === 'NotFoundError') {
        addLog('💡 対処法: カメラデバイスが接続されているか確認してください');
      } else if (error.name === 'NotReadableError') {
        addLog('💡 対処法: 他のアプリでカメラを使用している場合は閉じてください');
      }
    }
  };

  const stopCamera = () => {
    addLog('カメラ停止処理開始');
    if (stream) {
      stream.getTracks().forEach(track => {
        addLog(`トラック停止: ${track.kind} - ${track.label}`);
        track.stop();
      });
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setStatus('⏹️ 停止');
    addLog('カメラ停止完了');
  };

  const clearLogs = () => {
    setLogs([]);
    setStatus('待機中');
  };

  // 権限状態チェック
  const checkPermissions = async () => {
    addLog('=== 権限状態チェック ===');
    
    try {
      if ('permissions' in navigator) {
        const result = await (navigator as any).permissions.query({ name: 'camera' });
        addLog(`カメラ権限状態: ${result.state}`);
        
        if (result.state === 'denied') {
          addLog('❌ カメラ権限が拒否されています');
          addLog('💡 ブラウザ設定でカメラアクセスを許可してください');
        } else if (result.state === 'granted') {
          addLog('✅ カメラ権限が許可されています');
        } else {
          addLog('⚠️ カメラ権限が未決定です（初回アクセス時に確認されます）');
        }
      } else {
        addLog('⚠️ 権限APIが利用できません');
      }
    } catch (error) {
      addLog(`権限チェックエラー: ${error}`);
    }
  };

  // デバイス情報取得
  const getDeviceInfo = async () => {
    addLog('=== デバイス情報取得 ===');
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      
      addLog(`総デバイス数: ${devices.length}`);
      addLog(`カメラデバイス数: ${cameras.length}`);
      
      cameras.forEach((camera, index) => {
        addLog(`カメラ${index + 1}: ${camera.label || 'Unknown'}`);
        addLog(`  デバイスID: ${camera.deviceId}`);
        addLog(`  グループID: ${camera.groupId}`);
      });
      
      if (cameras.length === 0) {
        addLog('❌ カメラデバイスが見つかりません');
      }
    } catch (error) {
      addLog(`デバイス情報取得エラー: ${error}`);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h2>🔬 超シンプルカメラテスト</h2>
      
      <div style={{ 
        padding: '15px', 
        marginBottom: '20px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px',
        border: '2px solid #dee2e6'
      }}>
        <strong>現在の状態: </strong>
        <span style={{ 
          padding: '4px 8px', 
          borderRadius: '4px', 
          backgroundColor: 
            status.includes('✅') ? '#d4edda' : 
            status.includes('❌') ? '#f8d7da' : 
            status.includes('🔄') ? '#fff3cd' : '#e9ecef',
          color: 
            status.includes('✅') ? '#155724' : 
            status.includes('❌') ? '#721c24' : 
            status.includes('🔄') ? '#856404' : '#495057'
        }}>
          {status}
        </span>
      </div>

      {/* 操作ボタン */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '10px', 
        marginBottom: '20px' 
      }}>
        <button 
          onClick={checkPermissions}
          style={{ 
            padding: '15px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          🔒 権限チェック
        </button>
        
        <button 
          onClick={getDeviceInfo}
          style={{ 
            padding: '15px', 
            backgroundColor: '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          📱 デバイス情報
        </button>
        
        <button 
          onClick={startUltraSimpleCamera}
          style={{ 
            padding: '15px', 
            backgroundColor: '#17a2b8', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          🚀 カメラ開始
        </button>
        
        {stream && (
          <button 
            onClick={stopCamera}
            style={{ 
              padding: '15px', 
              backgroundColor: '#dc3545', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            ⏹️ カメラ停止
          </button>
        )}
        
        <button 
          onClick={clearLogs}
          style={{ 
            padding: '15px', 
            backgroundColor: '#6c757d', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          🗑️ ログクリア
        </button>
      </div>

      {/* カメラ表示エリア */}
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
            minHeight: '300px'
          }}
        />
      </div>

      {/* ログ表示エリア */}
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        border: '2px solid #dee2e6', 
        borderRadius: '8px', 
        padding: '15px',
        maxHeight: '400px',
        overflowY: 'auto'
      }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>📋 実行ログ</h4>
        {logs.length === 0 ? (
          <p style={{ color: '#6c757d', fontStyle: 'italic' }}>
            まだログがありません。上のボタンを押してテストを開始してください。
          </p>
        ) : (
          <div style={{ fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.4' }}>
            {logs.map((log, index) => (
              <div 
                key={index} 
                style={{ 
                  margin: '3px 0', 
                  padding: '3px 6px',
                  borderRadius: '3px',
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

      {/* 使い方説明 */}
      <div style={{ 
        marginTop: '20px', 
        padding: '15px',
        backgroundColor: '#e7f3ff',
        borderRadius: '8px',
        fontSize: '14px',
        lineHeight: '1.6'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#0056b3' }}>🔍 テスト手順</h4>
        <ol style={{ margin: 0, paddingLeft: '20px' }}>
          <li><strong>🔒 権限チェック</strong> - カメラアクセス権限の状態を確認</li>
          <li><strong>📱 デバイス情報</strong> - 利用可能なカメラデバイスを確認</li>
          <li><strong>🚀 カメラ開始</strong> - 実際にカメラアクセスをテスト</li>
          <li><strong>📋 ログ確認</strong> - 詳細な実行ログで問題を特定</li>
        </ol>
        <p style={{ margin: '10px 0 0 0', color: '#0056b3' }}>
          <strong>💡 ヒント:</strong> エラーが発生した場合、ログの「💡 対処法」を確認してください。
        </p>
      </div>
    </div>
  );
};

export default UltraSimpleCamera;