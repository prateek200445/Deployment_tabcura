import React, { useState } from 'react';
import './doctorAuth.css';

const DoctorSignup = ({ onBackToLanding, onGoToLogin, onGoToProfile }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    specialty: '',
    licenseNumber: '',
    hospital: ''
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
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
      setError("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      
      // Generate username from email if not provided
      const signupData = { ...formData };
      if (!signupData.username) {
        signupData.username = signupData.email.split('@')[0] + Math.floor(Math.random() * 1000);
      }

      const response = await fetch(`${API_BASE_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...signupData,
          isDoctor: true
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      onGoToProfile({
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
      <div className="doctor-auth-card signup">
        <div className="doctor-auth-header">
          <div className="auth-logo">
            <img src={process.env.PUBLIC_URL + "/tabcura.png"} alt="TabCura" />
          </div>
          <h1>Doctor Registration</h1>
          <p>Join our professional healthcare network</p>
        </div>

        <form onSubmit={handleSubmit} className="doctor-auth-form">
          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input type="text" name="firstName" placeholder="John" value={formData.firstName} onChange={handleChange} disabled={isLoading} />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input type="text" name="lastName" placeholder="Doe" value={formData.lastName} onChange={handleChange} disabled={isLoading} />
            </div>
          </div>

          <div className="form-group">
            <label>Professional Email</label>
            <input type="email" name="email" placeholder="dr.doe@hospital.com" value={formData.email} onChange={handleChange} disabled={isLoading} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Specialty</label>
              <select name="specialty" value={formData.specialty} onChange={handleChange} disabled={isLoading}>
                <option value="">Select Specialty</option>
                <option value="General Practitioner">General Practitioner</option>
                <option value="Cardiologist">Cardiologist</option>
                <option value="Neurologist">Neurologist</option>
                <option value="Pediatrician">Pediatrician</option>
                <option value="Surgeon">Surgeon</option>
              </select>
            </div>
            <div className="form-group">
              <label>License Number</label>
              <input type="text" name="licenseNumber" placeholder="MED-12345" value={formData.licenseNumber} onChange={handleChange} disabled={isLoading} />
            </div>
          </div>

          <div className="form-group">
            <label>Create Password</label>
            <input type="password" name="password" placeholder="••••••••" value={formData.password} onChange={handleChange} disabled={isLoading} />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button 
            type="submit" 
            className={`doctor-auth-btn ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Complete Registration'}
          </button>
        </form>

        <div className="doctor-auth-footer">
          <p>Already have a professional account?</p>
          <button className="text-link" onClick={onGoToLogin}>Login to Portal</button>
        </div>
      </div>
    </div>
  );
};

export default DoctorSignup;
