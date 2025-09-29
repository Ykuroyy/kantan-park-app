const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('parking_management.db');

console.log('=== 最新駐車記録詳細確認 ===');

// 駐車記録の詳細確認
db.all(`
  SELECT 
    pr.*,
    datetime(pr.check_in_time, 'localtime') as local_check_in
  FROM parking_records pr 
  ORDER BY pr.check_in_time DESC 
  LIMIT 5
`, (err, rows) => {
  if (err) {
    console.error('駐車記録取得エラー:', err);
  } else {
    console.log(`\n📊 駐車記録数: ${rows.length}件`);
    
    if (rows.length > 0) {
      rows.forEach((row, index) => {
        console.log(`\n--- 最新記録 ${index + 1} ---`);
        console.log(`🆔 ID: ${row.id}`);
        console.log(`🅿️ 駐車スポット: ${row.spot_number}`);
        console.log(`🚗 ナンバープレート: "${row.license_plate}"`);
        console.log(`📸 画像ファイル: ${row.image_path}`);
        console.log(`⏰ チェックイン: ${row.local_check_in}`);
        console.log(`👤 スタッフID: ${row.staff_id || '未設定'}`);
        console.log(`📝 メモ: ${row.notes || '未設定'}`);
        
        // 画像ファイルの存在確認
        const fs = require('fs');
        const path = require('path');
        if (row.image_path) {
          const imagePath = path.join('./uploads', row.image_path);
          if (fs.existsSync(imagePath)) {
            const stats = fs.statSync(imagePath);
            console.log(`📁 画像サイズ: ${Math.round(stats.size / 1024)}KB`);
            console.log(`📅 画像更新日: ${stats.mtime.toLocaleString()}`);
          } else {
            console.log(`❌ 画像ファイルが見つかりません: ${imagePath}`);
          }
        }
      });
    } else {
      console.log('\n⚠️ まだ駐車記録がありません');
      console.log('💡 写真撮影後、駐車場所を選択して保存してください');
    }
  }
  
  // 全アップロード画像の確認
  console.log('\n=== 全アップロード画像 ===');
  const fs = require('fs');
  const path = require('path');
  
  try {
    const uploadsDir = './uploads';
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      console.log(`📂 アップロード画像数: ${files.length}件\n`);
      
      files.forEach((file, index) => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        console.log(`${index + 1}. 📎 ${file}`);
        console.log(`   💾 サイズ: ${Math.round(stats.size / 1024)}KB`);
        console.log(`   📅 作成: ${stats.birthtime.toLocaleString()}`);
        console.log(`   🔄 更新: ${stats.mtime.toLocaleString()}\n`);
      });
    } else {
      console.log('📂 uploadsディレクトリが存在しません');
    }
  } catch (error) {
    console.error('❌ 画像ファイル確認エラー:', error);
  }
  
  db.close();
});