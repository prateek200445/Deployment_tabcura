import React, { useState } from 'react';
import './doctorPortal.css';

const DoctorPortal = ({ user = {}, onLogout }) => {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Doctor Profile State
  const [doctorProfile, setDoctorProfile] = useState({
    name: user?.name || "Dr. Rahul Sharma",
    specs: user?.specialty || "(MD, MBBS)",
    email: user?.email || "rahul.sharma@tabcura.com",
    avatar: user?.name ? user.name.charAt(0) : "R",
    hospital: "City General Hospital",
    bio: "Senior Consultant with over 12 years of experience in clinical medicine."
  });

  const [schedule, setSchedule] = useState([
    { id: 1, time: "10:00 AM", patient: "Sarah Johnson", type: "Follow-up", status: "Confirmed" },
    { id: 2, time: "10:30 AM", patient: "David Chen", type: "Initial Consult", status: "In-Progress" },
    { id: 3, time: "11:15 AM", patient: "Emily Davis", type: "Procedure Post-Op", status: "Pending" },
    { id: 4, time: "01:00 PM", patient: "Michael Brown", type: "Regular Checkup", status: "Confirmed" }
  ]);

  const [patients, setPatients] = useState([
    { id: 1, name: "Sarah Johnson", age: 34, gender: "Female", condition: "Post-Op Recovery", lastVisit: "2024-05-10" },
    { id: 2, name: "David Chen", age: 45, gender: "Male", condition: "Hypertension", lastVisit: "2024-05-12" },
    { id: 3, name: "Emily Davis", age: 28, gender: "Female", condition: "Annual Wellness", lastVisit: "2024-05-14" },
    { id: 4, name: "Alex Reed", age: 52, gender: "Male", condition: "Type 2 Diabetes", lastVisit: "2024-05-08" }
  ]);

  const [pendingDocs, setPendingDocs] = useState([
    { id: 1, name: "lab_results_A.pdf", patient: "Alex R." },
    { id: 2, name: "prescription_refill_M.pdf", patient: "Mia K." },
    { id: 3, name: "xray_report_J.jpeg", patient: "John D." }
  ]);

  const [prescriptions, setPrescriptions] = useState([
    { id: 1, patient: "Sarah Johnson", med: "Amoxicillin", dosage: "500mg", status: "Active" },
    { id: 2, patient: "David Chen", med: "Lisinopril", dosage: "10mg", status: "Active" },
    { id: 3, patient: "Alex Reed", med: "Metformin", dosage: "850mg", status: "Renewal Due" }
  ]);

  const [modal, setModal] = useState({ show: false, title: '', content: '' });

  const stats = [
    { label: "Active Patients", value: patients.length, icon: "👥", color: "blue" },
    { label: "Appointments Today", value: schedule.length, icon: "📅", color: "green" },
    { label: "Medical Documents Reviewed", value: "212", icon: "📄", color: "purple" },
    { label: "Associated Hospitals", value: "3", icon: "🏥", color: "orange" }
  ];

  const handleAction = (action, title) => {
    setModal({
      show: true,
      title: action,
      content: `Simulating ${action.toLowerCase()} for ${title}. This module is currently in Demo mode and will be fully linked to the backend production database shortly.`
    });
  };

  const updateProfile = (e) => {
    const { name, value } = e.target;
    setDoctorProfile({ ...doctorProfile, [name]: value });
  };

  const renderDashboard = () => (
    <>
      <section className="stats-grid">
        {stats.map((stat, idx) => (
          <div key={idx} className="stat-card">
            <div className={`stat-icon ${stat.color}`}>{stat.icon}</div>
            <div className="stat-details">
              <h3>{stat.value}</h3>
              <p>{stat.label}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="ai-section">
        <div className="section-header">
          <h2>AI Doctor Assistant</h2>
          <button className="btn-text" onClick={() => handleAction("AI Directory", "All Tools")}>View All Tools</button>
        </div>
        <div className="ai-grid">
          {[
            { id: 1, title: "Patient Health Summary", desc: "Digital breakdown of prescriptions", icon: "📄" },
            { id: 2, title: "Lab Interpretation", desc: "Insights from health reports", icon: "🧪" },
            { id: 3, title: "Protocol Suggester", desc: "Preliminary clinical guidance", icon: "⚕️" },
            { id: 4, title: "AI Dictation Flow", desc: "Instant voice-to-text health notes", icon: "🎤" }
          ].map(tool => (
            <div key={tool.id} className="ai-card" onClick={() => handleAction("Opening AI Tool", tool.title)}>
              <div className="ai-card-icon">{tool.icon}</div>
              <h4>{tool.title}</h4>
              <p>{tool.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bottom-grid">
        <div className="content-card">
          <div className="card-header"><h2>Today's Schedule</h2></div>
          <div className="card-content">
            {schedule.slice(0, 3).map(item => (
              <div key={item.id} className="list-item">
                <div className="item-left">
                  <span className="time-slot">{item.time}</span>
                  <div className="item-info"><h4>{item.patient}</h4><p>{item.type}</p></div>
                </div>
                <button className="btn-small btn-primary" onClick={() => handleAction("Starting Session", item.patient)}>Start</button>
              </div>
            ))}
          </div>
        </div>
        <div className="content-card">
          <div className="card-header"><h2>Pending Reviews</h2></div>
          <div className="card-content">
            {pendingDocs.map(doc => (
              <div key={doc.id} className="list-item">
                <div className="item-left">
                  <span className="doc-icon">📄</span>
                  <div className="item-info"><h4>{doc.name}</h4><p>{doc.patient}</p></div>
                </div>
                <button className="btn-small btn-success" onClick={() => setPendingDocs(pendingDocs.filter(d => d.id !== doc.id))}>Approve</button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );

  const renderPatients = () => (
    <div className="content-card full-width">
      <div className="card-header">
        <h2>Patient Management</h2>
        <button className="btn-primary btn-small" onClick={() => handleAction("Add Patient", "New Entry")}>+ New Patient</button>
      </div>
      <div className="table-container">
        <table className="portal-table">
          <thead>
            <tr><th>Name</th><th>Age/Gender</th><th>Primary Condition</th><th>Last Visit</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {patients.map(p => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td>{p.age} / {p.gender}</td>
                <td><span className="badge-info">{p.condition}</span></td>
                <td>{p.lastVisit}</td>
                <td>
                  <button className="btn-text-action" onClick={() => handleAction("Viewing Records", p.name)}>View</button>
                  <button className="btn-text-action" onClick={() => handleAction("Editing Records", p.name)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSchedule = () => (
    <div className="content-card full-width">
      <div className="card-header">
        <h2>Daily Agenda</h2>
        <span className="date-label">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
      </div>
      <div className="schedule-list-detailed">
        {schedule.map(item => (
          <div key={item.id} className="agenda-item">
            <div className="agenda-time">{item.time}</div>
            <div className="agenda-dot"></div>
            <div className="agenda-content">
              <div className="agenda-info">
                <h4>{item.patient}</h4>
                <p>{item.type} • <span className={`status-text ${item.status.toLowerCase()}`}>{item.status}</span></p>
              </div>
              <div className="agenda-actions">
                <button className="btn-outline btn-small" onClick={() => handleAction("Reschedule", item.patient)}>Reschedule</button>
                <button className="btn-primary btn-small" onClick={() => handleAction("Joining Call", item.patient)}>Join Call</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPrescriptions = () => (
    <div className="prescriptions-view">
      <div className="section-header">
        <h2>Recent Prescriptions</h2>
        <button className="btn-primary btn-small" onClick={() => handleAction("New Prescription", "System")}>+ Create New</button>
      </div>
      <div className="presc-grid">
        {prescriptions.map(p => (
          <div key={p.id} className="presc-card">
            <div className="presc-header">
              <span className="presc-id">#RX-{1000 + p.id}</span>
              <span className={`presc-status ${p.status.replace(' ', '-').toLowerCase()}`}>{p.status}</span>
            </div>
            <h3>{p.med}</h3>
            <p className="presc-dosage">{p.dosage}</p>
            <div className="presc-footer">
              <span>Patient: {p.patient}</span>
              <button className="btn-text" onClick={() => handleAction("Prescription Details", p.med)}>View Script</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderHospitals = () => (
    <div className="hospitals-view">
      <div className="section-header"><h2>Associated Healthcare Centers</h2></div>
      <div className="hospital-grid">
        {[
          { name: "City General Hospital", dept: "Cardiology", location: "Downtown, Metro", rating: "4.8" },
          { name: "TabCura Digital Clinic", dept: "Telemedicine", location: "Remote/Cloud", rating: "5.0" },
          { name: "St. Mary's Medical", dept: "Emergency Care", location: "East Side", rating: "4.5" }
        ].map((h, i) => (
          <div key={i} className="hospital-card">
            <div className="hospital-img-placeholder">🏥</div>
            <h3>{h.name}</h3>
            <p className="h-dept">{h.dept}</p>
            <p className="h-loc">📍 {h.location}</p>
            <div className="h-footer">
              <span className="rating">⭐ {h.rating}</span>
              <button className="btn-outline btn-small" onClick={() => handleAction("Viewing Hospital", h.name)}>View Facility</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="settings-view">
      <div className="settings-card">
        <div className="settings-header">
          <h2>Professional Profile</h2>
          <p>Manage your public identity and account security</p>
        </div>
        <div className="profile-edit-section">
          <div className="avatar-upload">
            <div className="current-avatar">{doctorProfile.avatar}</div>
            <button className="btn-text">Change Photo</button>
          </div>
          <div className="settings-form">
            <div className="form-row">
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" name="name" value={doctorProfile.name} onChange={updateProfile} />
              </div>
              <div className="form-group">
                <label>Professional Title</label>
                <input type="text" name="specs" value={doctorProfile.specs} onChange={updateProfile} />
              </div>
            </div>
            <div className="form-group">
              <label>Professional Email</label>
              <input type="email" name="email" value={doctorProfile.email} onChange={updateProfile} />
            </div>
            <div className="form-group">
              <label>Primary Hospital</label>
              <input type="text" name="hospital" value={doctorProfile.hospital} onChange={updateProfile} />
            </div>
            <div className="form-group">
              <label>Professional Bio</label>
              <textarea name="bio" value={doctorProfile.bio} onChange={updateProfile} rows="4"></textarea>
            </div>
            <div className="settings-actions">
              <button className="btn-primary" onClick={() => alert("Profile updated successfully (Simulation)")}>Save Changes</button>
              <button className="btn-outline">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="doctor-portal-container">
      <aside className="doctor-sidebar">
        <div className="sidebar-logo">
          <img src={process.env.PUBLIC_URL + "/tabcura.png"} alt="TabCura" />
        </div>
        <nav className="sidebar-nav">
          {[
            { id: 'dashboard', label: 'My Dashboard', icon: '🏠' },
            { id: 'patients', label: 'Patients', icon: '👥' },
            { id: 'schedule', label: 'Schedule', icon: '📅' },
            { id: 'prescriptions', label: 'Prescriptions', icon: '💊' },
            { id: 'hospitals', label: 'Hospitals', icon: '🏥' },
            { id: 'settings', label: 'Settings', icon: '⚙️' }
          ].map(item => (
            <button key={item.id} className={`nav-item ${activeMenu === item.id ? 'active' : ''}`} onClick={() => setActiveMenu(item.id)}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><button className="logout-btn" onClick={onLogout}><span className="nav-icon">🚪</span><span>Logout</span></button></div>
      </aside>

      <main className="doctor-main">
        <header className="doctor-header">
          <h1>{activeMenu.charAt(0).toUpperCase() + activeMenu.slice(1)}</h1>
          <div className="header-right">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Quick search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="status-badge"><span className="status-dot"></span><span>Active</span></div>
            <div className="user-profile-menu">
              <div className="profile-avatar">{doctorProfile.avatar}</div>
              <div className="profile-info">
                <span className="profile-name">{doctorProfile.name}</span>
                <span className="profile-specs">{doctorProfile.specs}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="portal-dynamic-content">
          {activeMenu === 'dashboard' && renderDashboard()}
          {activeMenu === 'patients' && renderPatients()}
          {activeMenu === 'schedule' && renderSchedule()}
          {activeMenu === 'prescriptions' && renderPrescriptions()}
          {activeMenu === 'hospitals' && renderHospitals()}
          {activeMenu === 'settings' && renderSettings()}
        </div>
      </main>

      {modal.show && (
        <div className="portal-modal-overlay">
          <div className="portal-modal">
            <div className="modal-header">
              <h3>{modal.title}</h3>
              <button className="close-modal" onClick={() => setModal({ ...modal, show: false })}>×</button>
            </div>
            <div className="modal-body"><p>{modal.content}</p></div>
            <div className="modal-footer"><button className="btn-primary" onClick={() => setModal({ ...modal, show: false })}>Acknowledge</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorPortal;