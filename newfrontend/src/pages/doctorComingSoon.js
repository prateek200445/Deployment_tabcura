import React from 'react';
import './doctorComingSoon.css';

const DoctorComingSoon = ({ user = {}, onLogout, onSwitchToUserDashboard }) => {
  return (
    <div className="coming-soon-container">
      <nav className="coming-soon-nav">
        <div className="nav-logo">
          <img src={process.env.PUBLIC_URL + "/tabcura.png"} alt="TabCura Logo" />
        </div>
        <div className="nav-user">
          <div className="user-info">
            <span className="user-name">{(user && (user.name || user.username)) || 'Doctor'}</span>
            <span className="user-badge">Healthcare Provider</span>
          </div>
          <button onClick={onLogout} className="logout-btn">
            {user ? 'Logout' : 'Back to Home'}
          </button>
        </div>
      </nav>

      <main className="coming-soon-content">
        <div className="content-card">
          <div className="icon-wrapper">
            <div className="pulse-circle"></div>
            <span className="main-icon">👨‍⚕️</span>
          </div>
          
          <h1>Doctor Portal <span className="coming-tag">Coming Soon</span></h1>
          
          <div className="message-box">
            <p className="primary-text">
              We're currently building a powerful workspace for healthcare professionals.
            </p>
            <p className="secondary-text">
              Doctor portal is coming soon untill then you can use it as user and analyse your record save it its absolutely free
            </p>
          </div>

          <div className="features-preview">
            <div className="preview-item">
              <span className="item-icon">📋</span>
              <span>Patient Management</span>
            </div>
            <div className="preview-item">
              <span className="item-icon">📈</span>
              <span>Health Analytics</span>
            </div>
            <div className="preview-item">
              <span className="item-icon">📄</span>
              <span>Digital Prescriptions</span>
            </div>
          </div>

          <div className="action-buttons">
            <button 
              onClick={onSwitchToUserDashboard} 
              className="use-as-user-btn"
            >
              Go to User Dashboard
            </button>
          </div>
        </div>
      </main>

      <footer className="coming-soon-footer">
        <p>&copy; 2025 TabCura Health. Empowering doctors and patients.</p>
      </footer>
    </div>
  );
};

export default DoctorComingSoon;
