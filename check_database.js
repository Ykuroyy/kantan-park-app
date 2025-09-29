const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('parking_management.db');

console.log('=== 駐車記録確認 ===');

// 駐車記録の確認
db.all("SELECT * FROM parking_records ORDER BY check_in_time DESC LIMIT 10", (err, rows) => {
  if (err) {
    console.error('駐車記録取得エラー:', err);
  } else {
    console.log(`\n駐車記録数: ${rows.length}件`);
    rows.forEach((row, index) => {
      console.log(`\n--- 記録 ${index + 1} ---`);
      console.log(`ID: ${row.id}`);
      console.log(`駐車場所: ${row.spot_number}`);
      console.log(`ナンバープレート: ${row.license_plate}`);
      console.log(`画像パス: ${row.image_path}`);
      console.log(`チェックイン: ${row.check_in_time}`);
      console.log(`チェックアウト: ${row.check_out_time || '未設定'}`);
      console.log(`スタッフID: ${row.staff_id || '未設定'}`);
      console.log(`メモ: ${row.notes || '未設定'}`);
    });
  }
  
  // アップロードされた画像ファイルの確認
  console.log('\n=== アップロード画像確認 ===');
  const fs = require('fs');
  const path = require('path');
  
  try {
    const uploadsDir = './uploads';
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      console.log(`アップロード画像数: ${files.length}件`);
      files.slice(0, 10).forEach((file, index) => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        console.log(`${index + 1}. ${file} (${Math.round(stats.size / 1024)}KB) - ${stats.mtime.toLocaleString()}`);
      });
    } else {
      console.log('uploadsディレクトリが存在しません');
    }
  } catch (error) {
    console.error('画像ファイル確認エラー:', error);
  }
  
  db.close();
});