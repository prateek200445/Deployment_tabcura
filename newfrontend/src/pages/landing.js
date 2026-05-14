import React from 'react';
import './landing.css';

const Landing = ({ onLogin, onSignup, onGetStarted }) => {
  return (
    <div className="landing-container">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-logo"> <img src="/tabcura.png" alt="TabCura Dashboard Preview" /></div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it Works</a>
          <a href="#testimonials">Testimonials</a>
          <a href="#contact">Contact</a>
        </div>
        <div className="nav-auth">
          <button onClick={onLogin} className="login-button">Login</button>
          <button onClick={onSignup} className="signup-button">Sign Up</button>
          <button onClick={() => onLogin('doctor')} className="doctor-button">Doctor Portal</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1>Your Health Records, <span className="accent">Simplified</span></h1>
          <p>Securely store, track, and share your medical history and health records all in one place.</p>
          <div className="hero-buttons">
            <button onClick={onGetStarted} className="get-started-button">Get Started</button>
            <a href="#how-it-works" className="learn-more-button">Learn More</a>
          </div>
          <div className="stats-container">
            <div className="stat-item">
              <span className="stat-number">10k+</span>
              <span className="stat-label">Users</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">100+</span>
              <span className="stat-label">Healthcare Providers</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">98%</span>
              <span className="stat-label">Satisfaction Rate</span>
            </div>
          </div>
        </div>
        <div className="hero-image">
          <img src="/dashboard.png" alt="TabCura Dashboard Preview" />
          {/* Note: You'll need to add this image to your public directory */}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="section-header">
          <h2>Why Choose TabCura?</h2>
          <p>Our platform offers everything you need to manage your health information effectively.</p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon secure"></div>
            <h3>Secure Storage</h3>
            <p>Your medical records are encrypted and securely stored with bank-level security.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon access"></div>
            <h3>Easy Access</h3>
            <p>Access your health information anytime, anywhere from any device.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon share"></div>
            <h3>Simple Sharing</h3>
            <p>Securely share your records with healthcare providers when needed.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon ai"></div>
            <h3>AI-Powered Insights</h3>
            <p>Get personalized health insights and recommendations based on your data.</p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works-section">
        <div className="section-header">
          <h2>How It Works</h2>
          <p>Getting started with TabCura is easy and straightforward.</p>
        </div>
        <div className="steps-container">
          <div className="step-item">
            <div className="step-number">1</div>
            <h3>Sign Up</h3>
            <p>Create your secure account in minutes with just basic information.</p>
          </div>
          <div className="step-item">
            <div className="step-number">2</div>
            <h3>Upload Records</h3>
            <p>Upload your existing medical documents and health records.</p>
          </div>
          <div className="step-item">
            <div className="step-number">3</div>
            <h3>Organize & Access</h3>
            <p>Your information is automatically organized and accessible anytime.</p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="testimonials-section">
        <div className="section-header">
          <h2>What Our Users Say</h2>
          <p>We've helped thousands of people manage their health information better.</p>
        </div>
        <div className="testimonials-container">
          <div className="testimonial-card">
            <div className="testimonial-content">
              <p>"TabCura has been a game-changer for managing my family's health records. No more carrying folders to doctor appointments!"</p>
            </div>
            <div className="testimonial-author">
              <div className="author-avatar">JS</div>
              <div className="author-info">
                <h4>Jennifer S.</h4>
                <p>User for 2 years</p>
              </div>
            </div>
          </div>
          <div className="testimonial-card">
            <div className="testimonial-content">
              <p>"As someone with multiple chronic conditions, having all my medical history in one place has made coordinating care so much easier."</p>
            </div>
            <div className="testimonial-author">
              <div className="author-avatar">MD</div>
              <div className="author-info">
                <h4>Michael D.</h4>
                <p>User for 1 year</p>
              </div>
            </div>
          </div>
          <div className="testimonial-card">
            <div className="testimonial-content">
              <p>"The prescription tracking feature alone is worth it. I never forget to refill medications now!"</p>
            </div>
            <div className="testimonial-author">
              <div className="author-avatar">LT</div>
              <div className="author-info">
                <h4>Lisa T.</h4>
                <p>User for 6 months</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Add a section about Doctor Portal before Footer */}
      <section id="doctor-portal" className="doctor-portal-section">
        <div className="section-header">
          <h2>Healthcare Provider Portal</h2>
          <p>A dedicated platform for doctors to manage patient documents and treatments</p>
        </div>
        <div className="doctor-portal-content">
          <div className="doctor-portal-image">
            <img src="/doctor-portal.png" alt="Doctor Portal Interface" />
          </div>
          <div className="doctor-portal-features">
            <h3>For Healthcare Providers</h3>
            <ul className="doctor-feature-list">
              <li>
                <div className="feature-icon">👁️</div>
                <div className="feature-text">
                  <h4>Document Access</h4>
                  <p>View patient records easily when they've shared with you</p>
                </div>
              </li>
              <li>
                <div className="feature-icon">🏷️</div>
                <div className="feature-text">
                  <h4>Patient Categorization</h4>
                  <p>Organize patients by condition for efficient care management</p>
                </div>
              </li>
              <li>
                <div className="feature-icon">📊</div>
                <div className="feature-text">
                  <h4>Treatment Tracking</h4>
                  <p>Monitor patient progress across multiple visits</p>
                </div>
              </li>
            </ul>
            <button onClick={() => onLogin('doctor')} className="doctor-cta-button">
              Access Doctor Portal
            </button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Ready to take control of your health records?</h2>
          <p>Join thousands of users who are managing their health information better with TabCura.</p>
          <button onClick={onGetStarted} className="cta-button">Get Started for Free</button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <div className="logo">TabCura</div>
            <p>Your personal health records manager.</p>
          </div>
          <div className="footer-links">
            <div className="footer-link-group">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="footer-link-group">
              <h4>Company</h4>
              <a href="#about">About Us</a>
              <a href="#careers">Careers</a>
              <a href="#press">Press</a>
              <a href="#contact">Contact</a>
            </div>
            <div className="footer-link-group">
              <h4>Legal</h4>
              <a href="#terms">Terms of Service</a>
              <a href="#privacy">Privacy Policy</a>
              <a href="#security">Security</a>
              <a href="#compliance">Compliance</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 TabCura. All rights reserved.</p>
          <div className="social-links">
            <a href="#twitter" className="social-link">Twitter</a>
            <a href="#linkedin" className="social-link">LinkedIn</a>
            <a href="#facebook" className="social-link">Facebook</a>
            <a href="#instagram" className="social-link">Instagram</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
