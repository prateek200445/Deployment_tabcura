import React, { useState, useEffect } from 'react';
import './doctorPortal.css';

const DoctorPortal = ({ user = {}, onLogout }) => {
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDisease, setSelectedDisease] = useState('all');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [newCategorization, setNewCategorization] = useState({ 
    disease: '', 
    notes: '' 
  });

  // Add a constant for the API base URL
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Ensure user object has all required properties with defaults
  const safeUser = {
    id: user?.id || "",
    name: user?.name || "Dr. Sarah Johnson",
    email: user?.email || "dr.sarah@example.com",
    username: user?.username || "dr.sarah",
    specialty: user?.specialty || "Cardiologist"
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    // Apply filtering when selectedDisease changes
    if (selectedDisease === 'all') {
      setFilteredPatients(patients);
    } else {
      setFilteredPatients(
        patients.filter(patient => 
          patient.diseases.some(d => d.name.toLowerCase() === selectedDisease.toLowerCase())
        )
      );
    }
  }, [selectedDisease, patients]);

  useEffect(() => {
    // Apply search filtering
    if (searchTerm.trim() === '') {
      // If search is empty, just apply disease filter
      if (selectedDisease === 'all') {
        setFilteredPatients(patients);
      } else {
        setFilteredPatients(
          patients.filter(patient => 
            patient.diseases.some(d => d.name.toLowerCase() === selectedDisease.toLowerCase())
          )
        );
      }
    } else {
      // Apply both search and disease filter
      const filtered = patients.filter(patient => {
        const matchesSearch = (
          patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          patient.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        const matchesDisease = selectedDisease === 'all' || 
          patient.diseases.some(d => d.name.toLowerCase() === selectedDisease.toLowerCase());
          
        return matchesSearch && matchesDisease;
      });
      
      setFilteredPatients(filtered);
    }
  }, [searchTerm, selectedDisease, patients]);

  const fetchPatients = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // In a real app, you would fetch data from the API
      // For now, we'll use mock data
      const mockPatientsData = [
        {
          id: '1',
          name: 'John Smith',
          email: 'john@example.com',
          age: 45,
          documents: [
            { id: 'd1', name: 'Blood Test Results', date: '2023-05-10', type: 'Lab Report' },
            { id: 'd2', name: 'ECG Report', date: '2023-06-15', type: 'Diagnostic' }
          ],
          diseases: [
            { name: 'Hypertension', diagnosedOn: '2022-01-15', notes: 'Moderate, controlled with medication' },
            { name: 'Diabetes Type 2', diagnosedOn: '2021-03-22', notes: 'Early stage' }
          ],
          lastVisit: '2023-06-15'
        },
        {
          id: '2',
          name: 'Mary Johnson',
          email: 'mary@example.com',
          age: 38,
          documents: [
            { id: 'd3', name: 'MRI Report', date: '2023-04-20', type: 'Diagnostic' }
          ],
          diseases: [
            { name: 'Migraine', diagnosedOn: '2020-11-10', notes: 'Chronic, triggered by stress' }
          ],
          lastVisit: '2023-04-20'
        },
        {
          id: '3',
          name: 'James Williams',
          email: 'james@example.com',
          age: 52,
          documents: [
            { id: 'd4', name: 'Cholesterol Panel', date: '2023-07-05', type: 'Lab Report' },
            { id: 'd5', name: 'Stress Test Results', date: '2023-07-05', type: 'Diagnostic' }
          ],
          diseases: [
            { name: 'Hypertension', diagnosedOn: '2019-08-14', notes: 'Well-controlled' },
            { name: 'Hyperlipidemia', diagnosedOn: '2019-08-14', notes: 'On statins' }
          ],
          lastVisit: '2023-07-05'
        },
        {
          id: '4',
          name: 'Patricia Brown',
          email: 'patricia@example.com',
          age: 65,
          documents: [
            { id: 'd6', name: 'Echocardiogram', date: '2023-02-18', type: 'Diagnostic' }
          ],
          diseases: [
            { name: 'Atrial Fibrillation', diagnosedOn: '2020-05-22', notes: 'Intermittent' },
            { name: 'Hypertension', diagnosedOn: '2018-03-10', notes: 'Long history, requires multiple medications' }
          ],
          lastVisit: '2023-02-18'
        }
      ];
      
      setPatients(mockPatientsData);
      setFilteredPatients(mockPatientsData);
      
      // In a real app, you would use this:
      // const response = await fetch(`${API_BASE_URL}/api/doctor/patients`);
      // if (!response.ok) throw new Error('Failed to fetch patients');
      // const data = await response.json();
      // setPatients(data.patients);
      // setFilteredPatients(data.patients);
      
    } catch (error) {
      console.error('Error fetching patients:', error);
      setError('Failed to load patients. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const getAllDiseases = () => {
    const diseasesSet = new Set();
    
    patients.forEach(patient => {
      patient.diseases.forEach(disease => {
        diseasesSet.add(disease.name);
      });
    });
    
    return Array.from(diseasesSet).sort();
  };

  const openPatientModal = (patient) => {
    setSelectedPatient(patient);
    setShowPatientModal(true);
    setNewCategorization({ disease: '', notes: '' });
  };

  const closePatientModal = () => {
    setShowPatientModal(false);
    setSelectedPatient(null);
  };

  const handleCategorizePatient = () => {
    if (!newCategorization.disease.trim()) {
      alert('Please enter a disease name');
      return;
    }

    // In a real app, you would send this to the API
    // For now, we'll just update our local state
    const updatedPatients = patients.map(patient => {
      if (patient.id === selectedPatient.id) {
        return {
          ...patient,
          diseases: [
            ...patient.diseases,
            { 
              name: newCategorization.disease, 
              diagnosedOn: new Date().toISOString().split('T')[0], 
              notes: newCategorization.notes 
            }
          ]
        };
      }
      return patient;
    });

    setPatients(updatedPatients);
    closePatientModal();
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo"><img src="/tabcura.png" alt="TabCura Dashboard Preview" /></div>
        </div>
        <div className="sidebar-menu">
          <button 
            className="menu-item active"
          >
            <span className="menu-icon">👥</span>
            <span>Patients</span>
          </button>
          <button 
            className="menu-item"
          >
            <span className="menu-icon">📊</span>
            <span>Analytics</span>
          </button>
          <button 
            className="menu-item"
          >
            <span className="menu-icon">📆</span>
            <span>Appointments</span>
          </button>
          <button 
            className="menu-item"
          >
            <span className="menu-icon">💊</span>
            <span>Prescriptions</span>
          </button>
          <button 
            className="menu-item"
          >
            <span className="menu-icon">⚙️</span>
            <span>Settings</span>
          </button>
        </div>
        <div className="sidebar-footer">
          <button className="logout-button" onClick={onLogout}>
            <span className="menu-icon">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="dashboard-header">
          <div className="page-title">
            <h1>Doctor Portal</h1>
          </div>
          <div className="header-actions">
            <div className="search-bar">
              <input 
                type="text" 
                placeholder="Search patients..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="search-button">🔍</button>
            </div>
            <div className="user-profile">
              <div className="user-avatar">{safeUser.name.charAt(0)}</div>
              <div className="user-name">{safeUser.name}</div>
              <div className="user-role">{safeUser.specialty}</div>
            </div>
          </div>
        </header>
        
        {/* Doctor Portal Content */}
        <div className="dashboard-content">
          <div className="doctor-portal-header">
            <h2>Patient Management</h2>
            <div className="disease-filter">
              <label>Filter by Disease:</label>
              <select
                value={selectedDisease}
                onChange={(e) => setSelectedDisease(e.target.value)}
              >
                <option value="all">All Diseases</option>
                {getAllDiseases().map((disease) => (
                  <option key={disease} value={disease}>{disease}</option>
                ))}
              </select>
            </div>
          </div>
          
          {isLoading ? (
            <div className="loading-indicator">Loading patients...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : (
            <div className="patients-table-container">
              <table className="patients-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Age</th>
                    <th>Diseases</th>
                    <th>Documents</th>
                    <th>Last Visit</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.length > 0 ? (
                    filteredPatients.map(patient => (
                      <tr key={patient.id}>
                        <td>
                          <div className="patient-name">{patient.name}</div>
                          <div className="patient-email">{patient.email}</div>
                        </td>
                        <td>{patient.age}</td>
                        <td>
                          <div className="disease-tags">
                            {patient.diseases.map((disease, idx) => (
                              <span key={idx} className="disease-tag">{disease.name}</span>
                            ))}
                          </div>
                        </td>
                        <td>{patient.documents.length} documents</td>
                        <td>{patient.lastVisit}</td>
                        <td>
                          <button 
                            className="view-patient-btn"
                            onClick={() => openPatientModal(patient)}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="no-records">
                        No patients match your search criteria
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Patient Detail Modal */}
      {showPatientModal && selectedPatient && (
        <div className="modal-overlay">
          <div className="modal-container patient-modal">
            <div className="modal-header">
              <h2>Patient Details: {selectedPatient.name}</h2>
              <button className="close-button" onClick={closePatientModal}>×</button>
            </div>
            <div className="modal-content">
              <div className="patient-info-grid">
                <div className="patient-info-section">
                  <h3>Patient Information</h3>
                  <div className="info-group">
                    <label>Name:</label>
                    <span>{selectedPatient.name}</span>
                  </div>
                  <div className="info-group">
                    <label>Email:</label>
                    <span>{selectedPatient.email}</span>
                  </div>
                  <div className="info-group">
                    <label>Age:</label>
                    <span>{selectedPatient.age}</span>
                  </div>
                  <div className="info-group">
                    <label>Last Visit:</label>
                    <span>{selectedPatient.lastVisit}</span>
                  </div>
                </div>
                
                <div className="patient-info-section">
                  <h3>Medical Conditions</h3>
                  {selectedPatient.diseases.length > 0 ? (
                    <div className="diseases-list">
                      {selectedPatient.diseases.map((disease, idx) => (
                        <div key={idx} className="disease-item">
                          <div className="disease-header">
                            <h4>{disease.name}</h4>
                            <span className="diagnosed-date">Diagnosed: {disease.diagnosedOn}</span>
                          </div>
                          <p className="disease-notes">{disease.notes}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No medical conditions recorded</p>
                  )}
                </div>
              </div>
              
              <div className="patient-documents">
                <h3>Documents</h3>
                {selectedPatient.documents.length > 0 ? (
                  <div className="documents-list">
                    {selectedPatient.documents.map((doc) => (
                      <div key={doc.id} className="document-item">
                        <div className="document-icon">📄</div>
                        <div className="document-details">
                          <h4>{doc.name}</h4>
                          <p>{doc.type} • {doc.date}</p>
                        </div>
                        <button className="view-document-btn">View</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No documents uploaded</p>
                )}
              </div>
              
              <div className="categorize-section">
                <h3>Categorize Patient</h3>
                <div className="categorize-form">
                  <div className="form-group">
                    <label htmlFor="disease">Disease:</label>
                    <input 
                      type="text" 
                      id="disease" 
                      value={newCategorization.disease}
                      onChange={(e) => setNewCategorization({...newCategorization, disease: e.target.value})}
                      placeholder="Enter disease name"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="notes">Notes:</label>
                    <textarea 
                      id="notes" 
                      value={newCategorization.notes}
                      onChange={(e) => setNewCategorization({...newCategorization, notes: e.target.value})}
                      placeholder="Enter notes about the condition"
                    ></textarea>
                  </div>
                  <button 
                    className="categorize-button"
                    onClick={handleCategorizePatient}
                  >
                    Add Category
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorPortal;
