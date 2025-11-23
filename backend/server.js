require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { body, validationResult } = require('express-validator');


const dbPath = process.env.DB_PATH || './inventory.db';
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    unit TEXT,
    category TEXT,
    brand TEXT,
    stock INTEGER NOT NULL,
    status TEXT,
    image TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS inventory_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    old_quantity INTEGER,
    new_quantity INTEGER,
    change_date TEXT,
    user_info TEXT,
    FOREIGN KEY(product_id) REFERENCES products(id)
  )`);
});


const app = express();
app.use(express.json());
app.use(cors());  
const PORT = process.env.PORT || 3000;

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ dest: uploadDir + '/' });



//GET all products

app.get("/api/products", (req, res) => {
  const { category } = req.query;
  if (category) {
    db.all('SELECT * FROM products WHERE category = ?', [category], (err, rows) => {
      if (err) { res.status(500).json({ error: err.message }); return; }
      res.json(rows);
    });
    return;
  }

  db.all("SELECT * FROM products", (err, rows) => {
    if (err) { res.status(500).json({ error: err.message }); return ; }
    res.json(rows);
  });
});     

// Search products by name (case-insensitive LIKE)
app.get('/api/products/search', (req, res) => {
  const name = req.query.name || '';
  const pattern = `%${name}%`;
  db.all('SELECT * FROM products WHERE name LIKE ? COLLATE NOCASE', [pattern], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


//update product
app.put("/api/products/:id", 
    [ 
        body('name').notEmpty().withMessage('Name is required'),
        body('stock').isNumeric().withMessage('Stock must be a number')
    ],
    (req, res) => {
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { name, unit, category, brand, stock, status, image } = req.body; 
        
        db.get('SELECT stock FROM products WHERE id = ?', [id], (err, product) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }   

            if (product && product.stock !== stock) {
                db.run(
                    'INSERT INTO inventory_history (product_id, old_quantity, new_quantity, change_date) VALUES (?, ?, ?, ?)',
                    [id, product.stock, stock, new Date().toISOString()]
                );
            }

            db.run(
                'UPDATE products SET name = ?, unit = ?, category = ?, brand = ?, stock = ?, status = ?, image = ? WHERE id = ?',
                [name, unit, category, brand, stock, status, image, id],
                function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }       
                    res.json({ message: 'Product updated successfully' });
                }
            );
        });         
    }
);

// Import CSV file and insert products
app.post('/api/products/import', upload.single('csvFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Field name should be "csvFile".' });
  }

  const filePath = req.file.path;
  let added = 0;
  let skipped = 0;
  let pending = 0;
  let streamEnded = false;

  function checkDone() {
    if (streamEnded && pending === 0) {
      fs.unlink(filePath, () => {});
      return res.json({ added, skipped });
    }
  }

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      pending++;

      const name = (row.name || row.Name || '').trim();
      const unit = row.unit || row.Unit || null;
      const category = row.category || row.Category || null;
      const brand = row.brand || row.Brand || null;
      const stock = parseInt(row.stock || row.Stock || '0', 10) || 0;
      const status = row.status || row.Status || null;
      const image = row.image || row.Image || null;

      if (!name) {
        skipped++;
        pending--;
        return checkDone();
      }

      db.get('SELECT id FROM products WHERE name = ?', [name], (err, existing) => {
        if (err) {
          pending--;
          return checkDone();
        }

        if (existing) {
          skipped++;
          pending--;
          return checkDone();
        }

        db.run(
          'INSERT INTO products (name, unit, category, brand, stock, status, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [name, unit, category, brand, stock, status, image],
          function (insertErr) {
            if (!insertErr) added++;
            pending--;
            return checkDone();
          }
        );
      });
    })
    .on('end', () => {
      streamEnded = true;
      checkDone();
    })
    .on('error', (err) => {
      fs.unlink(filePath, () => {});
      return res.status(500).json({ error: 'Failed to parse CSV file', details: err.message });
    });
});


app.get('/api/products/export', (req, res) => {
  db.all('SELECT * FROM products', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const fields = ['id','name','unit','category','brand','stock','status','image'];

    function escapeCsv(value) {
      if (value === null || value === undefined) return '';
      const s = String(value);
      if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }

    let csvData = fields.join(',') + '\n';
    for (const row of rows) {
      const line = fields.map(f => escapeCsv(row[f])).join(',');
      csvData += line + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    return res.status(200).send(csvData);
  });
});

// Get inventory history for a product
app.get('/api/products/:id/history', (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Product id is required' });

  db.all('SELECT * FROM inventory_history WHERE product_id = ? ORDER BY change_date DESC', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    return res.json(rows);
  });
});




app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

