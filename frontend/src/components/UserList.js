import React, { useState, useEffect } from 'react';
import apiClient from '../api';

function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await apiClient.get('/users');
        setUsers(response.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleBlock = async (id) => {
    if (!window.confirm('Block this user?')) return;
    try {
      await apiClient.delete(`/users/${id}`);
      setUsers(users.map(u => u.id === id ? { ...u, isBlocked: true } : u));
    } catch (err) {
      alert('Failed to block user');
    }
  };

  const handleRoleChange = async (id, newRole) => {
    try {
      const response = await apiClient.put(`/users/${id}`, { role: newRole });
      setUsers(users.map(u => u.id === id ? response.data : u));
    } catch (err) {
      alert('Failed to update role');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>User Management</h2>
      <table className="table table-striped">
        <thead>
          <tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.username}</td>
              <td>{user.email}</td>
              <td>
                <select value={user.role} onChange={(e) => handleRoleChange(user.id, e.target.value)} className="form-select form-select-sm" style={{width: '100px'}}>
                  <option value="user">User</option>
                  <option value="seller">Seller</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td>{user.isBlocked ? 'Blocked' : 'Active'}</td>
              <td>
                {!user.isBlocked && (
                  <button onClick={() => handleBlock(user.id)} className="btn btn-sm btn-danger">Block</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default UserList;