import React, { useState } from 'react';
import './signup.css'; // We'll create this with styling similar to login.css

const SignUp = ({ onBackToLanding, onGoToLogin, onGoToProfile }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    gender: ''
  });
  
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const validateStep1 = () => {
    if (!formData.firstName.trim()) return "First name is required";
    if (!formData.lastName.trim()) return "Last name is required";
    if (!formData.email.trim()) return "Email is required";
    if (!/\S+@\S+\.\S+/.test(formData.email)) return "Email format is invalid";
    return "";
  };

  const validateStep2 = () => {
    if (!formData.username.trim()) return "Username is required";
    if (formData.username.length < 4) return "Username must be at least 4 characters";
    if (!formData.password) return "Password is required";
    if (formData.password.length < 6) return "Password must be at least 6 characters";
    if (formData.password !== formData.confirmPassword) return "Passwords do not match";
    return "";
  };

  const handleNextStep = () => {
    const error = validateStep1();
    if (error) {
      setError(error);
      return;
    }
    setError('');
    setStep(2);
  };

  const handlePrevStep = () => {
    setError('');
    setStep(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateStep2();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Prepare data for API
      const userData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        username: formData.username,
        password: formData.password,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender
      };

      console.log('Sending registration data to API:', userData);

      // Attempt to connect to a different port if the default fails
      // The server may be running on a different port
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      let apiUrl = `${API_BASE_URL}/api/users/register`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(userData),
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
        // Handle MongoDB duplicate key errors more gracefully
        if (data.error && data.error.includes('duplicate key')) {
          if (data.error.includes('email')) {
            throw new Error('An account with this email already exists.');
          } else if (data.error.includes('username')) {
            throw new Error('This username is already taken. Please choose another.');
          } else {
            throw new Error(data.message || 'Failed to register. Please try again.');
          }
        } else {
          throw new Error(data.message || 'Failed to register. Please try again.');
        }
      }

      console.log('Registration successful:', data);
      
      // Navigate to profile page with the new user data
      onGoToProfile({
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        username: formData.username
      });
      
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message || 'An error occurred during registration. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <>
      <div className="form-group">
        <label htmlFor="firstName">First Name</label>
        <input
          type="text"
          id="firstName"
          name="firstName"
          placeholder="Enter your first name"
          value={formData.firstName}
          onChange={handleChange}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="lastName">Last Name</label>
        <input
          type="text"
          id="lastName"
          name="lastName"
          placeholder="Enter your last name"
          value={formData.lastName}
          onChange={handleChange}
          className="form-input"
        />
      </div>

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
        />
      </div>

      <div className="form-group">
        <label htmlFor="dateOfBirth">Date of Birth</label>
        <input
          type="date"
          id="dateOfBirth"
          name="dateOfBirth"
          value={formData.dateOfBirth}
          onChange={handleChange}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="gender">Gender</label>
        <select
          id="gender"
          name="gender"
          value={formData.gender}
          onChange={handleChange}
          className="form-input"
        >
          <option value="">Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
          <option value="prefer-not-to-say">Prefer not to say</option>
        </select>
      </div>

      {error && <div className="error-message">{error}</div>}

      <button type="button" className="signup-button" onClick={handleNextStep}>
        Next Step
      </button>
    </>
  );

  const renderStep2 = () => (
    <>
      <div className="form-group">
        <label htmlFor="username">Username</label>
        <input
          type="text"
          id="username"
          name="username"
          placeholder="Choose a username"
          value={formData.username}
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
          placeholder="Create a password"
          value={formData.password}
          onChange={handleChange}
          className="form-input"
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="confirmPassword">Confirm Password</label>
        <input
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          placeholder="Confirm your password"
          value={formData.confirmPassword}
          onChange={handleChange}
          className="form-input"
          disabled={isLoading}
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="button-group">
        <button 
          type="button" 
          className="back-button" 
          onClick={handlePrevStep}
          disabled={isLoading}
        >
          Back
        </button>
        <button 
          type="submit" 
          className={`signup-button ${isLoading ? 'loading' : ''}`}
          disabled={isLoading}
        >
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </button>
      </div>
    </>
  );

  return (
    <div className="signup-container">
      <div className="signup-card">
        <div className="signup-header">
          <h1>Create an Account</h1>
          <p>Join TabCura's secure medical repository</p>
        </div>

        <div className="step-indicator">
          <div className={`step ${step === 1 ? 'active' : ''}`}>1. Personal Info</div>
          <div className={`step ${step === 2 ? 'active' : ''}`}>2. Account Setup</div>
        </div>

        <form onSubmit={handleSubmit} className="signup-form">
          {step === 1 ? renderStep1() : renderStep2()}
        </form>

        <div className="signup-footer">
          <p>Already have an account?</p>
          <button 
            className="login-link" 
            onClick={onGoToLogin}
            disabled={isLoading}
          >
            Login
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

export default SignUp;
