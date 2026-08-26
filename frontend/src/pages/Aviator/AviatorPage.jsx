import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Aviator from '../../components/Aviator';
import './AviatorPage.css';

const AviatorPage = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsAuthenticated(false);
      navigate('/login', { state: { from: '/aviator' } });
    }
  }, [navigate]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="aviator-page">
      <div className="aviator-page-header">
        <h1>✈️ Aviator</h1>
        <p className="aviator-subtitle">Crash Game</p>
      </div>
      <div className="aviator-page-content">
        {/* ✅ Use the existing working Aviator component */}
        <Aviator />
      </div>
    </div>
  );
};

export default AviatorPage;