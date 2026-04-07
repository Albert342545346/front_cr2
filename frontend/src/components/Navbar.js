import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Navbar({ user, onLogout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container">
        <Link className="navbar-brand" to="/">White Shop</Link>
        <div className="collapse navbar-collapse">
          <ul className="navbar-nav me-auto">
            <li className="nav-item"><Link className="nav-link" to="/">Products</Link></li>
            {user && (user.role === 'seller' || user.role === 'admin') && (
              <li className="nav-item"><Link className="nav-link" to="/products/new">Add Product</Link></li>
            )}
            {user && user.role === 'admin' && (
              <li className="nav-item"><Link className="nav-link" to="/users">Users</Link></li>
            )}
          </ul>
          {user ? (
            <div className="dropdown">
              <button className="btn btn-secondary dropdown-toggle" data-bs-toggle="dropdown">
                {user.username} ({user.role})
              </button>
              <ul className="dropdown-menu">
                <li><button className="dropdown-item" onClick={handleLogout}>Logout</button></li>
              </ul>
            </div>
          ) : (
            <div>
              <Link to="/login" className="btn btn-outline-light me-2">Login</Link>
              <Link to="/register" className="btn btn-light">Register</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;