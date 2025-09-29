import React, { useState, useRef, useCallback, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import api from '../api/config';
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
      // ブラウザ対応チェック
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('このブラウザはカメラ機能をサポートしていません。ファイルアップロード機能をご利用ください。');
        return;
      }

      // HTTPS必須チェック
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        alert('カメラ機能はHTTPS環境でのみ利用できます。ファイルアップロード機能をご利用ください。');
        return;
      }

      console.log('カメラアクセスを試行中...');
      console.log('利用可能なメディアデバイス:', navigator.mediaDevices);
      
      // 利用可能なカメラを確認
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log('利用可能なカメラ数:', videoDevices.length);
        console.log('カメラデバイス:', videoDevices);
      } catch (e) {
        console.log('デバイス確認エラー:', e);
      }
      
      // まず基本的な設定で試行
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment', // バックカメラを優先
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 }
          } 
        });
      } catch (envError) {
        console.log('バックカメラでの起動失敗、フロントカメラで試行:', envError);
        // バックカメラ失敗時はフロントカメラで試行
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'user',
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 }
            } 
          });
        } catch (userError) {
          console.log('フロントカメラでの起動失敗、基本設定で試行:', userError);
          // 基本設定で試行
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: true 
          });
        }
      }
      
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // ビデオが再生可能になったら再生開始
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              console.log('カメラ起動成功');
              setIsStreaming(true);
            }).catch(playError => {
              console.error('ビデオ再生エラー:', playError);
              alert('カメラの再生に失敗しました。ページを更新して再試行してください。');
            });
          }
        };
      }
    } catch (error: any) {
      console.error('カメラアクセスエラー:', error);
      let errorMessage = 'カメラにアクセスできませんでした。';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'カメラアクセスが拒否されました。ブラウザの設定でカメラアクセスを許可してください。';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'カメラが見つかりません。デバイスにカメラが接続されているか確認してください。';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'このブラウザはカメラ機能をサポートしていません。';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'カメラが他のアプリで使用中の可能性があります。他のカメラアプリを閉じて再試行してください。';
      }
      
      alert(errorMessage + ' ファイルアップロード機能をご利用ください。');
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
    
    // ファイル選択後にinputをクリア（同じファイルを再選択可能にする）
    event.target.value = '';
  }, []);

  // OCR処理
  const processImage = useCallback(async (dataUrl: string, imageId: string) => {
    try {
      const { data: { text } } = await Tesseract.recognize(
        dataUrl,
        'jpn+eng',
        {
          logger: m => console.log(m)
        }
      );

      // ナンバープレートの形式を検出・整形
      const licensePlate = extractLicensePlate(text);

      setCapturedImages(prev => 
        prev.map(img => 
          img.id === imageId 
            ? { ...img, licensePlate, isProcessing: false }
            : img
        )
      );

      if (licensePlate && onCapture) {
        onCapture(licensePlate);
      }
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
  }, [onCapture]);

  // ナンバープレート抽出・整形
  const extractLicensePlate = (text: string): string => {
    // 改行と空白を除去
    const cleanText = text.replace(/\s+/g, '');
    
    // 日本のナンバープレートパターンを検索
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
        text: 'ナンバープレートと駐車位置（1-100）を正しく入力してください' 
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

      // 画像も送信する場合
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
      <div className="capture-header">
        <h2>📷 ナンバープレート撮影・読み取り</h2>
      </div>
      
      <div className="camera-section">
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* カメラコントロール */}
        <div className="camera-controls">
          {!isStreaming ? (
            <>
              <button 
                className="camera-btn" 
                onClick={startCamera}
              >
                📱 カメラを起動
              </button>
              
              <div className="file-input-section">
                <p className="file-input-label">または</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="file-input"
                />
                <button
                  className="file-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  📁 ファイルから選択
                </button>
              </div>
            </>
          ) : (
            <>
              <button 
                className="camera-btn capture" 
                onClick={capturePhoto}
              >
                📸 撮影
              </button>
              <button 
                className="camera-btn danger" 
                onClick={stopCamera}
              >
                ⏹️ 停止
              </button>
            </>
          )}
        </div>

        {/* カメラビュー */}
        <div className="camera-container">
          {isStreaming ? (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline
              muted
              className="camera-video"
            />
          ) : (
            <div className="camera-placeholder">
              <p>📷 カメラを起動してナンバープレートを撮影</p>
              <p>🔒 カメラアクセス許可が必要です</p>
            </div>
          )}
        </div>
        
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* 撮影した画像とOCR結果 */}
      {capturedImages.length > 0 && (
        <div className="captured-images">
          <h3>🔍 読み取り結果</h3>
          <div className="images-grid">
            {capturedImages.map((image) => (
              <div key={image.id} className="image-item">
                <img 
                  src={image.dataUrl} 
                  alt="撮影画像"
                  className="image-preview"
                />
                
                {image.isProcessing && (
                  <div className="processing-indicator">
                    <div className="processing-spinner"></div>
                    <span>読み取り中...</span>
                  </div>
                )}
                
                {image.licensePlate && (
                  <div className="image-info">
                    <div className="license-plate-result">
                      📋 {image.licensePlate}
                    </div>
                  </div>
                )}
                
                {image.error && (
                  <div className="license-plate-result error">
                    ❌ {image.error}
                    <button
                      className="camera-btn"
                      onClick={() => processImage(image.dataUrl, image.id)}
                      style={{ marginTop: '10px', padding: '5px 10px', fontSize: '12px' }}
                    >
                      🔄 再読み取り
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 駐車記録登録フォーム */}
      {capturedImages.some(img => img.licensePlate) && (
        <div className="form-section">
          <h3>🚗 駐車記録登録</h3>
          
          <div className="form-grid">
            <div className="form-group">
              <label>駐車位置 (1-100)</label>
              <input 
                type="number" 
                min="1" 
                max="100" 
                value={selectedSpot}
                onChange={(e) => setSelectedSpot(Number(e.target.value))}
              />
            </div>
            
            <div className="form-group">
              <label>スタッフID</label>
              <input 
                type="text" 
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="例: STAFF001"
              />
            </div>
          </div>
          
          <div className="form-group notes-group">
            <label>メモ（任意）</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="特記事項があれば入力してください"
            />
          </div>
          
          <div className="submit-section">
            <button
              className="submit-btn"
              onClick={() => {
                const licensePlate = capturedImages.find(img => img.licensePlate)?.licensePlate;
                if (licensePlate) submitParkingRecord(licensePlate);
              }}
              disabled={isSubmitting || !capturedImages.some(img => img.licensePlate)}
            >
              {isSubmitting ? (
                <>
                  <div className="processing-spinner"></div>
                  登録中...
                </>
              ) : (
                '✅ 駐車記録を登録'
              )}
            </button>
            
            <button
              className="clear-btn"
              onClick={() => setCapturedImages([])}
            >
              🗑️ クリア
            </button>
          </div>
        </div>
      )}

      <div className="form-section">
        <h3>💡 使い方のヒント</h3>
        <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.8', color: '#666' }}>
          <li>📱 カメラを起動してナンバープレートを撮影</li>
          <li>📁 または、ファイルから画像を選択</li>
          <li>🔍 OCRが自動でナンバープレートを読み取ります</li>
          <li>✏️ 必要に応じて手動で修正可能</li>
          <li>🏁 駐車位置を選択して登録完了</li>
          <li>📸 連続撮影で複数台の車両を効率的に登録</li>
        </ul>
      </div>
    </div>
  );
};

export default CameraCapture;