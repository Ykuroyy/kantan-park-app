import React, { useState, useRef, useEffect } from 'react';
import { createWorker } from 'tesseract.js';

interface CameraDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

interface CapturedPhoto {
  id: string;
  timestamp: string;
  imageData: string;
  ocrText?: string;
  cameraLabel: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  suggestedSpot?: number;
  autoDetected?: boolean;
}

interface ParkingSpot {
  id: number;
  latitude: number;
  longitude: number;
  name: string;
  isOccupied?: boolean;
}

const CameraSwitcher: React.FC = () => {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrWorker, setOcrWorker] = useState<any>(null);
  const [locationPermission, setLocationPermission] = useState<PermissionState | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GeolocationPosition | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // サンプル駐車スポット位置データ（実際のホテルでは正確な座標を設定）
  const parkingSpots: ParkingSpot[] = Array.from({length: 100}, (_, i) => ({
    id: i + 1,
    // デモ用：東京駅周辺の座標に小さなオフセットを付けて100個のスポットを生成
    latitude: 35.6812 + (Math.floor(i / 10) * 0.0001) + ((i % 10) * 0.0001),
    longitude: 139.7671 + (Math.floor(i / 10) * 0.0001) + ((i % 10) * 0.0001),
    name: `駐車スポット ${i + 1}`,
    isOccupied: false
  }));

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage]);
  };

  // 2点間の距離を計算（ハーバーサイン公式）
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // 地球の半径（メートル）
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // 距離（メートル）
  };

  // 最寄りの駐車スポットを検索
  const findNearestParkingSpot = (latitude: number, longitude: number): ParkingSpot | null => {
    let nearestSpot: ParkingSpot | null = null;
    let minDistance = Infinity;

    for (const spot of parkingSpots) {
      const distance = calculateDistance(latitude, longitude, spot.latitude, spot.longitude);
      if (distance < minDistance) {
        minDistance = distance;
        nearestSpot = spot;
      }
    }

    addLog(`📍 最寄り駐車スポット: ${nearestSpot?.name} (距離: ${Math.round(minDistance)}m)`);
    return nearestSpot;
  };

  // 位置情報取得
  const getCurrentLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('位置情報がサポートされていません'));
        return;
      }

      addLog('📍 位置情報を取得中...');
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          addLog(`✅ 位置情報取得成功: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)} (精度: ${Math.round(position.coords.accuracy)}m)`);
          setCurrentLocation(position);
          resolve(position);
        },
        (error) => {
          let errorMessage = '位置情報取得エラー: ';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += '位置情報の使用が拒否されました';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += '位置情報を取得できません';
              break;
            case error.TIMEOUT:
              errorMessage += '位置情報取得がタイムアウトしました';
              break;
            default:
              errorMessage += '不明なエラーが発生しました';
              break;
          }
          addLog(`❌ ${errorMessage}`);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  };

  // 位置情報権限確認
  const checkLocationPermission = async () => {
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      setLocationPermission(permission.state);
      addLog(`📍 位置情報権限: ${permission.state}`);
      
      if (permission.state === 'granted') {
        await getCurrentLocation();
      }
    } catch (error) {
      addLog(`❌ 位置情報権限確認エラー: ${error}`);
    }
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

  // OCRワーカー初期化
  const initOCRWorker = async () => {
    try {
      addLog('🔤 OCRワーカーを初期化中...');
      const worker = await createWorker('jpn+eng');
      
      // ナンバープレート認識に最適化
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZあいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'
      });
      
      setOcrWorker(worker);
      addLog('✅ OCRワーカー初期化完了（ナンバープレート最適化）');
    } catch (error) {
      addLog(`❌ OCRワーカー初期化エラー: ${error}`);
    }
  };

  // 写真撮影
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !isStreaming) {
      addLog('❌ カメラが起動していません');
      return;
    }

    try {
      setIsProcessing(true);
      addLog('📸 写真撮影開始');

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        addLog('❌ Canvas contextが取得できません');
        return;
      }

      // ビデオの実際のサイズを取得
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      // キャンバスサイズを設定
      canvas.width = videoWidth;
      canvas.height = videoHeight;

      // ビデオフレームをキャンバスに描画
      context.drawImage(video, 0, 0, videoWidth, videoHeight);

      // 画像データを取得
      const imageData = canvas.toDataURL('image/jpeg', 0.9);

      const currentDevice = devices.find(d => d.deviceId === selectedDeviceId);
      const photo: CapturedPhoto = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString(),
        imageData,
        cameraLabel: currentDevice?.label || '不明'
      };

      addLog(`✅ 写真撮影完了 (${videoWidth}x${videoHeight})`);

      // 位置情報を取得して最寄りスポットを自動判定
      try {
        const position = await getCurrentLocation();
        const { latitude, longitude, accuracy } = position.coords;
        
        photo.location = { latitude, longitude, accuracy };
        
        // 最寄りの駐車スポットを検索
        const nearestSpot = findNearestParkingSpot(latitude, longitude);
        if (nearestSpot) {
          photo.suggestedSpot = nearestSpot.id;
          photo.autoDetected = true;
          addLog(`🎯 自動検出: 駐車スポット${nearestSpot.id}を提案`);
        }
      } catch (locationError) {
        addLog(`⚠️ 位置情報取得失敗: 手動選択が必要です`);
        photo.autoDetected = false;
      }

      // OCR処理
      if (ocrWorker) {
        addLog('🔤 OCR処理開始...');
        try {
          const { data: { text } } = await ocrWorker.recognize(imageData);
          const cleanedText = text.replace(/\s+/g, ' ').trim();
          photo.ocrText = cleanedText;
          addLog(`✅ OCR完了: ${cleanedText.substring(0, 50)}${cleanedText.length > 50 ? '...' : ''}`);
        } catch (ocrError) {
          addLog(`❌ OCR処理エラー: ${ocrError}`);
        }
      } else {
        addLog('⚠️ OCRワーカーが初期化されていません');
      }

      // 写真を保存
      setCapturedPhotos(prev => [photo, ...prev]);
      addLog(`📷 写真を保存しました (ID: ${photo.id})`);

    } catch (error) {
      addLog(`❌ 写真撮影エラー: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 写真削除
  const deletePhoto = (photoId: string) => {
    setCapturedPhotos(prev => prev.filter(p => p.id !== photoId));
    addLog(`🗑️ 写真を削除しました (ID: ${photoId})`);
  };

  // 駐車記録として保存
  const saveParkingRecord = async (photo: CapturedPhoto, spotNumber: number) => {
    try {
      addLog(`💾 駐車記録保存開始 (スポット: ${spotNumber})`);

      // Base64からBlobに変換
      const response = await fetch(photo.imageData);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('image', blob, `parking_${photo.id}.jpg`);
      formData.append('spotNumber', spotNumber.toString());
      formData.append('licensePlate', photo.ocrText || '');
      formData.append('timestamp', photo.timestamp);
      formData.append('cameraInfo', photo.cameraLabel);

      const saveResponse = await fetch('/api/parking-records', {
        method: 'POST',
        body: formData
      });

      if (saveResponse.ok) {
        addLog(`✅ 駐車記録保存完了 (スポット: ${spotNumber})`);
      } else {
        addLog(`❌ 駐車記録保存エラー: ${saveResponse.statusText}`);
      }

    } catch (error) {
      addLog(`❌ 駐車記録保存エラー: ${error}`);
    }
  };

  // 初期化
  useEffect(() => {
    getDevices();
    initOCRWorker();
    checkLocationPermission();
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
      
      {/* 使用方法説明 */}
      <div style={{
        backgroundColor: '#e7f3ff',
        border: '1px solid #007bff',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#007bff' }}>📋 使用方法</h4>
        <ol style={{ margin: 0, paddingLeft: '20px' }}>
          <li><strong>カメラ起動</strong>: 背面トリプルカメラが自動選択されます</li>
          <li><strong>位置情報許可</strong>: 位置情報へのアクセスを許可してください</li>
          <li><strong>撮影</strong>: 赤い📸シャッターボタンをタップして撮影</li>
          <li><strong>自動位置検出</strong>: GPSで最寄りの駐車スポットを自動判定</li>
          <li><strong>OCR確認</strong>: ナンバープレートのテキストが自動読み取りされます</li>
          <li><strong>駐車場所確認</strong>: 自動選択されたスポットを確認（手動変更も可能）</li>
          <li><strong>自動保存</strong>: 場所選択と同時にサーバーに保存されます</li>
        </ol>
        <div style={{
          marginTop: '10px',
          fontSize: '12px',
          color: '#666',
          fontStyle: 'italic'
        }}>
          💡 ナンバープレートの例: 「品川 500 あ 12-34」「横浜 301 さ 56-78」
        </div>
      </div>

      {/* 位置情報状況 */}
      <div style={{
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: locationPermission === 'granted' ? '#d4edda' : '#fff3cd',
        border: `1px solid ${locationPermission === 'granted' ? '#c3e6cb' : '#ffeaa7'}`,
        borderRadius: '8px'
      }}>
        <h4 style={{ 
          margin: '0 0 10px 0', 
          color: locationPermission === 'granted' ? '#155724' : '#856404' 
        }}>
          📍 位置情報ステータス
        </h4>
        <div style={{ fontSize: '14px' }}>
          <div>
            <strong>権限:</strong> 
            <span style={{ marginLeft: '5px' }}>
              {locationPermission === 'granted' ? '✅ 許可済み' : 
               locationPermission === 'denied' ? '❌ 拒否' :
               locationPermission === 'prompt' ? '⏳ 確認待ち' : '🔍 確認中'}
            </span>
          </div>
          {currentLocation && (
            <div style={{ marginTop: '5px' }}>
              <strong>現在位置:</strong> {currentLocation.coords.latitude.toFixed(6)}, {currentLocation.coords.longitude.toFixed(6)}
              <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                精度: ±{Math.round(currentLocation.coords.accuracy)}m | 取得時刻: {new Date(currentLocation.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}
          {locationPermission !== 'granted' && (
            <div style={{ marginTop: '8px' }}>
              <button
                onClick={checkLocationPermission}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                📍 位置情報を許可する
              </button>
            </div>
          )}
        </div>
      </div>
      
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
        backgroundColor: '#000',
        position: 'relative'
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
        
        {/* シャッターボタン */}
        {isStreaming && (
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '15px',
            alignItems: 'center'
          }}>
            <button
              onClick={capturePhoto}
              disabled={isProcessing}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                border: '4px solid white',
                backgroundColor: isProcessing ? '#6c757d' : '#ff4757',
                color: 'white',
                fontSize: '24px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isProcessing ? '⏳' : '📸'}
            </button>
            {isProcessing && (
              <div style={{
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '5px 10px',
                borderRadius: '15px',
                fontSize: '12px'
              }}>
                処理中...
              </div>
            )}
          </div>
        )}
      </div>

      {/* 隠しキャンバス（写真撮影用） */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />

      {/* 撮影済み写真一覧 */}
      {capturedPhotos.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4>📷 撮影済み写真 ({capturedPhotos.length}枚)</h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '15px',
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '10px',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            backgroundColor: '#f8f9fa'
          }}>
            {capturedPhotos.map((photo) => (
              <div
                key={photo.id}
                style={{
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  padding: '10px',
                  backgroundColor: 'white'
                }}
              >
                <img
                  src={photo.imageData}
                  alt={`撮影 ${photo.timestamp}`}
                  style={{
                    width: '100%',
                    height: 'auto',
                    borderRadius: '4px',
                    marginBottom: '8px'
                  }}
                />
                <div style={{ fontSize: '12px', color: '#666' }}>
                  <div><strong>撮影時刻:</strong> {photo.timestamp}</div>
                  <div><strong>カメラ:</strong> {photo.cameraLabel}</div>
                  
                  {/* 位置情報表示 */}
                  {photo.location && (
                    <div style={{ marginTop: '3px' }}>
                      <strong>📍 位置:</strong> {photo.location.latitude.toFixed(6)}, {photo.location.longitude.toFixed(6)}
                      <div style={{ fontSize: '11px', color: '#999' }}>
                        精度: ±{Math.round(photo.location.accuracy)}m
                      </div>
                    </div>
                  )}
                  
                  {/* 自動検出結果 */}
                  {photo.suggestedSpot && (
                    <div style={{
                      marginTop: '5px',
                      padding: '4px 8px',
                      backgroundColor: photo.autoDetected ? '#d4edda' : '#fff3cd',
                      borderRadius: '4px',
                      border: `1px solid ${photo.autoDetected ? '#c3e6cb' : '#ffeaa7'}`
                    }}>
                      <strong style={{ color: photo.autoDetected ? '#155724' : '#856404' }}>
                        🎯 {photo.autoDetected ? '自動検出' : '推奨'}: スポット{photo.suggestedSpot}
                      </strong>
                    </div>
                  )}
                  
                  {photo.ocrText && (
                    <div style={{ marginTop: '5px' }}>
                      <strong>OCR結果:</strong>
                      <div style={{
                        backgroundColor: '#e9ecef',
                        padding: '5px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        marginTop: '2px',
                        wordBreak: 'break-all',
                        maxHeight: '60px',
                        overflowY: 'auto'
                      }}>
                        {photo.ocrText}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
                  <select
                    defaultValue={photo.suggestedSpot || ''}
                    onChange={(e) => {
                      const spotNumber = parseInt(e.target.value);
                      if (spotNumber) {
                        saveParkingRecord(photo, spotNumber);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '4px',
                      fontSize: '12px',
                      borderRadius: '4px',
                      border: photo.suggestedSpot ? '2px solid #28a745' : '1px solid #dee2e6',
                      backgroundColor: photo.suggestedSpot ? '#f8fff9' : 'white'
                    }}
                  >
                    <option value="">{photo.suggestedSpot ? '自動選択を確認' : '駐車場所選択'}</option>
                    {Array.from({length: 100}, (_, i) => i + 1).map(num => (
                      <option 
                        key={num} 
                        value={num}
                        style={{
                          fontWeight: num === photo.suggestedSpot ? 'bold' : 'normal',
                          backgroundColor: num === photo.suggestedSpot ? '#e8f5e8' : 'white'
                        }}
                      >
                        {num === photo.suggestedSpot ? '🎯 ' : ''}スポット {num}
                        {num === photo.suggestedSpot ? ' (推奨)' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => deletePhoto(photo.id)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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