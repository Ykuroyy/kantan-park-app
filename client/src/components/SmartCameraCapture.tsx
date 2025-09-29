import React, { useState, useRef, useCallback, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import api from '../api/config';

interface CapturedImage {
  id: string;
  dataUrl: string;
  licensePlate?: string;
  isProcessing: boolean;
  error?: string;
}

const SmartCameraCapture: React.FC = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<number>(1);
  const [staffId, setStaffId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // スマホ用カメラ起動
  const startSmartCamera = useCallback(async () => {
    setCameraError(null);
    
    try {
      // 段階的にカメラアクセスを試行
      console.log('スマホ用カメラ起動開始');
      
      // 1. 権限要求用の簡単なアクセス
      let stream: MediaStream;
      
      try {
        // 最初に最もシンプルな設定で権限を取得
        console.log('Step 1: 基本権限取得');
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 } 
        });
        
        // 一旦停止して適切な設定で再開
        stream.getTracks().forEach(track => track.stop());
        console.log('基本権限取得成功、高品質設定に切り替え');
        
        // 2. スマホ最適化設定で再取得
        const constraints = {
          video: {
            facingMode: { ideal: 'environment' }, // バックカメラ優先だが必須ではない
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            aspectRatio: { ideal: 16/9 }
          }
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('高品質設定成功');
        
      } catch (error) {
        console.log('高品質設定失敗、フォールバック実行:', error);
        
        // 3. フォールバック: フロントカメラ
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'user',
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 }
            } 
          });
          console.log('フロントカメラで成功');
        } catch (frontError) {
          console.log('フロントカメラ失敗、基本設定実行:', frontError);
          
          // 4. 最終フォールバック: 基本設定
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          console.log('基本設定で成功');
        }
      }
      
      // ビデオ要素にストリームを設定
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // メタデータ読み込み待ち
        const waitForMetadata = new Promise<void>((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('Video element not found'));
            return;
          }
          
          const video = videoRef.current;
          
          const onMetadata = () => {
            video.removeEventListener('loadedmetadata', onMetadata);
            video.removeEventListener('error', onError);
            resolve();
          };
          
          const onError = (e: Event) => {
            video.removeEventListener('loadedmetadata', onMetadata);
            video.removeEventListener('error', onError);
            reject(new Error(`Video metadata error: ${e}`));
          };
          
          video.addEventListener('loadedmetadata', onMetadata);
          video.addEventListener('error', onError);
          
          // 既に読み込まれている場合
          if (video.readyState >= 1) {
            resolve();
          }
        });
        
        await waitForMetadata;
        
        // 再生開始
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
        
        console.log('カメラ起動完了');
        setIsStreaming(true);
        setCameraError(null);
      }
      
    } catch (error: any) {
      console.error('カメラ起動エラー:', error);
      
      let errorMessage = 'カメラにアクセスできませんでした。';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'カメラアクセスが拒否されました。ブラウザ設定でカメラを許可してください。';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'カメラが見つかりません。';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'このブラウザはカメラをサポートしていません。';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'カメラが他のアプリで使用中です。';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'カメラ設定に問題があります。';
      }
      
      setCameraError(errorMessage);
    }
  }, []);

  // カメラ停止
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log(`停止中: ${track.kind} track`);
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsStreaming(false);
    setCameraError(null);
    console.log('カメラを停止しました');
  }, []);

  // 写真撮影
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      console.error('Video or canvas element not found');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      console.error('Canvas context not available');
      return;
    }

    // ビデオの実際のサイズを取得
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    if (videoWidth === 0 || videoHeight === 0) {
      console.error('Invalid video dimensions');
      return;
    }

    canvas.width = videoWidth;
    canvas.height = videoHeight;
    context.drawImage(video, 0, 0, videoWidth, videoHeight);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const imageId = Date.now().toString();

    console.log(`写真撮影完了: ${videoWidth}x${videoHeight}`);

    const newImage: CapturedImage = {
      id: imageId,
      dataUrl,
      isProcessing: true
    };

    setCapturedImages(prev => [newImage, ...prev]);
    processImage(dataUrl, imageId);
  }, []);

  // ファイルからの画像読み込み
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log(`ファイル選択: ${file.name}, サイズ: ${file.size}bytes`);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const imageId = Date.now().toString();

      const newImage: CapturedImage = {
        id: imageId,
        dataUrl,
        isProcessing: true
      };

      setCapturedImages(prev => [newImage, ...prev]);
      processImage(dataUrl, imageId);
    };
    reader.readAsDataURL(file);
    
    // ファイル選択後にinputをクリア
    event.target.value = '';
  }, []);

  // OCR処理
  const processImage = useCallback(async (dataUrl: string, imageId: string) => {
    try {
      console.log(`OCR処理開始: ${imageId}`);
      
      const { data: { text } } = await Tesseract.recognize(
        dataUrl,
        'jpn+eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              console.log(`OCR進行: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );

      console.log(`OCR結果: "${text}"`);
      const licensePlate = extractLicensePlate(text);
      console.log(`抽出結果: "${licensePlate}"`);

      setCapturedImages(prev => 
        prev.map(img => 
          img.id === imageId 
            ? { ...img, licensePlate, isProcessing: false }
            : img
        )
      );

    } catch (error) {
      console.error('OCR処理エラー:', error);
      setCapturedImages(prev => 
        prev.map(img => 
          img.id === imageId 
            ? { ...img, error: 'OCR処理に失敗しました', isProcessing: false }
            : img
        )
      );
    }
  }, []);

  // ナンバープレート抽出
  const extractLicensePlate = (text: string): string => {
    const cleanText = text.replace(/\s+/g, '');
    
    const patterns = [
      /[ぁ-んァ-ヶ一-龯]+\d{1,3}[ぁ-んァ-ヶ一-龯]+\d{1,4}/,
      /[A-Z]+\d{1,3}[A-Z]+\d{1,4}/,
      /\d{1,3}[ぁ-んァ-ヶ一-龯]+\d{1,4}/,
      /\d{1,3}[A-Z]+\d{1,4}/
    ];
    
    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    return cleanText.length > 0 ? cleanText : 'ナンバー読み取りできませんでした';
  };

  // 駐車記録の送信
  const submitParkingRecord = async (licensePlate: string) => {
    if (!licensePlate || selectedSpot < 1 || selectedSpot > 100) {
      setMessage({ 
        type: 'error', 
        text: 'ナンバープレートと駐車位置を正しく入力してください' 
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      formData.append('license_plate', licensePlate);
      formData.append('spot_number', selectedSpot.toString());
      formData.append('staff_id', staffId);
      formData.append('notes', notes);

      const imageData = capturedImages.find(img => img.licensePlate === licensePlate);
      if (imageData) {
        const response = await fetch(imageData.dataUrl);
        const blob = await response.blob();
        formData.append('image', blob, 'license_plate.jpg');
      }

      await api.post('/api/parking-records', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessage({ type: 'success', text: `駐車記録を登録しました: ${licensePlate} (位置: ${selectedSpot})` });
      
      setSelectedSpot(selectedSpot + 1 > 100 ? 1 : selectedSpot + 1);
      setNotes('');
      setCapturedImages(prev => prev.filter(img => img.licensePlate !== licensePlate));
      
    } catch (error: any) {
      console.error('駐車記録送信エラー:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || '駐車記録の登録に失敗しました' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // メッセージの自動消去
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>📱 スマートカメラ (改良版)</h2>
      
      {message && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          borderRadius: '8px',
          backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
          color: message.type === 'success' ? '#155724' : '#721c24',
          border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {message.text}
        </div>
      )}

      {cameraError && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          borderRadius: '8px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb'
        }}>
          ❌ {cameraError}
        </div>
      )}

      {/* カメラコントロール */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        {!isStreaming ? (
          <div>
            <button 
              onClick={startSmartCamera}
              style={{
                padding: '15px 30px',
                fontSize: '18px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                marginBottom: '15px',
                display: 'block',
                width: '100%'
              }}
            >
              📱 スマートカメラ起動
            </button>
            
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                📁 ファイルから選択
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button 
              onClick={capturePhoto}
              style={{
                padding: '15px 30px',
                fontSize: '18px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              📸 撮影
            </button>
            <button 
              onClick={stopCamera}
              style={{
                padding: '15px 30px',
                fontSize: '18px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              ⏹️ 停止
            </button>
          </div>
        )}
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
              height: 'auto',
              borderRadius: '8px',
              backgroundColor: '#000',
              border: '2px solid #28a745'
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '300px',
            backgroundColor: '#f8f9fa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            border: '2px dashed #dee2e6'
          }}>
            <div style={{ textAlign: 'center', color: '#6c757d' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>📷</div>
              <p>カメラを起動してナンバープレートを撮影</p>
            </div>
          </div>
        )}
      </div>
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* 撮影結果 */}
      {capturedImages.map((image) => (
        <div key={image.id} style={{
          marginBottom: '20px',
          padding: '15px',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          backgroundColor: '#fff'
        }}>
          <img 
            src={image.dataUrl} 
            alt="撮影画像"
            style={{
              width: '100%',
              height: '200px',
              objectFit: 'cover',
              borderRadius: '5px',
              marginBottom: '10px'
            }}
          />
          
          {image.isProcessing && (
            <div style={{ textAlign: 'center', color: '#007bff' }}>
              🔄 読み取り中...
            </div>
          )}
          
          {image.licensePlate && (
            <div style={{
              padding: '10px',
              backgroundColor: '#d4edda',
              borderRadius: '5px',
              textAlign: 'center',
              fontFamily: 'monospace',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              📋 {image.licensePlate}
            </div>
          )}
          
          {image.error && (
            <div style={{
              padding: '10px',
              backgroundColor: '#f8d7da',
              borderRadius: '5px',
              textAlign: 'center',
              color: '#721c24'
            }}>
              ❌ {image.error}
              <button
                onClick={() => processImage(image.dataUrl, image.id)}
                style={{
                  marginLeft: '10px',
                  padding: '5px 10px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                🔄 再試行
              </button>
            </div>
          )}
        </div>
      ))}

      {/* 登録フォーム */}
      {capturedImages.some(img => img.licensePlate) && (
        <div style={{
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          marginTop: '20px'
        }}>
          <h3>🚗 駐車記録登録</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>駐車位置 (1-100)</label>
            <input 
              type="number" 
              min="1" 
              max="100" 
              value={selectedSpot}
              onChange={(e) => setSelectedSpot(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ced4da',
                borderRadius: '5px'
              }}
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>スタッフID</label>
            <input 
              type="text" 
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder="例: STAFF001"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ced4da',
                borderRadius: '5px'
              }}
            />
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>メモ（任意）</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="特記事項があれば入力してください"
              rows={3}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ced4da',
                borderRadius: '5px',
                resize: 'vertical'
              }}
            />
          </div>
          
          <button
            onClick={() => {
              const licensePlate = capturedImages.find(img => img.licensePlate)?.licensePlate;
              if (licensePlate) submitParkingRecord(licensePlate);
            }}
            disabled={isSubmitting || !capturedImages.some(img => img.licensePlate)}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: isSubmitting ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {isSubmitting ? '🔄 登録中...' : '✅ 駐車記録を登録'}
          </button>
        </div>
      )}
    </div>
  );
};

export default SmartCameraCapture;