import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { 
  Upload, Download, Plus, Search, 
  Edit2, Trash2, Save, X, History, 
  TrendingUp, TrendingDown 
} from 'lucide-react';
import './App.css';

const apiBase = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL.replace(/\/$/, '')}/api`
  : 'http://localhost:3000/api';

const api = axios.create({ baseURL: apiBase });




const HistorySidebar = ({ productId, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!productId) return;
      setLoading(true);
      try {
        const res = await api.get(`/products/${productId}/history`);
        setHistory(res.data);
      } catch (err) {
        console.error("Error fetching history");
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [productId]);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Inventory History</h2>
        <button onClick={onClose} className="icon-btn">
          <X size={20} />
        </button>
      </div>

      <div className="sidebar-content">
        {loading ? (
          <div className="muted center-text">Loading logs...</div>
        ) : history.length === 0 ? (
          <div className="muted center-text">No history available.</div>
        ) : (
          <div className="history-list">
            {history.map((log) => {
              const isIncrease = log.new_quantity > log.old_quantity;
              const diff = Math.abs(log.new_quantity - log.old_quantity);
              
              return (
                <div key={log.id} className="history-item">
                  <div className="row space-between">
                    <span className="date-text">
                        {new Date(log.change_date).toLocaleString()}
                    </span>
                    <span className={`badge ${isIncrease ? 'success' : 'danger'}`}>
                        {isIncrease ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {isIncrease ? '+' : '-'}{diff}
                    </span>
                  </div>
                  <div className="row space-between mt-small">
                    <span className="muted">Old: {log.old_quantity}</span>
                    <span className="bold">New: {log.new_quantity}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};


const ProductRow = ({ product, refreshData, onSelectProduct }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ ...product });
  const isOutOfStock = formData.stock === 0;
  
  const handleSave = async () => {
    try {
      await api.put(`/products/${product.id}`, formData);
      setIsEditing(false);
      refreshData(); 
    } catch (err) {
      alert("Failed to update product.");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'stock' ? Number(value) : value
    }));
  };

  if (isEditing) {
    return (
      <tr className="editing-row">
        <td><input name="name" value={formData.name} onChange={handleChange} className="input" /></td>
        <td><input name="category" value={formData.category} onChange={handleChange} className="input" /></td>
        <td><input type="number" name="stock" value={formData.stock} onChange={handleChange} className="input small-input" /></td>
        <td className="muted">Editing...</td>
        <td className="text-right">
          <div className="row justify-end">
            <button onClick={handleSave} className="icon-btn success" title="Save"><Save size={18} /></button>
            <button onClick={() => setIsEditing(false)} className="icon-btn danger" title="Cancel"><X size={18} /></button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="font-medium">{product.name}</td>
      <td className="muted">{product.category}</td>
      <td>{product.stock}</td>
      <td>
        <span className={`badge ${isOutOfStock ? 'danger' : 'success'}`}>
          {isOutOfStock ? 'Out of Stock' : 'In Stock'}
        </span>
      </td>
      <td>
        <div className="row justify-end">
          <button onClick={() => onSelectProduct(product.id)} className="icon-btn accent" title="View History">
              <History size={18} />
          </button>
          <button onClick={() => setIsEditing(true)} className="icon-btn accent" title="Edit">
              <Edit2 size={18} />
          </button>
          <button className="icon-btn danger" title="Delete">
              <Trash2 size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
};


const App = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef();

  const refreshProducts = async () => {
    try {
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      
      const res = await api.get('/products', { params });
      setProducts(res.data || []);
      
      const unique = Array.from(new Set((res.data || []).map(p => p.category).filter(Boolean)));
      setCategories(unique);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  useEffect(() => { refreshProducts(); }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (!query) { refreshProducts(); return; }
      api.get('/products/search', { params: { name: query } })
        .then(r => setProducts(r.data || []))
        .catch(e => console.error("Search error:", e));
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const onCategoryChange = (cat) => {
    setSelectedCategory(cat);
    const params = {};
    if (cat) params.category = cat;
    api.get('/products', { params })
      .then(r => setProducts(r.data || []))
      .catch(e => console.error(e));
  };

  const triggerImport = () => { 
    if (fileInputRef.current) fileInputRef.current.click(); 
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const fd = new FormData();
    fd.append('csvFile', file);
    
    try {
      setUploading(true);
      await api.post('/products/import', fd);
      alert('Import successful!');
      await refreshProducts(); 
    } catch (err) {
      alert('Import failed. Please check the console.');
    } finally {
      setUploading(false);
      e.target.value = null; 
    }
  };

  const handleExport = () => {
    window.open('http://localhost:3000/api/products/export', '_blank');
  };

  return (
    <div className="App">
      
      <header className="app-header card">
        <div className="header-left row">
          <div className="search-wrapper row">
            <Search size={18} className="muted" />
            <input 
              className="input search-input"
              placeholder="Search products..." 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
            />
          </div>
          
          <select className="input" value={selectedCategory} onChange={e => onCategoryChange(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          
          <button className="btn btn-primary row">
            <Plus size={16} /> Add New
          </button>
        </div>

        <div className="header-right row">
          <button onClick={triggerImport} className="btn btn-secondary row" disabled={uploading}>
            <Upload size={16} /> {uploading ? 'Uploading...' : 'Import CSV'}
          </button>
          <button onClick={handleExport} className="btn btn-secondary row">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </header>

      <div className="main-layout">
        <div className="content-area card table-container">
          <table className="product-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan="5" className="center-text muted">No products found.</td></tr>
              ) : (
                products.map((product) => (
                  <ProductRow 
                    key={product.id} 
                    product={product} 
                    refreshData={refreshProducts} 
                    onSelectProduct={setSelectedProduct} 
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {selectedProduct && (
          <HistorySidebar 
            productId={selectedProduct} 
            onClose={() => setSelectedProduct(null)} 
          />
        )}
      </div>

      <input 
        ref={fileInputRef} 
        type="file" 
        accept=".csv" 
        style={{ display: 'none' }} 
        onChange={handleFileChange} 
      />

      {/* AddProductModal removed — modal code eliminated per request */}
    </div>
  );
}

export default App;