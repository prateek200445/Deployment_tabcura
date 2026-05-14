import React, { useState } from 'react';
import './subscription.css';

const Subscription = ({ onBackToProfile }) => {
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  
  const plans = {
    monthly: {
      basic: {
        price: 'Rs49.99',
        period: 'month',
        features: [
          '5GB document storage',
          'Basic health analytics',
          'Document sharing',
          'Email support'
        ]
      },
      premium: {
        price: 'Rs199.99',
        period: 'month',
        popular: true,
        features: [
          '25GB document storage',
          'Advanced health analytics',
          'Priority document sharing',
          'Priority email & phone support',
          'Family member accounts (up to 3)',
          'Custom health insights'
        ]
      },
      enterprise: {
        price: 'Rs499.99',
        period: 'month',
        features: [
          'Unlimited document storage',
          'Enterprise-grade health analytics',
          'Unlimited document sharing',
          '24/7 dedicated support',
          'Family member accounts (up to 10)',
          'Custom health insights',
          'API access',
          'White-label options'
        ]
      }
    },
    annual: {
      basic: {
        price: 'Rs299.99',
        period: 'year',
        features: [
          '5GB document storage',
          'Basic health analytics',
          'Document sharing',
          'Email support'
        ]
      },
      premium: {
        price: 'Rs1999.99',
        period: 'year',
        popular: true,
        features: [
          '25GB document storage',
          'Advanced health analytics',
          'Priority document sharing',
          'Priority email & phone support',
          'Family member accounts (up to 3)',
          'Custom health insights'
        ]
      },
      enterprise: {
        price: 'Rs3499.99',
        period: 'year',
        features: [
          'Unlimited document storage',
          'Enterprise-grade health analytics',
          'Unlimited document sharing',
          '24/7 dedicated support',
          'Family member accounts (up to 10)',
          'Custom health insights',
          'API access',
          'White-label options'
        ]
      }
    }
  };

  const handleSubscribe = (tier) => {
    alert(`Thank you for selecting the ${tier} plan! This would redirect to payment processing.`);
  };

  return (
    <div className="subscription-container">
      <div className="subscription-header">
        <button className="back-button" onClick={onBackToProfile}>
          ← Back to Dashboard
        </button>
        <h1>TabCura Premium Subscription</h1>
        <p>Upgrade your health records experience with our premium features</p>
      </div>

      <div className="plan-toggle">
        <button 
          className={`toggle-button ${selectedPlan === 'monthly' ? 'active' : ''}`}
          onClick={() => setSelectedPlan('monthly')}
        >
          Monthly Billing
        </button>
        <button 
          className={`toggle-button ${selectedPlan === 'annual' ? 'active' : ''}`}
          onClick={() => setSelectedPlan('annual')}
        >
          Annual Billing <span className="discount-badge">Save 15%</span>
        </button>
      </div>

      <div className="subscription-plans">
        {/* Basic Plan */}
        <div className="plan-card">
          <div className="plan-header">
            <h2>Basic</h2>
            <div className="plan-price">
              <span className="price">{plans[selectedPlan].basic.price}</span>
              <span className="period">/{plans[selectedPlan].basic.period}</span>
            </div>
            <p className="plan-description">For individuals just getting started</p>
          </div>
          <div className="plan-features">
            <ul>
              {plans[selectedPlan].basic.features.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
          <button 
            className="subscribe-button basic"
            onClick={() => handleSubscribe('Basic')}
          >
            Subscribe to Basic
          </button>
        </div>

        {/* Premium Plan */}
        <div className="plan-card premium">
          {plans[selectedPlan].premium.popular && <div className="popular-tag">Most Popular</div>}
          <div className="plan-header">
            <h2>Premium</h2>
            <div className="plan-price">
              <span className="price">{plans[selectedPlan].premium.price}</span>
              <span className="period">/{plans[selectedPlan].premium.period}</span>
            </div>
            <p className="plan-description">Perfect for health-conscious individuals</p>
          </div>
          <div className="plan-features">
            <ul>
              {plans[selectedPlan].premium.features.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
          <button 
            className="subscribe-button premium"
            onClick={() => handleSubscribe('Premium')}
          >
            Subscribe to Premium
          </button>
        </div>

        {/* Enterprise Plan */}
        <div className="plan-card">
          <div className="plan-header">
            <h2>Enterprise</h2>
            <div className="plan-price">
              <span className="price">{plans[selectedPlan].enterprise.price}</span>
              <span className="period">/{plans[selectedPlan].enterprise.period}</span>
            </div>
            <p className="plan-description">For large families and organizations</p>
          </div>
          <div className="plan-features">
            <ul>
              {plans[selectedPlan].enterprise.features.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
          <button 
            className="subscribe-button enterprise"
            onClick={() => handleSubscribe('Enterprise')}
          >
            Subscribe to Enterprise
          </button>
        </div>
      </div>

      <div className="subscription-footer">
        <h3>100% Satisfaction Guarantee</h3>
        <p>Try TabCura Premium risk-free. If you're not satisfied within 30 days, we'll refund your subscription.</p>
        <div className="payment-methods">
          <span>We accept:</span>
          <div className="payment-icons">
            <span className="payment-icon">💳 Credit Card</span>
            <span className="payment-icon">🏦 PayPal</span>
            <span className="payment-icon">📱 Apple Pay</span>
            <span className="payment-icon">📱 Google Pay</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
