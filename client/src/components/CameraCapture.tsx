import React, { useState, useRef, useCallback, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import axios from 'axios';
import './CameraCapture.css';

interface CameraProps {
  onCapture?: (licensePlate: string) => void;
}

interface CapturedImage {
  id: string;
  dataUrl: string;
  licensePlate?: string;
  isProcessing: boolean;
  error?: string;
}

const CameraCapture: React.FC<CameraProps> = ({ onCapture }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<number>(1);
  const [staffId, setStaffId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // カメラストリーミング開始
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // バックカメラを優先
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
      }
    } catch (error) {
      console.error('カメラアクセスエラー:', error);
      alert('カメラにアクセスできませんでした。ファイルアップロード機能をご利用ください。');
    }
  }, []);

  // カメラ停止
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // 写真撮影
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const imageId = Date.now().toString();

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
  }, []);

  // OCR処理
  const processImage = useCallback(async (dataUrl: string, imageId: string) => {
    try {
      // 画像の前処理（明度とコントラスト調整）
      const preprocessedImage = await preprocessImage(dataUrl);
      
      const result = await Tesseract.recognize(
        preprocessedImage,
        'eng',
        {
          logger: m => console.log(m)
        }
      );

      let licensePlate = result.data.text.trim();
      
      // ナンバープレートのフォーマット調整
      licensePlate = formatLicensePlate(licensePlate);

      setCapturedImages(prev => prev.map(img => 
        img.id === imageId 
          ? { ...img, licensePlate, isProcessing: false }
          : img
      ));

      if (onCapture) {
        onCapture(licensePlate);
      }

    } catch (error) {
      console.error('OCR処理エラー:', error);
      setCapturedImages(prev => prev.map(img => 
        img.id === imageId 
          ? { ...img, isProcessing: false, error: 'ナンバープレートを認識できませんでした' }
          : img
      ));
    }
  }, [onCapture]);

  // 画像の前処理
  const preprocessImage = async (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 明度とコントラストを調整
        ctx.filter = 'contrast(150%) brightness(110%) grayscale(100%)';
        ctx.drawImage(img, 0, 0);
        
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = dataUrl;
    });
  };

  // ナンバープレートフォーマット調整
  const formatLicensePlate = (text: string): string => {
    // 特殊文字と空白を除去
    let formatted = text.replace(/[^A-Z0-9]/g, '');
    
    // 日本のナンバープレートの一般的なパターンに調整
    if (formatted.length >= 4) {
      // 例: ABC1234 -> ABC-1234
      if (formatted.length === 7) {
        formatted = formatted.slice(0, 3) + '-' + formatted.slice(3);
      }
      // 例: AB1234 -> AB-1234
      else if (formatted.length === 6) {
        formatted = formatted.slice(0, 2) + '-' + formatted.slice(2);
      }
    }
    
    return formatted;
  };

  // 駐車記録の送信
  const submitParkingRecord = async (licensePlate: string) => {
    if (!licensePlate || !selectedSpot) {
      setMessage({ type: 'error', text: 'ナンバープレートと駐車位置を選択してください' });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('license_plate', licensePlate);
      formData.append('spot_number', selectedSpot.toString());
      formData.append('staff_id', staffId);
      formData.append('notes', notes);

      // 対応する画像があれば添付
      const imageData = capturedImages.find(img => img.licensePlate === licensePlate);
      if (imageData) {
        const response = await fetch(imageData.dataUrl);
        const blob = await response.blob();
        formData.append('image', blob, 'license_plate.jpg');
      }

      await axios.post('/api/parking-records', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessage({ type: 'success', text: `駐車記録を登録しました: ${licensePlate} (位置: ${selectedSpot})` });
      
      // フォームリセット
      setSelectedSpot(selectedSpot + 1 > 100 ? 1 : selectedSpot + 1);
      setNotes('');
      
      // 成功した画像を削除
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

  return (
    <div className="camera-capture">
      <div className="card">
        <div className="card-header">
          📷 ナンバープレート撮影・読み取り
        </div>
        <div className="card-content">
          {message && (
            <div className={`alert alert-${message.type}`}>
              {message.text}
            </div>
          )}

          {/* カメラコントロール */}
          <div className="camera-controls mb-3">
            {!isStreaming ? (
              <div className="text-center">
                <button 
                  className="btn btn-primary" 
                  onClick={startCamera}
                >
                  📱 カメラを起動
                </button>
                <div className="mt-2">
                  <span>または </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📁 ファイルから選択
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <button 
                  className="btn btn-success" 
                  onClick={capturePhoto}
                >
                  📸 撮影
                </button>
                <button 
                  className="btn btn-danger ml-2" 
                  onClick={stopCamera}
                >
                  ⏹️ 停止
                </button>
              </div>
            )}
          </div>

          {/* カメラビュー */}
          {isStreaming && (
            <div className="camera-view mb-3">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline
                muted
                style={{
                  width: '100%',
                  maxHeight: '400px',
                  borderRadius: '8px',
                  backgroundColor: '#000'
                }}
              />
            </div>
          )}
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>

      {/* 撮影した画像とOCR結果 */}
      {capturedImages.length > 0 && (
        <div className="card">
          <div className="card-header">
            🔍 読み取り結果
          </div>
          <div className="card-content">
            <div className="grid grid-2">
              {capturedImages.map((image) => (
                <div key={image.id} className="image-result">
                  <img 
                    src={image.dataUrl} 
                    alt="撮影画像"
                    style={{
                      width: '100%',
                      height: '200px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      marginBottom: '0.5rem'
                    }}
                  />
                  
                  {image.isProcessing && (
                    <div className="text-center">
                      <div className="spinner"></div>
                      読み取り中...
                    </div>
                  )}
                  
                  {image.licensePlate && (
                    <div>
                      <div className="alert alert-success">
                        <strong>📋 ナンバープレート:</strong><br/>
                        <span style={{ fontSize: '1.2em', fontFamily: 'monospace' }}>
                          {image.licensePlate}
                        </span>
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">駐車位置 (1-100)</label>
                        <input 
                          type="number" 
                          min="1" 
                          max="100" 
                          value={selectedSpot}
                          onChange={(e) => setSelectedSpot(Number(e.target.value))}
                          className="form-control"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">スタッフID</label>
                        <input 
                          type="text" 
                          value={staffId}
                          onChange={(e) => setStaffId(e.target.value)}
                          className="form-control"
                          placeholder="例: STAFF001"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">メモ（任意）</label>
                        <textarea 
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="form-control"
                          rows={2}
                          placeholder="特記事項があれば入力してください"
                        />
                      </div>
                      
                      <button
                        className="btn btn-success w-full"
                        onClick={() => submitParkingRecord(image.licensePlate!)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="spinner"></div>
                            登録中...
                          </>
                        ) : (
                          '✅ 駐車記録を登録'
                        )}
                      </button>
                    </div>
                  )}
                  
                  {image.error && (
                    <div className="alert alert-danger">
                      <strong>❌ エラー:</strong><br/>
                      {image.error}
                      <div className="mt-2">
                        <button
                          className="btn btn-primary"
                          onClick={() => processImage(image.dataUrl, image.id)}
                        >
                          🔄 再読み取り
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          💡 使い方のヒント
        </div>
        <div className="card-content">
          <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.6' }}>
            <li>📱 カメラを起動してナンバープレートを撮影</li>
            <li>📁 または、ファイルから画像を選択</li>
            <li>🔍 OCRが自動でナンバープレートを読み取ります</li>
            <li>✏️ 必要に応じて手動で修正可能</li>
            <li>🏁 駐車位置を選択して登録完了</li>
            <li>📸 連続撮影で複数台の車両を効率的に登録</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;