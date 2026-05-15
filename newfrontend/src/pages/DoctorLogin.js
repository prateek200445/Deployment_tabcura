import React, { useState } from 'react';
import './doctorAuth.css';

const DoctorLogin = ({ onBackToLanding, onGoToSignup, onLoginSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.password) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          isDoctor: true
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      onLoginSuccess({
        ...data.user,
        isDoctor: true
      });
      
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="doctor-auth-container">
      <div className="doctor-auth-card">
        <div className="doctor-auth-header">
          <div className="auth-logo">
            <img src={process.env.PUBLIC_URL + "/tabcura.png"} alt="TabCura" />
          </div>
          <h1>Doctor Portal</h1>
          <p>Secure Professional Access</p>
        </div>

        <form onSubmit={handleSubmit} className="doctor-auth-form">
          <div className="form-group">
            <label>Professional Email</label>
            <input
              type="email"
              name="email"
              placeholder="dr.name@hospital.com"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button 
            type="submit" 
            className={`doctor-auth-btn ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? 'Verifying...' : 'Login to Dashboard'}
          </button>
        </form>

        <div className="doctor-auth-footer">
          <p>New to TabCura Professional?</p>
          <button className="text-link" onClick={onGoToSignup}>Register as a Doctor</button>
          <button className="text-link secondary" onClick={onBackToLanding}>Back to Public Site</button>
        </div>
      </div>
    </div>
  );
};

export default DoctorLogin;
