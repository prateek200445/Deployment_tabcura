import React, { useState, useEffect } from 'react';
import Landing from './pages/landing';
import Login from './pages/login';
import SignUp from './pages/signup';
import Profile from './pages/profile';
import Subscription from './pages/subscription';
import DoctorPortal from './pages/doctorPortal';
import DoctorLogin from './pages/DoctorLogin';
import DoctorSignup from './pages/DoctorSignup';

const App = () => {
  const [currentPage, setCurrentPage] = useState('landing');
  const [userData, setUserData] = useState(null);
  const [isDoctorLogin, setIsDoctorLogin] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload && payload.id) {
          fetch(`${API_BASE_URL}/api/users/${payload.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          .then(res => res.json())
          .then(data => {
            if (data.success && data.user) {
              setUserData(data.user);
              setIsDoctorLogin(data.user.isDoctor || false);
              setCurrentPage(data.user.isDoctor ? 'doctorPortal' : 'profile');
            } else {
              localStorage.removeItem('token');
            }
          })
          .catch(err => {
            console.error('Session restore error:', err);
            localStorage.removeItem('token');
          })
          .finally(() => {
            setIsRestoringSession(false);
          });
        } else {
          setIsRestoringSession(false);
        }
      } catch (err) {
        console.error('Invalid token format:', err);
        localStorage.removeItem('token');
        setIsRestoringSession(false);
      }
    } else {
      setIsRestoringSession(false);
    }
  }, []);

  if (isRestoringSession) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc', color: '#3b82f6', fontSize: '1.2rem', fontFamily: 'system-ui' }}>Loading TabCura...</div>;
  }

  const navigateToLanding = () => {
    setCurrentPage('landing');
    setIsDoctorLogin(false);
  };

  const navigateToLogin = (type = 'user') => {
    setCurrentPage('login');
    setIsDoctorLogin(type === 'doctor');
  };

  const navigateToSignup = () => {
    setCurrentPage('signup');
    setIsDoctorLogin(false);
  };

  const navigateToProfile = (user) => {
    setUserData(user);
    setCurrentPage(user.isDoctor ? 'doctorPortal' : 'profile');
  };
  
  const navigateToSubscription = () => {
    setCurrentPage('subscription');
  };
  
  const navigateToDoctorPortal = () => {
    if (userData && userData.isDoctor) {
      setCurrentPage('doctorPortal');
    } else {
      setCurrentPage('doctorLogin');
    }
  };

  const navigateToDoctorSignup = () => {
    setCurrentPage('doctorSignup');
  };

  const navigateToUserDashboard = () => {
    if (userData) {
      setCurrentPage('profile');
    } else {
      navigateToLogin('user');
    }
  };

  const handleLogout = () => {
    // Clear user state and stored auth token
    setUserData(null);
    setCurrentPage('landing');
    setIsDoctorLogin(false);
    try {
      localStorage.removeItem('token');
    } catch (e) {
      console.warn('Failed to remove token from localStorage:', e && e.message);
    }
  };

  // Render the appropriate component based on currentPage
  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return <Login 
          onBackToLanding={navigateToLanding} 
          onGoToSignup={navigateToSignup}
          onLoginSuccess={navigateToProfile}
          isDoctor={isDoctorLogin}
        />;
      case 'signup':
        return <SignUp 
          onBackToLanding={navigateToLanding} 
          onGoToLogin={navigateToLogin}
          onGoToProfile={navigateToProfile}
        />;
      case 'profile':
        return <Profile 
          user={userData} 
          onLogout={handleLogout}
          onNavigateToSubscription={navigateToSubscription}
        />;
      case 'subscription':
        return <Subscription
          onBackToProfile={() => setCurrentPage(userData?.isDoctor ? 'doctorPortal' : 'profile')}
        />;
      case 'doctorLogin':
        return <DoctorLogin 
          onBackToLanding={navigateToLanding}
          onGoToSignup={navigateToDoctorSignup}
          onLoginSuccess={navigateToProfile}
        />;
      case 'doctorSignup':
        return <DoctorSignup 
          onBackToLanding={navigateToLanding}
          onGoToLogin={navigateToDoctorPortal}
          onGoToProfile={navigateToProfile}
        />;
      case 'doctorPortal':
        return <DoctorPortal
          user={userData}
          onLogout={handleLogout}
        />;
      default:
        return <Landing 
          onLogin={navigateToLogin} 
          onSignup={navigateToSignup} 
          onGetStarted={navigateToSignup}
          onDoctorPortal={navigateToDoctorPortal}
        />;
    }
  };

  return (
    <div className="app">
      {renderPage()}
    </div>
  );
};

export default App;
