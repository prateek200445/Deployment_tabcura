import React, { useState } from 'react';
import './signup.css';

const Login = ({ onBackToLanding, onGoToSignup, onLoginSuccess, isDoctor = false }) => {
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
    
    // Basic validation
    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }
    if (!formData.password) {
      setError("Password is required");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('Sending login data to API:', { email: formData.email });
      
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const apiUrl = `${API_BASE_URL}/api/users/login`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          isDoctor: isDoctor  // Send isDoctor flag to backend
        }),
        credentials: 'omit' // Don't include credentials for now to simplify
      });

      // Get response as text first
      const responseText = await response.text();
      console.log('Raw API response:', responseText);
      
      // Check if the response is HTML (indicates an error page)
      if (responseText.trim().toLowerCase().startsWith('<!doctype html') || 
          responseText.includes('<html')) {
        console.error('Received HTML instead of JSON. Server might be throwing an error.');
        throw new Error('The server returned an HTML page instead of JSON. This usually indicates a server error.');
      }
      
      // Try to parse as JSON
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error(`The server returned an invalid response format. Please check server configuration.`);
      }

      if (!response.ok) {
        // Add better handling for database connectivity issues
        if (data.error && data.error.includes('connection')) {
          throw new Error('Unable to connect to the database. Please try again later.');
        } else {
          throw new Error(data.message || 'Login failed. Please check your credentials.');
        }
      }

      console.log('Login successful:', data);
      
      // Store JWT token in localStorage for authenticated requests and realtime sockets
      if (data.token) {
        try {
          localStorage.setItem('token', data.token);
        } catch (e) {
          console.warn('Failed to save token to localStorage:', e && e.message);
        }
      }

      // Navigate to profile with the user data from API
      // Add isDoctor flag if specified
      onLoginSuccess({
        ...data.user,
        isDoctor: data.user.isDoctor || isDoctor
      });
      
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle network errors specifically
      if (error.message === 'Failed to fetch' || !navigator.onLine) {
        setError('Network error. Please check your internet connection.');
      } else {
        setError(error.message || 'An error occurred during login. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        <div className="signup-header">
          <h1>{isDoctor ? 'Doctor Portal Login' : 'Welcome Back'}</h1>
          <p>
            {isDoctor 
              ? 'Access your TabCura healthcare provider dashboard'
              : 'Login to access your TabCura health records'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="signup-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              className="form-input"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              className="form-input"
              disabled={isLoading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className={`signup-button ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="signup-footer">
          <p>Don't have an account?</p>
          <button 
            className="login-link" 
            onClick={onGoToSignup}
            disabled={isLoading}
          >
            Sign Up
          </button>
        </div>
        
        <div className="signup-footer" style={{ marginTop: '10px' }}>
          <button 
            className="login-link" 
            onClick={onBackToLanding}
            disabled={isLoading}
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
