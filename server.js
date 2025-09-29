const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// ミドルウェア設定
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

// Reactアプリのstatic filesを提供
app.use(express.static(path.join(__dirname, 'client/build')));

// アップロードディレクトリの作成
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer設定（画像アップロード用）
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// データベース初期化
const db = new sqlite3.Database('parking_management.db');

// テーブル作成
db.serialize(() => {
  // 駐車場情報テーブル
  db.run(`CREATE TABLE IF NOT EXISTS parking_spots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spot_number INTEGER UNIQUE NOT NULL,
    is_occupied BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 駐車記録テーブル
  db.run(`CREATE TABLE IF NOT EXISTS parking_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_plate TEXT NOT NULL,
    spot_number INTEGER NOT NULL,
    check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    check_out_time DATETIME NULL,
    image_path TEXT,
    staff_id TEXT,
    notes TEXT,
    FOREIGN KEY (spot_number) REFERENCES parking_spots (spot_number)
  )`);

  // 100台分の駐車スペースを初期化
  const stmt = db.prepare('INSERT OR IGNORE INTO parking_spots (spot_number) VALUES (?)');
  for (let i = 1; i <= 100; i++) {
    stmt.run(i);
  }
  stmt.finalize();
});

// API エンドポイント

// 駐車場一覧取得
app.get('/api/parking-spots', (req, res) => {
  db.all(`
    SELECT 
      ps.spot_number,
      ps.is_occupied,
      pr.license_plate,
      pr.check_in_time,
      pr.id as record_id
    FROM parking_spots ps
    LEFT JOIN parking_records pr ON ps.spot_number = pr.spot_number 
      AND pr.check_out_time IS NULL
    ORDER BY ps.spot_number
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 駐車記録追加
app.post('/api/parking-records', upload.single('image'), (req, res) => {
  const { license_plate, spot_number, staff_id, notes } = req.body;
  const image_path = req.file ? req.file.filename : null;

  if (!license_plate || !spot_number) {
    return res.status(400).json({ error: 'ライセンスプレートと駐車位置は必須です' });
  }

  db.serialize(() => {
    // 既に駐車中の車両をチェック
    db.get(`
      SELECT id FROM parking_records 
      WHERE spot_number = ? AND check_out_time IS NULL
    `, [spot_number], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      if (row) {
        res.status(400).json({ error: 'この駐車スペースは既に使用中です' });
        return;
      }

      // 新しい駐車記録を追加
      db.run(`
        INSERT INTO parking_records (license_plate, spot_number, image_path, staff_id, notes)
        VALUES (?, ?, ?, ?, ?)
      `, [license_plate, spot_number, image_path, staff_id, notes], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        // 駐車スペースを使用中に更新
        db.run(`
          UPDATE parking_spots SET is_occupied = TRUE WHERE spot_number = ?
        `, [spot_number], (err) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          res.json({ 
            id: this.lastID, 
            message: '駐車記録が追加されました',
            license_plate,
            spot_number
          });
        });
      });
    });
  });
});

// 駐車記録終了（退場処理）
app.put('/api/parking-records/:id/checkout', (req, res) => {
  const recordId = req.params.id;
  
  db.get(`
    SELECT spot_number FROM parking_records WHERE id = ?
  `, [recordId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (!row) {
      res.status(404).json({ error: '駐車記録が見つかりません' });
      return;
    }

    const spotNumber = row.spot_number;

    db.serialize(() => {
      // 駐車記録を更新
      db.run(`
        UPDATE parking_records 
        SET check_out_time = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [recordId], (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        // 駐車スペースを空きに更新
        db.run(`
          UPDATE parking_spots SET is_occupied = FALSE WHERE spot_number = ?
        `, [spotNumber], (err) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          res.json({ message: '退場処理が完了しました' });
        });
      });
    });
  });
});

// 駐車記録履歴取得
app.get('/api/parking-records', (req, res) => {
  const { startDate, endDate, status } = req.query;
  
  let query = `
    SELECT 
      pr.*,
      CASE 
        WHEN pr.check_out_time IS NULL THEN 
          ROUND((julianday('now') - julianday(pr.check_in_time)) * 24, 2)
        ELSE 
          ROUND((julianday(pr.check_out_time) - julianday(pr.check_in_time)) * 24, 2)
      END as duration_hours
    FROM parking_records pr
    WHERE 1=1
  `;
  
  const params = [];
  
  if (startDate) {
    query += ` AND date(pr.check_in_time) >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    query += ` AND date(pr.check_in_time) <= ?`;
    params.push(endDate);
  }
  
  if (status && status !== 'all') {
    if (status === 'parked') {
      query += ` AND pr.check_out_time IS NULL`;
    } else if (status === 'departed') {
      query += ` AND pr.check_out_time IS NOT NULL`;
    }
  }
  
  query += ` ORDER BY pr.check_in_time DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Excel出力
app.get('/api/export-excel', async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    let query = `
      SELECT 
        pr.*,
        CASE 
          WHEN pr.check_out_time IS NULL THEN 
            ROUND((julianday('now') - julianday(pr.check_in_time)) * 24, 2)
          ELSE 
            ROUND((julianday(pr.check_out_time) - julianday(pr.check_in_time)) * 24, 2)
        END as duration_hours
      FROM parking_records pr
      WHERE 1=1
    `;
    
    const params = [];
    
    if (startDate) {
      query += ` AND date(pr.check_in_time) >= ?`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND date(pr.check_in_time) <= ?`;
      params.push(endDate);
    }
    
    if (status && status !== 'all') {
      if (status === 'parked') {
        query += ` AND pr.check_out_time IS NULL`;
      } else if (status === 'departed') {
        query += ` AND pr.check_out_time IS NOT NULL`;
      }
    }
    
    query += ` ORDER BY pr.check_in_time DESC`;
    
    db.all(query, params, async (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('駐車記録');

      // ヘッダー設定
      worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'ナンバープレート', key: 'license_plate', width: 20 },
        { header: '駐車位置', key: 'spot_number', width: 15 },
        { header: '入庫時間', key: 'check_in_time', width: 20 },
        { header: '出庫時間', key: 'check_out_time', width: 20 },
        { header: '駐車時間(時間)', key: 'duration_hours', width: 15 },
        { header: 'スタッフID', key: 'staff_id', width: 15 },
        { header: 'メモ', key: 'notes', width: 30 }
      ];

      // データ追加
      rows.forEach(row => {
        worksheet.addRow({
          id: row.id,
          license_plate: row.license_plate,
          spot_number: row.spot_number,
          check_in_time: row.check_in_time,
          check_out_time: row.check_out_time || '駐車中',
          duration_hours: row.duration_hours,
          staff_id: row.staff_id,
          notes: row.notes
        });
      });

      // スタイル設定
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="parking_records_${new Date().toISOString().split('T')[0]}.xlsx"`
      );

      await workbook.xlsx.write(res);
      res.end();
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// React Router対応 - SPAのfallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚗 駐車場管理アプリサーバーが起動しました: http://localhost:${PORT}`);
  console.log('📱 スマホからアクセス可能です');
});

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
  console.log('\n🔄 サーバーを終了します...');
  db.close((err) => {
    if (err) {
      console.error('データベース終了エラー:', err.message);
    } else {
      console.log('✅ データベース接続を閉じました');
    }
    process.exit(0);
  });
});