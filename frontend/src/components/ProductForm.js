import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api';

function ProductForm({ isEdit = false }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (isEdit && id) {
      const fetchProduct = async () => {
        try {
          const response = await apiClient.get(`/products/${id}`);
          const p = response.data;
          setTitle(p.title);
          setCategory(p.category);
          setDescription(p.description);
          setPrice(p.price);
        } catch (err) {
          setError('Failed to load product');
        }
      };
      fetchProduct();
    }
  }, [isEdit, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isEdit) {
        await apiClient.put(`/products/${id}`, { title, category, description, price: parseFloat(price) });
      } else {
        await apiClient.post('/products', { title, category, description, price: parseFloat(price) });
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
      setLoading(false);
    }
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-6">
        <h2>{isEdit ? 'Edit Product' : 'Create Product'}</h2>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Title</label>
            <input type="text" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label className="form-label">Category</label>
            <input type="text" className="form-control" value={category} onChange={(e) => setCategory(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label className="form-label">Description</label>
            <textarea className="form-control" rows="3" value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label className="form-label">Price</label>
            <input type="number" step="0.01" className="form-control" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProductForm;