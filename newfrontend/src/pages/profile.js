import React, { useState, useRef, useEffect } from 'react';
import { io as ioClient } from 'socket.io-client';
import './profile.css';

const Profile = ({ user = {}, onLogout, onNavigateToSubscription }) => {
  // Add a useEffect to log received props for debugging
  useEffect(() => {
    console.log("Profile component mounted with user data:", user);
  }, [user]);

  // Ensure user object has all required properties with defaults
  const safeUser = {
    id: user?.id || "",
    name: user?.name || "John Doe",
    email: user?.email || "johndoe@example.com",
    username: user?.username || "johndoe"
  };

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [savedRecords, setSavedRecords] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [analyticsDays, setAnalyticsDays] = useState([]);
  const [analysesByDay, setAnalysesByDay] = useState([]);
  const [recordsByDay, setRecordsByDay] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [isAppointmentsLoading, setIsAppointmentsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [settingsForm, setSettingsForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
    gender: user?.gender || ''
  });
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecordsLoading, setIsRecordsLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [showAIModal, setShowAIModal] = useState(false);
  const [uploadedPrescription, setUploadedPrescription] = useState(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [restoredDocumentUrl, setRestoredDocumentUrl] = useState('');
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [googleCalendarEmail, setGoogleCalendarEmail] = useState('');
  const [calendarSyncMessage, setCalendarSyncMessage] = useState('');
  const [showSymptomModal, setShowSymptomModal] = useState(false);
  const [symptomStep, setSymptomStep] = useState('input');
  const [symptomInput, setSymptomInput] = useState('');
  const [symptomQuestions, setSymptomQuestions] = useState([]);
  const [symptomAnswers, setSymptomAnswers] = useState([]);
  const [symptomAnalysisResult, setSymptomAnalysisResult] = useState(null);
  const [symptomError, setSymptomError] = useState('');
  const [isAnalyzingSymptoms, setIsAnalyzingSymptoms] = useState(false);
  // Progressive question loading
  const [questionSource, setQuestionSource] = useState(''); // 'instant' | 'cached' | 'ai'
  const [isLoadingAiQuestions, setIsLoadingAiQuestions] = useState(false);
  const [showSaveRecordModal, setShowSaveRecordModal] = useState(false);
  const [saveRecordSource, setSaveRecordSource] = useState('prescription');
  const [recordForm, setRecordForm] = useState({
    doctorName: '',
    hospitalName: '',
    diseaseName: ''
  });
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [saveRecordError, setSaveRecordError] = useState('');
  const prescriptionInputRef = useRef(null);

  const [showHealthReportModal, setShowHealthReportModal] = useState(false);
  const [uploadedReport, setUploadedReport] = useState(null);
  const [reportAnalysisResult, setReportAnalysisResult] = useState(null);
  const [isAnalyzingReport, setIsAnalyzingReport] = useState(false);
  const [reportAnalysisError, setReportAnalysisError] = useState('');
  const reportInputRef = useRef(null);

  const directRecordInputRef = useRef(null);
  const [isFakeOcrLoading, setIsFakeOcrLoading] = useState(false);
  const [directRecordFile, setDirectRecordFile] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [entityModal, setEntityModal] = useState({ isOpen: false, type: '', data: [] });
  const [expandedEntity, setExpandedEntity] = useState(null);
  const [viewRecord, setViewRecord] = useState(null);

  // Complete-appointment modal state
  const [showCompleteApptModal, setShowCompleteApptModal] = useState(false);
  const [completeApptTarget, setCompleteApptTarget] = useState(null); // the appointment being completed
  const [completeApptFile, setCompleteApptFile] = useState(null);
  const [completeApptAnalysis, setCompleteApptAnalysis] = useState(null);
  const [isAnalyzingCompleteDoc, setIsAnalyzingCompleteDoc] = useState(false);
  const [completeApptError, setCompleteApptError] = useState('');
  const completeApptFileRef = useRef(null);

  // Add a constant for the API base URL, defaulting to port 3001
  // but allowing it to be overridden by an environment variable if needed
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Fetch user documents when component mounts
  useEffect(() => {
    if (safeUser.id) {
      fetchUserDocuments();
      fetchUserRecords();
      fetchActivityAnalytics();
      fetchGoogleCalendarStatus();
      fetchUserAppointments();
    }
  }, [safeUser.id]);

  // Setup realtime Socket.IO connection to receive live analytics updates
  useEffect(() => {
    if (!safeUser.id) return;

    const socketUrl = API_BASE_URL.replace(/\/$/, '');
    const token = localStorage.getItem('token');
    // If a token is present, send it in the auth payload so server can verify and auto-join room
    const socket = token
      ? ioClient(socketUrl, { auth: { token }, transports: ['websocket'], reconnectionAttempts: 5 })
      : ioClient(socketUrl, { transports: ['websocket'], reconnectionAttempts: 5 });

    socket.on('connect', () => {
      console.log('Realtime socket connected:', socket.id);
      // If no token was provided we fall back to explicit join (backwards compatibility)
      if (!token) {
        try {
          socket.emit('join', { userId: safeUser.id });
        } catch (e) {
          console.warn('Failed to join realtime room:', e && e.message);
        }
      }
    });

    socket.on('analysis_event', (payload) => {
      try {
        if (!payload) return;
        if (String(payload.userId) === String(safeUser.id)) {
          // Refresh analytics for this user
          fetchActivityAnalytics();
        }
      } catch (err) {
        console.error('Error handling analysis_event:', err);
      }
    });

    socket.on('record_saved', (payload) => {
      try {
        if (!payload) return;
        if (String(payload.userId) === String(safeUser.id)) {
          // Refresh saved records and analytics
          fetchUserRecords();
          fetchActivityAnalytics();
        }
      } catch (err) {
        console.error('Error handling record_saved:', err);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('Realtime socket disconnected:', reason);
    });

    return () => {
      try {
        if (!token) socket.emit('leave', { userId: safeUser.id });
      } catch (e) {
        /* ignore */
      }
      try { socket.close(); } catch (e) { /* ignore */ }
    };
  }, [safeUser.id]);

  // Effect to restore AI analysis state after Google Calendar authentication redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('googleCalendar') === 'connected') {
      console.log('Detected return from Google Calendar auth. Attempting to restore analysis state...');
      const savedAnalysis = localStorage.getItem('pending_ai_analysis');
      if (savedAnalysis) {
        try {
          const parsedAnalysis = JSON.parse(savedAnalysis);
          setAiAnalysisResult(parsedAnalysis);
          setShowAIModal(true);
          setUploadedPrescription([]); // Clear files as we only have the result now
          
          // Clear the saved analysis from localStorage
          localStorage.removeItem('pending_ai_analysis');
          
          // Clean up the URL query parameters without refreshing the page
          const newUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, newUrl);
          
          const savedDocUrl = localStorage.getItem('pending_document_url');
          if (savedDocUrl) {
            setRestoredDocumentUrl(savedDocUrl);
            localStorage.removeItem('pending_document_url');
          }
          
          setCalendarSyncMessage('Google Calendar connected! You can now sync your prescription.');
        } catch (e) {
          console.error('Error restoring pending analysis:', e);
        }
      }
    }
  }, []);

  const fetchActivityAnalytics = async (days = 7) => {
    try {
      if (!safeUser.id) return;
      const res = await fetch(`${API_BASE_URL}/api/analytics/activity/${safeUser.id}?days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const data = await res.json();
      if (data.success) {
        setAnalyticsDays(data.days || []);
        setAnalysesByDay(data.analyses || []);
        setRecordsByDay(data.records || []);
      }
    } catch (error) {
      console.error('Analytics fetch error:', error);
      setAnalyticsDays([]);
      setAnalysesByDay([]);
      setRecordsByDay([]);
    }
  };

  const fetchUserDocuments = async () => {
    try {
      if (!safeUser.id) {
        console.warn('Cannot fetch documents without user ID');
        return;
      }
      
      setIsLoading(true);
      console.log('Fetching documents for user ID:', safeUser.id);
      
      const response = await fetch(`${API_BASE_URL}/api/documents/${safeUser.id}`);
      
      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch documents');
        } else {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      console.log('Fetched documents:', data);
      
      if (data.success && data.documents) {
        setDocuments(data.documents);
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      setUploadError(error.message);
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserRecords = async () => {
    try {
      if (!safeUser.id) {
        console.warn('Cannot fetch records without user ID');
        return;
      }

      setIsRecordsLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/records/${safeUser.id}`);

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.indexOf('application/json') !== -1) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch records');
        }

        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.records) {
        setSavedRecords(data.records);
      } else {
        setSavedRecords([]);
      }
    } catch (error) {
      console.error('Error fetching medical records:', error);
      setSavedRecords([]);
    } finally {
      setIsRecordsLoading(false);
    }
  };

  const fetchUserAppointments = async () => {
    try {
      if (!safeUser.id) return;
      setIsAppointmentsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/appointments/${safeUser.id}`);
      const data = await response.json();
      if (data.success) {
        setAppointments(data.appointments);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setIsAppointmentsLoading(false);
    }
  };

  const handleUpdateAppointmentStatus = async (appointmentId, status) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/appointments/${appointmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (data.success) {
        fetchUserAppointments();
      }
    } catch (error) {
      console.error('Error updating appointment:', error);
    }
  };

  // Open the complete-appointment modal
  const openCompleteApptModal = (appt) => {
    setCompleteApptTarget(appt);
    setCompleteApptFile(null);
    setCompleteApptAnalysis(null);
    setCompleteApptError('');
    setShowCompleteApptModal(true);
  };

  // Analyse the uploaded follow-up document
  const handleAnalyzeCompleteDoc = async () => {
    if (!completeApptFile) return;
    setIsAnalyzingCompleteDoc(true);
    setCompleteApptError('');
    try {
      const formData = new FormData();
      formData.append('prescription', completeApptFile);
      formData.append('userId', safeUser.id);
      const res = await fetch(`${API_BASE_URL}/api/analyze/prescription`, {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) {
        let errorMsg = 'Failed to analyse document.';
        try {
          const errData = await res.json();
          errorMsg = errData.message || errData.error || errorMsg;
          if (errorMsg.includes('extract text')) {
             errorMsg = 'Could not read any text from the document. Please ensure it is clear and legible.';
          }
        } catch(e) {
          errorMsg = await res.text();
        }
        throw new Error(errorMsg);
      }
      
      const data = await res.json();
      if (data.success && data.analysis) {
        // Strict date validation: Prevent uploading old prescriptions
        let extractedDate = new Date();
        const dateStr = data.analysis.date;
        let dateFound = false;
        if (dateStr && dateStr.toLowerCase() !== 'not specified' && dateStr.toLowerCase() !== 'unknown') {
          const ddmmyyyy = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (ddmmyyyy) {
            extractedDate = new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
            dateFound = true;
          } else {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              extractedDate = d;
              dateFound = true;
            }
          }
        }
        
        if (dateFound) {
          const apptDateStart = new Date(completeApptTarget.appointmentDate);
          apptDateStart.setHours(0, 0, 0, 0);
          const extractedDateStart = new Date(extractedDate);
          extractedDateStart.setHours(0, 0, 0, 0);

          if (extractedDateStart < apptDateStart) {
            const formattedExtracted = extractedDateStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            const formattedAppt = apptDateStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            throw new Error(`This document is dated ${formattedExtracted}, which is before your appointment date (${formattedAppt}). Please upload a valid follow-up document.`);
          }
        }

        setCompleteApptAnalysis(data.analysis);
        fetchActivityAnalytics();
      } else {
        throw new Error('Invalid analysis result');
      }
    } catch (err) {
      setCompleteApptError('Analysis failed: ' + err.message);
    } finally {
      setIsAnalyzingCompleteDoc(false);
    }
  };

  // Confirm completion — save the doc (if any), save full medical record (if analysed), then mark appointment Completed
  const handleConfirmCompleteAppt = async () => {
    if (!completeApptTarget) return;
    try {
      let savedDocumentUrl = '';

      // 1. Upload the document to the user's docs if one was provided
      if (completeApptFile) {
        const formData = new FormData();
        formData.append('document', completeApptFile);
        formData.append('userId', safeUser.id);
        formData.append('documentType', 'Prescription'); // Usually follow-ups give prescriptions
        if (completeApptAnalysis?.summary) {
          formData.append('summary', completeApptAnalysis.summary);
        }
        const uploadResponse = await fetch(`${API_BASE_URL}/api/documents/upload`, { method: 'POST', body: formData });
        if (uploadResponse.ok) {
           const uploadData = await uploadResponse.json();
           if (uploadData.document && uploadData.document.url) {
             savedDocumentUrl = uploadData.document.url;
           }
           await fetchUserDocuments();
        }
      }

      // 2. Save the full medical record if AI analysis was successful
      if (completeApptAnalysis) {
        const doctorName = completeApptAnalysis.doctor || completeApptTarget.doctorName || 'Unknown Doctor';
        const hospitalName = completeApptAnalysis.hospitalName || completeApptTarget.hospitalName || 'Unknown Hospital';
        const diseaseName = completeApptAnalysis.diseaseName || completeApptTarget.diseaseName || 'Follow-up';

        await fetch(`${API_BASE_URL}/api/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: safeUser.id,
            sourceType: 'prescription',
            doctorName,
            hospitalName,
            diseaseName,
            summary: completeApptAnalysis.summary || '',
            medications: Array.isArray(completeApptAnalysis.medications) ? completeApptAnalysis.medications : [],
            analysisData: completeApptAnalysis || {},
            documentUrl: savedDocumentUrl,
            prescriptionDate: completeApptAnalysis.date
              ? (() => { 
                  try { 
                    const ddmmyyyy = String(completeApptAnalysis.date).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                    if (ddmmyyyy) return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1])).toISOString();
                    return new Date(completeApptAnalysis.date).toISOString(); 
                  } catch { return new Date().toISOString(); } 
                })()
              : new Date().toISOString()
          })
        });
        
        await fetchUserRecords();
        await fetchActivityAnalytics();

        // Auto-create follow-up appointment if medications have duration
        const medicationsList = Array.isArray(completeApptAnalysis.medications) ? completeApptAnalysis.medications : [];
        let maxMedicationEnd = null;
        
        const parsePrescriptionDate = (dateStr) => {
          if (!dateStr) return new Date();
          const ddmmyyyy = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (ddmmyyyy) return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? new Date() : d;
        };

        medicationsList.forEach(med => {
          const dDays = typeof med.duration_days === 'number' ? med.duration_days : parseInt(String(med.duration_days || '').match(/\d+/)?.[0] || '0');
          if (dDays > 0) {
            const startDate = parsePrescriptionDate(completeApptAnalysis.date);
            const endDate = new Date(startDate.getTime() + (dDays - 1) * 86400000);
            if (!maxMedicationEnd || endDate > maxMedicationEnd) {
              maxMedicationEnd = endDate;
            }
          }
        });
        
        if (maxMedicationEnd) {
          const appointmentDate = new Date(maxMedicationEnd.getTime() + 86400000);
          try {
            const apptResponse = await fetch(`${API_BASE_URL}/api/appointments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: safeUser.id,
                doctorName,
                hospitalName,
                diseaseName,
                appointmentDate: appointmentDate.toISOString(),
                status: 'Scheduled'
              })
            });
            const apptData = await apptResponse.json();
            if (apptData.success) {
              await fetchUserAppointments();
            }
          } catch (apptErr) {
            console.error('[Appointment Debug] Failed to auto-create appointment:', apptErr);
          }
        }
      }

      // 3. Mark appointment as Completed
      await handleUpdateAppointmentStatus(completeApptTarget._id, 'Completed');
      setShowCompleteApptModal(false);
      setCompleteApptTarget(null);
      
      // If we analyzed a new prescription, switch to medications tab so user sees it
      if (completeApptAnalysis) {
        handlePageChange('prescriptions');
      }

    } catch (err) {
      setCompleteApptError('Failed to complete appointment: ' + err.message);
    }
  };

  const fetchGoogleCalendarStatus = async () => {
    try {
      if (!safeUser.id) return;

      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/google/calendar/status`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (data.success) {
        setGoogleCalendarConnected(Boolean(data.connected));
        setGoogleCalendarEmail(data.email || '');
      }
    } catch (error) {
      console.error('Google Calendar status error:', error);
    }
  };

  const handleRecordFormChange = (event) => {
    const { name, value } = event.target;

    setRecordForm(previous => ({
      ...previous,
      [name]: value
    }));
  };

  const openSaveRecordModal = (source = 'prescription') => {
    const analysisData = source === 'report' ? reportAnalysisResult : aiAnalysisResult;

    setSaveRecordSource(source);
    setRecordForm({
      doctorName: analysisData?.doctor || '',
      hospitalName: analysisData?.hospitalName || '',
      diseaseName: source === 'report'
        ? (analysisData?.reportType || '')
        : (analysisData?.diseaseName || '')
    });
    setSaveRecordError('');
    setShowSaveRecordModal(true);
  };

  const closeSaveRecordModal = () => {
    if (isSavingRecord) {
      return;
    }

    setShowSaveRecordModal(false);
    setSaveRecordError('');
  };

  const handleSaveRecord = async (event) => {
    event.preventDefault();

    if (!safeUser.id) {
      setSaveRecordError('User profile is missing. Please log in again.');
      return;
    }

    const doctorName = recordForm.doctorName.trim();
    const hospitalName = recordForm.hospitalName.trim();
    const diseaseName = recordForm.diseaseName.trim();

    if (!doctorName || !hospitalName || !diseaseName) {
      setSaveRecordError('Please fill in doctor name, hospital name, and disease name.');
      return;
    }

    const parseFlexDate = (dateStr) => {
      if (!dateStr) return null;
      const ddmmyyyy = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (ddmmyyyy) return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    };

    const analysisData = saveRecordSource === 'report' ? reportAnalysisResult : (saveRecordSource === 'prescription' ? aiAnalysisResult : null);

    // Future date validation (handles DD/MM/YYYY format from AI output)
    if (analysisData && analysisData.date) {
      const docDate = parseFlexDate(analysisData.date);
      const now = new Date();
      if (docDate && docDate > now) {
        setSaveRecordError('The document date cannot be in the future. Please verify the date on your prescription/report.');
        return;
      }
    }

    try {
      console.log(`[SaveRecord] Saving record with source: ${saveRecordSource}`, {
        hasAnalysis: !!analysisData,
        medicationCount: analysisData?.medications?.length || 0
      });
      setIsSavingRecord(true);
      setSaveRecordError('');

      let savedDocumentUrl = '';

      // If it's a direct record, also upload the file to documents
      if (saveRecordSource === 'direct_record' && directRecordFile) {
        const formData = new FormData();
        formData.append('document', directRecordFile);
        formData.append('userId', safeUser.id);
        formData.append('documentType', 'Medical Document');

        const uploadResponse = await fetch(`${API_BASE_URL}/api/documents/upload`, {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.ok) {
           const uploadData = await uploadResponse.json();
           if (uploadData.document && uploadData.document.url) {
             savedDocumentUrl = uploadData.document.url;
           }
           await fetchUserDocuments();
        }
      } else if (saveRecordSource === 'prescription') {
        if (restoredDocumentUrl) {
          // Use the URL we pre-saved before the Google redirect
          savedDocumentUrl = restoredDocumentUrl;
          console.log('[SaveRecord] Using restored document URL:', savedDocumentUrl);
        } else if (uploadedPrescription && uploadedPrescription.length > 0) {
          // Normal flow: upload the local file
          const formData = new FormData();
          formData.append('document', uploadedPrescription[0]);
          formData.append('userId', safeUser.id);
          formData.append('documentType', 'Prescription');

          const uploadResponse = await fetch(`${API_BASE_URL}/api/documents/upload`, {
            method: 'POST',
            body: formData,
          });

          if (uploadResponse.ok) {
             const uploadData = await uploadResponse.json();
             if (uploadData.document && uploadData.document.url) {
               savedDocumentUrl = uploadData.document.url;
             }
             await fetchUserDocuments();
          }
        }
      } else if (saveRecordSource === 'report' && uploadedReport) {
        const fileToUpload = Array.isArray(uploadedReport) ? uploadedReport[0] : uploadedReport;
        if (fileToUpload) {
          const extension = fileToUpload.name.split('.').pop() || 'pdf';
          const hospitalOrDoctor = hospitalName || doctorName || 'Unknown Facility';
          const dateStr = analysisData?.date || new Date().toLocaleDateString();
          const safeDateStr = dateStr.replace(/\//g, '-');
          const customName = `Lab Record - ${hospitalOrDoctor} - ${safeDateStr}.${extension}`;
          
          const renamedFile = new File([fileToUpload], customName, { type: fileToUpload.type });

          const formData = new FormData();
          formData.append('document', renamedFile);
          formData.append('userId', safeUser.id);
          formData.append('documentType', 'Medical Report');
          formData.append('summary', analysisData?.summary || '');

          const uploadResponse = await fetch(`${API_BASE_URL}/api/documents/upload`, {
            method: 'POST',
            body: formData,
          });

          if (uploadResponse.ok) {
             await fetchUserDocuments();
          }
        }

        setShowSaveRecordModal(false);
        setShowHealthReportModal(false);
        setUploadedReport(null);
        setReportAnalysisResult(null);
        setIsSavingRecord(false);
        handlePageChange('documents');
        return; // Skip saving to /api/records for reports
      }

      const response = await fetch(`${API_BASE_URL}/api/records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: safeUser.id,
          sourceType: saveRecordSource,
          doctorName,
          hospitalName,
          diseaseName,
          summary: analysisData?.summary || analysisData?.reportType || '',
          medications: Array.isArray(analysisData?.medications) ? analysisData.medications : [],
          analysisData: analysisData || {},
          documentUrl: savedDocumentUrl,
          prescriptionDate: analysisData?.date
            ? (() => { 
                const d = parseFlexDate(analysisData.date);
                return d ? d.toISOString() : new Date().toISOString();
              })()
            : new Date().toISOString()
        })
      });

      const responseData = await response.json();

      if (!response.ok || !responseData.success) {
        throw new Error(responseData.message || 'Failed to save record');
      }

      await fetchUserRecords();
      await fetchActivityAnalytics();
      setRestoredDocumentUrl(''); // Clear the restored URL after successful save

      // Auto-create follow-up appointment if medications have duration
      const medications = Array.isArray(analysisData?.medications) ? analysisData.medications : [];
      console.log('[Appointment Debug] analysisData:', JSON.stringify(analysisData, null, 2));
      console.log('[Appointment Debug] medications:', JSON.stringify(medications, null, 2));
      console.log('[Appointment Debug] safeUser.id:', safeUser.id);
      let maxMedicationEnd = null;
      
      // Helper to parse DD/MM/YYYY or standard ISO dates safely
      const parsePrescriptionDate = (dateStr) => {
        if (!dateStr) return new Date();
        // Handle DD/MM/YYYY format (e.g. "14/05/2026")
        const ddmmyyyy = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (ddmmyyyy) {
          return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
        }
        // Fallback to standard parsing
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? new Date() : d;
      };

      medications.forEach(med => {
        // Robust number extraction in case it's a string like "7 days"
        const dDays = typeof med.duration_days === 'number' ? med.duration_days : parseInt(String(med.duration_days || '').match(/\d+/)?.[0] || '0');
        console.log(`[Appointment Debug] Med: ${med.name}, duration_days raw: ${med.duration_days}, parsed: ${dDays}`);
        if (dDays > 0) {
          const startDate = parsePrescriptionDate(analysisData.date);
          const endDate = new Date(startDate.getTime() + (dDays - 1) * 86400000);
          console.log(`[Appointment Debug] startDate: ${startDate}, endDate: ${endDate}`);
          if (!maxMedicationEnd || endDate > maxMedicationEnd) {
            maxMedicationEnd = endDate;
          }
        }
      });

      console.log('[Appointment Debug] maxMedicationEnd:', maxMedicationEnd);
      
      if (maxMedicationEnd) {
        const appointmentDate = new Date(maxMedicationEnd.getTime() + 86400000);
        console.log('[Appointment Debug] Creating appointment for:', appointmentDate.toISOString());
        try {
          const apptResponse = await fetch(`${API_BASE_URL}/api/appointments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: safeUser.id,
              doctorName: recordForm.doctorName,
              hospitalName: recordForm.hospitalName,
              diseaseName: recordForm.diseaseName,
              appointmentDate: appointmentDate.toISOString(),
              status: 'Scheduled'
            })
          });
          const apptData = await apptResponse.json();
          console.log('[Appointment Debug] API response:', apptData);
          if (apptData.success) {
            await fetchUserAppointments();
          }
        } catch (apptErr) {
          console.error('[Appointment Debug] Failed to auto-create appointment:', apptErr);
        }
      } else {
        console.log('[Appointment Debug] No medications with valid duration found - skipping appointment creation');
      }

      setShowSaveRecordModal(false);
      setShowAIModal(false);
      setAiAnalysisResult(null);
      setReportAnalysisResult(null);
      
      // Navigate to Prescriptions tab so user immediately sees their saved record
      if (saveRecordSource === 'prescription') {
        handlePageChange('prescriptions');
      }
    } catch (error) {
      console.error('Error saving record:', error);
      setSaveRecordError(error.message || 'Failed to save record');
    } finally {
      setIsSavingRecord(false);
    }
  };

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setUploadError('');

      console.log('Uploading file:', file.name, 'size:', file.size, 'type:', file.type);
      console.log('User ID:', safeUser.id);
      
      // Test API connectivity first
      try {
        const debugResponse = await fetch(`${API_BASE_URL}/api/debug`);
        const debugData = await debugResponse.json();
        console.log('API debug response:', debugData);
      } catch (debugError) {
        console.error('API debug failed:', debugError);
      }
      
      // Create FormData object
      const formData = new FormData();
      formData.append('document', file);
      formData.append('userId', safeUser.id);
      formData.append('documentType', 'Medical Document');

      // Log FormData contents
      console.log('FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(`${key}: ${value instanceof File ? `File: ${value.name}` : value}`);
      }

      // Upload file to server - using absolute URL with base URL constant
      const uploadUrl = `${API_BASE_URL}/api/documents/upload`;
      console.log('Sending request to:', uploadUrl);
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        // Do not set Content-Type header when sending FormData
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
          const errorText = await response.text();
          console.error('Error response text:', errorText);
        }
        throw new Error(errorMessage);
      }

      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        throw new Error('Invalid response from server');
      }

      console.log('Upload successful:', data);
      
      // Refresh document list
      await fetchUserDocuments();
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.message || 'Failed to upload document');
    } finally {
      setIsLoading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDirectRecordChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDirectRecordFile(file);
      setIsFakeOcrLoading(true);
      setTimeout(() => {
        setIsFakeOcrLoading(false);
        setSaveRecordSource('direct_record');
        setRecordForm({
          doctorName: '',
          hospitalName: '',
          diseaseName: ''
        });
        setAiAnalysisResult(null);
        setReportAnalysisResult(null);
        setSaveRecordError('');
        setShowSaveRecordModal(true);
        if (directRecordInputRef.current) {
          directRecordInputRef.current.value = '';
        }
      }, 1000);
    }
  };

  const handleSettingsChange = (e) => {
    const { name, value } = e.target;
    setSettingsForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    setSettingsMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: safeUser.id,
          ...settingsForm
        })
      });
      const data = await response.json();
      if (data.success) {
        setSettingsMessage('Profile updated successfully!');
        const updatedUser = { ...user, ...data.user };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setSettingsMessage(data.message || 'Failed to update profile.');
      }
    } catch (err) {
      console.error(err);
      setSettingsMessage('An error occurred while updating profile.');
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handlePageChange = (page) => {
    setActivePage(page);
  };

  const handleViewDocument = (document) => {
    console.log('View document:', document);
    if (document.url) {
      window.open(`${API_BASE_URL}${document.url}`, '_blank');
    }
  };

  const handleDeleteDocument = async (documentId) => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      // Update document list
      setDocuments(documents.filter(doc => doc.id !== documentId));
      
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete document: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrescriptionUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      console.log('Files selected for analysis:', files);
      setUploadedPrescription(files);
      setAiAnalysisResult(null);
    }
  };

  const handleAnalyzePrescription = async () => {
    if (!uploadedPrescription) return;

    setIsAnalyzing(true);
    
    try {
      const formData = new FormData();
      // Add all files to formData with the same field name
      uploadedPrescription.forEach(file => {
        formData.append('prescription', file);
      });
      // Attach user id so server can record analytics
      formData.append('userId', safeUser.id);
      
      console.log('Sending prescriptions for analysis...');
      
      const response = await fetch(`${API_BASE_URL}/api/analyze/prescription`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(await response.text());
      }
      
      const data = await response.json();
      console.log('Analysis result:', data);
      
      if (data.success && data.analysis) {
        setAiAnalysisResult(data.analysis);
        // Refresh analytics after successful analysis
        fetchActivityAnalytics();
      } else {
        throw new Error('Invalid analysis result format');
      }
    } catch (error) {
      console.error('Error during prescription analysis:', error);
      alert(`Analysis failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSyncPrescriptionToGoogleCalendar = async () => {
    if (!aiAnalysisResult || !Array.isArray(aiAnalysisResult.medications) || aiAnalysisResult.medications.length === 0) {
      alert('No medication schedule was found in the AI analysis.');
      return;
    }

    try {
      setIsSyncingCalendar(true);
      setCalendarSyncMessage('');

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/google/calendar/sync-prescription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          userId: safeUser.id,
          analysis: aiAnalysisResult
        })
      });

      const data = await response.json();

      if (data.requiresGoogleAuth && data.authUrl) {
        // Persist the current analysis result so it can be restored after the user logs in
        if (aiAnalysisResult) {
          localStorage.setItem('pending_ai_analysis', JSON.stringify(aiAnalysisResult));
        }
        
        // Also pre-upload and persist the document URL if we have a file
        // This is necessary because File objects cannot be stored in localStorage
        if (uploadedPrescription && uploadedPrescription.length > 0) {
          try {
            const formData = new FormData();
            formData.append('document', uploadedPrescription[0]);
            formData.append('userId', safeUser.id);
            formData.append('documentType', 'Prescription');

            const uploadResponse = await fetch(`${API_BASE_URL}/api/documents/upload`, {
              method: 'POST',
              body: formData,
            });

            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json();
              if (uploadData.document && uploadData.document.url) {
                localStorage.setItem('pending_document_url', uploadData.document.url);
                console.log('Pre-saved document for restoration:', uploadData.document.url);
              }
            }
          } catch (uploadErr) {
            console.error('Failed to pre-save document before redirect:', uploadErr);
          }
        }
        
        window.open(data.authUrl, '_blank', 'noopener,noreferrer');
        setCalendarSyncMessage('Connect Google Calendar in the new tab, then click the sync button again.');
        setGoogleCalendarConnected(false);
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to sync prescription to Google Calendar');
      }

      setCalendarSyncMessage(`Added ${data.createdCount || 0} reminder event(s) to Google Calendar.`);
      setGoogleCalendarConnected(true);
      fetchGoogleCalendarStatus();
    } catch (error) {
      console.error('Google Calendar sync error:', error);
      setCalendarSyncMessage(error.message || 'Failed to sync to Google Calendar');
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const openAIModal = () => {
    setShowAIModal(true);
    setUploadedPrescription(null);
    setAiAnalysisResult(null);
  };

  const closeAIModal = () => {
    setShowAIModal(false);
  };

  const handleNavigateToSubscription = () => {
    // Call the provided navigation function instead of showing an alert
    if (onNavigateToSubscription) {
      onNavigateToSubscription();
    } else {
      alert('Navigating to Premium Subscription page...');
    }
  };

  const openHealthReportModal = () => {
    setShowHealthReportModal(true);
    setUploadedReport(null);
    setReportAnalysisResult(null);
    setReportAnalysisError('');
  };

  const closeHealthReportModal = () => {
    setShowHealthReportModal(false);
  };

  const openSymptomCheckerModal = () => {
    setShowSymptomModal(true);
    setSymptomStep('input');
    setSymptomInput('');
    setSymptomQuestions([]);
    setSymptomAnswers([]);
    setSymptomAnalysisResult(null);
    setSymptomError('');
    setIsAnalyzingSymptoms(false);
    setQuestionSource('');
    setIsLoadingAiQuestions(false);
  };

  const closeSymptomCheckerModal = () => {
    setShowSymptomModal(false);
    setIsLoadingAiQuestions(false);
  };

  const handleSymptomAnswerChange = (index, value) => {
    setSymptomAnswers((currentAnswers) => {
      const nextAnswers = [...currentAnswers];
      nextAnswers[index] = value;
      return nextAnswers;
    });
  };

  const handleStartSymptomCheck = async () => {
    const trimmedSymptoms = symptomInput.trim();
    if (!trimmedSymptoms) {
      setSymptomError('Please describe your symptoms first.');
      return;
    }

    try {
      setIsAnalyzingSymptoms(true);
      setSymptomError('');
      setQuestionSource('');
      setIsLoadingAiQuestions(false);

      const token = localStorage.getItem('token');

      // ── Step 1: Get 3 pre-saved questions instantly (no Gemini, ~0ms) ──────
      const response = await fetch(`${API_BASE_URL}/api/analyze/symptoms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          phase: 'initial',
          symptoms: trimmedSymptoms,
          userId: safeUser.id
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to generate questions.');
      }

      const presavedQuestions = Array.isArray(data.analysis?.questions) ? data.analysis.questions : [];
      if (presavedQuestions.length === 0) {
        throw new Error('No questions available. Please try again.');
      }

      const source = data.analysis?.source || 'instant';
      setQuestionSource(source);
      setSymptomQuestions(presavedQuestions);
      setSymptomAnswers(presavedQuestions.map(() => ''));
      setSymptomStep('questions');
      setIsAnalyzingSymptoms(false);

      // ── Step 2: Simultaneously fetch 2 AI-personalised questions ────────────
      // This call hits cache first (~0ms if cached) or calls Gemini (~5-10s).
      // Either way the user already has 3 questions to fill in.
      setIsLoadingAiQuestions(true);
      fetch(`${API_BASE_URL}/api/analyze/symptoms/ai-boost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ symptoms: trimmedSymptoms })
      })
        .then((r) => r.json())
        .then((aiData) => {
          if (aiData.success && Array.isArray(aiData.questions) && aiData.questions.length > 0) {
            // Merge: 3 pre-saved + 2 AI (deduplicated)
            const newAiQs = aiData.questions.filter((q) => !presavedQuestions.includes(q));
            if (newAiQs.length === 0) return; // nothing new to add
            const merged = [...presavedQuestions, ...newAiQs];
            setSymptomQuestions(merged);
            // ✅ Preserve whatever the user has already typed — only pad empty
            // slots for the newly appended AI questions
            setSymptomAnswers((currentAnswers) => [
              ...currentAnswers,
              ...Array(merged.length - currentAnswers.length).fill('')
            ]);
            setQuestionSource('ai');
          }
        })
        .catch(() => {}) // silently ignore — user already has 3 questions
        .finally(() => setIsLoadingAiQuestions(false));

    } catch (error) {
      console.error('Symptom checker initial analysis error:', error);
      setSymptomError(error.message || 'Failed to generate questions.');
      setIsAnalyzingSymptoms(false);
    }
  };

  const handleFinalizeSymptomCheck = async () => {
    const trimmedSymptoms = symptomInput.trim();
    if (!trimmedSymptoms || symptomQuestions.length === 0) {
      setSymptomError('Please complete the symptom questions first.');
      return;
    }

    // Validate that all follow-up question answers are filled in
    const unanswered = symptomAnswers.findIndex(
      (ans) => !ans || ans.trim() === ''
    );
    if (unanswered !== -1) {
      setSymptomError(
        `Please answer question ${unanswered + 1} before continuing.`
      );
      return;
    }

    try {
      setIsAnalyzingSymptoms(true);
      setSymptomError('');

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/analyze/symptoms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          phase: 'final',
          symptoms: trimmedSymptoms,
          questions: symptomQuestions,
          answers: symptomAnswers,
          userId: safeUser.id
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to analyze symptoms');
      }

      setSymptomAnalysisResult(data.analysis);
      setSymptomStep('analysis');
    } catch (error) {
      console.error('Symptom checker final analysis error:', error);
      setSymptomError(error.message || 'Failed to analyze symptoms');
    } finally {
      setIsAnalyzingSymptoms(false);
    }
  };

  const handleReportUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('Medical report selected for analysis:', file);
      setUploadedReport(file);
      setReportAnalysisResult(null);
      setReportAnalysisError('');
    }
  };

  const handleAnalyzeReport = async () => {
    if (!uploadedReport) return;

    setIsAnalyzingReport(true);

    try {
      setReportAnalysisError('');

      const formData = new FormData();
      formData.append('report', uploadedReport);
      if (safeUser.id) {
        formData.append('userId', safeUser.id);
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/analyze/report`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to analyze report');
      }

      setReportAnalysisResult(data.analysis);
      fetchActivityAnalytics();
    } catch (error) {
      console.error('Report analysis error:', error);
      setReportAnalysisError(error.message || 'Failed to analyze report');
      setReportAnalysisResult(null);
    } finally {
      setIsAnalyzingReport(false);
    }
  };

  const filteredDocuments = activeTab === 'all' 
    ? documents 
    : documents.filter(doc => doc.type.toLowerCase() === activeTab);

  const uniqueHospitals = new Set(savedRecords.filter(r => r.hospitalName).map(r => r.hospitalName)).size;
  const uniqueDoctors = new Set(savedRecords.filter(r => r.doctorName).map(r => r.doctorName)).size;
  const uniqueDiseases = new Set(savedRecords.filter(r => r.diseaseName).map(r => r.diseaseName)).size;

  const filteredRecords = savedRecords.filter(r => {
     if (!searchQuery) return true;
     const q = searchQuery.toLowerCase();
     return (r.doctorName && r.doctorName.toLowerCase().includes(q)) ||
            (r.hospitalName && r.hospitalName.toLowerCase().includes(q)) ||
            (r.diseaseName && r.diseaseName.toLowerCase().includes(q));
  });

  const handleEntityClick = (type) => {
    setExpandedEntity(null);

    if (type === 'documents') {
      handlePageChange('documents');
      return;
    }

    const groups = {};
    savedRecords.forEach(r => {
      let key = '';
      if (type === 'hospitals') key = r.hospitalName;
      if (type === 'doctors') key = r.doctorName;
      if (type === 'diseases') key = r.diseaseName;
      
      if (key) {
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      }
    });
    
    // Sort records inside each group by date
    Object.keys(groups).forEach(key => {
       groups[key].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    });

    const data = Object.keys(groups).map(key => ({
      name: key,
      count: groups[key].length,
      records: groups[key]
    })).sort((a, b) => b.count - a.count);

    setEntityModal({ isOpen: true, type, data });
  };

  const canSaveCurrentAnalysis = Boolean(aiAnalysisResult || reportAnalysisResult);
  const quickSaveSource = reportAnalysisResult ? 'report' : 'prescription';

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo"> <img src={process.env.PUBLIC_URL + "/tabcura.png"} alt="TabCura Logo" /></div>
        </div>
        <div className="sidebar-menu">
          <button 
            className={`menu-item ${activePage === 'dashboard' ? 'active' : ''}`}
            onClick={() => handlePageChange('dashboard')}
          >
            <span className="menu-icon">📊</span>
            <span>Dashboard</span>
          </button>
          <button 
            className={`menu-item ${activePage === 'documents' ? 'active' : ''}`}
            onClick={() => handlePageChange('documents')}
          >
            <span className="menu-icon">📂</span>
            <span>Documents</span>
          </button>
          <button 
            className={`menu-item ${activePage === 'appointments' ? 'active' : ''}`}
            onClick={() => handlePageChange('appointments')}
          >
            <span className="menu-icon">📅</span>
            <span>Appointments</span>
          </button>
          <button 
            className={`menu-item ${activePage === 'prescriptions' ? 'active' : ''}`}
            onClick={() => handlePageChange('prescriptions')}
          >
            <span className="menu-icon">💊</span>
            <span>Medications</span>
          </button>
          <button 
            className={`menu-item`}
            onClick={() => directRecordInputRef.current.click()}
          >
            <span className="menu-icon">💾</span>
            <span>Save Records</span>
          </button>
          <input 
            type="file" 
            ref={directRecordInputRef} 
            style={{ display: 'none' }} 
            onChange={handleDirectRecordChange} 
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          />
          <button 
            className={`menu-item ${activePage === 'settings' ? 'active' : ''}`}
            onClick={() => handlePageChange('settings')}
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
            <h1>Dashboard</h1>
          </div>
          <div className="header-actions">
            <div className="search-bar">
              <input 
                type="text" 
                placeholder="Search records by doctor, hospital, or disease..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="search-button">🔍</button>
            </div>
            {/* Replace notifications with premium subscription button */}
            <div className="premium-subscription">
              <button 
                className="premium-button" 
                onClick={handleNavigateToSubscription}
                title="Upgrade to Premium"
              >
                <span className="premium-icon">👑</span>
                <span className="premium-text">Premium</span>
              </button>
            </div>
            <div className="user-profile" onClick={toggleUserMenu}>
              <div className="user-avatar">{safeUser.name.charAt(0)}</div>
              <div className="user-name">{safeUser.name}</div>
              <span className="dropdown-icon">▼</span>
              {showUserMenu && (
                <div className="user-menu">
                  <div className="user-info">
                    <p className="user-name">{safeUser.name}</p>
                    <p className="user-email">{safeUser.email}</p>
                  </div>
                  <div className="menu-options">
                    <button>My Profile</button>
                    <button>Account Settings</button>
                    <button>Help Center</button>
                    <button onClick={onLogout}>Logout</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        
        {/* Dashboard Content */}
        {activePage === 'dashboard' && (
          <div className="dashboard-content">
          {searchQuery ? (
            <div className="search-results-section" style={{ padding: '20px' }}>
              <h2>Search Results for "{searchQuery}"</h2>
              {filteredRecords.length > 0 ? (
                <div className="records-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
                  {filteredRecords.map((record, index) => (
                    <div key={index} className="recent-insight-card" style={{ cursor: 'pointer', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                      <h3 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>{record.diseaseName}</h3>
                      <p style={{ margin: '0 0 15px 0', color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>{record.summary || 'No summary available.'}</p>
                      <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div><strong style={{ color: '#0f172a' }}>Doctor:</strong> {record.doctorName}</div>
                        <div><strong style={{ color: '#0f172a' }}>Hospital:</strong> {record.hospitalName}</div>
                        <div><strong style={{ color: '#0f172a' }}>Date:</strong> {new Date(record.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ marginTop: '20px', color: '#64748b' }}>No records found matching your search.</p>
              )}
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="summary-cards">
                <div className="card" onClick={() => handleEntityClick('hospitals')} style={{ cursor: 'pointer', transition: 'transform 0.2s', ':hover': { transform: 'translateY(-2px)' } }}>
                  <div className="card-icon hospitals">🏥</div>
                  <div className="card-info">
                    <h3>{uniqueHospitals}</h3>
                    <p>Connected Hospitals</p>
                  </div>
                </div>
                <div className="card" onClick={() => handleEntityClick('doctors')} style={{ cursor: 'pointer', transition: 'transform 0.2s', ':hover': { transform: 'translateY(-2px)' } }}>
                  <div className="card-icon doctors">👨‍⚕️</div>
                  <div className="card-info">
                    <h3>{uniqueDoctors}</h3>
                    <p>Connected Doctors</p>
                  </div>
                </div>
                <div className="card" onClick={() => handleEntityClick('documents')} style={{ cursor: 'pointer', transition: 'transform 0.2s', ':hover': { transform: 'translateY(-2px)' } }}>
                  <div className="card-icon documents">📄</div>
                  <div className="card-info">
                    <h3>{documents.length}</h3>
                    <p>Medical Documents</p>
                  </div>
                </div>
                <div className="card" onClick={() => handleEntityClick('diseases')} style={{ cursor: 'pointer', transition: 'transform 0.2s', ':hover': { transform: 'translateY(-2px)' } }}>
                  <div className="card-icon diseases">🔬</div>
                  <div className="card-info">
                    <h3>{uniqueDiseases}</h3>
                    <p>Diseases</p>
                  </div>
                </div>
              </div>
          
          {/* AI Tools Section */}
          <div className="section ai-tools">
            <div className="section-header">
              <h2>AI Health Assistant</h2>
              <button className="view-all">View All Tools</button>
            </div>
            <div className="ai-tools-grid">
              <div className="ai-tool-card" onClick={openAIModal}>
                <div className="ai-tool-icon prescription-reader">🔍</div>
                <div className="ai-tool-info">
                  <h3>AI Prescription Reader</h3>
                  <p>Upload a prescription to get an instant digital breakdown</p>
                </div>
              </div>
              <div className="ai-tool-card" onClick={openHealthReportModal}>
                <div className="ai-tool-icon health-analyzer">📊</div>
                <div className="ai-tool-info">
                  <h3>Health Report Analyzer</h3>
                  <p>Get insights from your lab results and health reports</p>
                </div>
              </div>
              <div className="ai-tool-card" onClick={openSymptomCheckerModal}>
                <div className="ai-tool-icon symptom-checker">🩺</div>
                <div className="ai-tool-info">
                  <h3>Symptom Checker</h3>
                  <p>Describe your symptoms and get preliminary guidance</p>
                </div>
              </div>
              <div className="ai-tool-card" onClick={() => window.open('https://9000-firebase-voiceflow-studio-h-1756551157585.cluster-mwsteha33jfdowtvzffztbjcj6.cloudworkstations.dev/', '_blank')}>
                <div className="ai-tool-icon voice-flow">🎙️</div>
                <div className="ai-tool-info">
                  <h3>AI Voice Flow Assistant</h3>
                  <p>Talk to our AI assistant and get instant health guidance</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Recent Activities and Recent Documents */}
              {uploadError && <div className="error-message">{uploadError}</div>}

              <div className="recent-insights-grid">
                <div className="recent-insight-card">
                  {(() => {
                    const latestAnalysis = savedRecords.find(r => r.sourceType !== 'direct_record');
                    return (
                      <>
                        <div className="recent-insight-label">Latest Analysis</div>
                        {latestAnalysis ? (
                          <>
                            <h3>{latestAnalysis.diseaseName}</h3>
                            <p>{latestAnalysis.summary || 'Saved analysis summary is available.'}</p>
                            <span>
                              Dr. {latestAnalysis.doctorName} · {latestAnalysis.hospitalName}
                            </span>
                          </>
                        ) : (
                          <>
                            <h3>No saved analysis yet</h3>
                            <p>Save an analyzed prescription or report to show it here.</p>
                            <span>Doctor, hospital, and disease information will appear after saving.</span>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="recent-insight-card">
                  <div className="recent-insight-label">Latest Saved File</div>
                  {documents.length > 0 ? (
                    <>
                      <h3>{documents[0].name}</h3>
                      <p>{documents[0].type}</p>
                      {documents[0].summary && (
                        <div style={{ marginTop: '10px', marginBottom: '10px', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                          <strong style={{ color: '#0f172a' }}>Summary:</strong> {documents[0].summary}
                        </div>
                      )}
                      <span>{documents[0].date}</span>
                    </>
                  ) : savedRecords.length > 0 ? (
                    <>
                      <h3>{savedRecords[0].diseaseName}</h3>
                      <p>{savedRecords[0].summary || 'Saved record'}</p>
                      <span>{new Date(savedRecords[0].createdAt || Date.now()).toISOString().split('T')[0]}</span>
                    </>
                  ) : (
                    <>
                      <h3>No saved files yet</h3>
                      <p>Upload a PDF or image to keep the original file in your documents.</p>
                      <span>The file list updates after each successful upload.</span>
                    </>
                  )}
                </div>
              </div>

              <div className="section activity-graph">
                <div className="section-header">
                  <h2>User Activity</h2>
                  <div className="graph-controls">
                    <select defaultValue="week" className="time-selector">
                      <option value="day">Today</option>
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                    </select>
                  </div>
                </div>
                <div className="analytics-summary">
                  {(() => {
                    const safeAnalyses = (analyticsDays || []).map((_, i) => Number(analysesByDay[i]) || 0);
                    const safeRecords = (analyticsDays || []).map((_, i) => Number(recordsByDay[i]) || 0);
                    const globalMax = Math.max(...safeAnalyses, ...safeRecords, 1);
                    
                    return (
                      <>
                        <div className="analytics-chart">
                          <div className="analytics-title">Analyses</div>
                          <div className="analytics-bars">
                            {analyticsDays && analyticsDays.length > 0 ? (
                              analyticsDays.map((d, i) => {
                                const val = safeAnalyses[i];
                                const height = globalMax > 0 ? (val / globalMax) * 100 : 0;
                                return (
                                  <div key={d} className="analytics-bar-item">
                                    <div className="analytics-bar" style={{ height: `${height}%`, transition: 'height 0.4s ease' }} title={`${val} analyses`} />
                                    <div className="analytics-day-label">{d.split('-').slice(1).join('-')}</div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="analytics-empty">No analysis data</div>
                            )}
                          </div>
                        </div>

                        <div className="analytics-chart">
                          <div className="analytics-title">Records Saved</div>
                          <div className="analytics-bars">
                            {analyticsDays && analyticsDays.length > 0 ? (
                              analyticsDays.map((d, i) => {
                                const val = safeRecords[i];
                                const height = globalMax > 0 ? (val / globalMax) * 100 : 0;
                                return (
                                  <div key={d} className="analytics-bar-item">
                                    <div className="analytics-bar records" style={{ height: `${height}%`, transition: 'height 0.4s ease' }} title={`${val} records`} />
                                    <div className="analytics-day-label">{d.split('-').slice(1).join('-')}</div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="analytics-empty">No record data</div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileUpload} 
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
            </>
          )}
          </div>
        )}

        {/* Documents Page */}
        {activePage === 'documents' && (
          <div className="documents-page" style={{ padding: '30px', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div>
                <h1 style={{ margin: '0 0 10px 0', color: '#1e293b', fontSize: '28px' }}>Medical Documents</h1>
                <p style={{ margin: 0, color: '#64748b' }}>Manage and view all your uploaded prescriptions, lab reports, and records.</p>
              </div>
              <button className="primary-button" onClick={handleUploadClick} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>+</span> Upload Document
              </button>
            </div>
            
            <div className="documents-list">
              {documents.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                  {[...documents].sort((a, b) => new Date(b.date) - new Date(a.date)).map((doc, idx) => (
                    <div key={idx} style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', cursor: 'pointer' }} onClick={() => handleViewDocument(doc)} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-3px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', marginBottom: '15px' }}>
                        <div style={{ fontSize: '32px', background: '#f8fafc', padding: '15px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           {doc.type.toLowerCase().includes('prescription') ? '📝' : '📄'}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                           <h3 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.name}>{doc.name}</h3>
                           <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{doc.type}</span>
                        </div>
                      </div>
                      {doc.summary && (
                        <div style={{ marginBottom: '15px', color: '#475569', fontSize: '13px', lineHeight: '1.5' }}>
                           <strong style={{ color: '#0f172a' }}>Summary:</strong> {doc.summary}
                        </div>
                      )}
                      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '15px' }}>
                        <span style={{ color: '#64748b', fontSize: '13px', fontWeight: '500' }}>{new Date(doc.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }}
                          style={{ background: '#fef2f2', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                          title="Delete Document"
                          onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#fef2f2'}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '80px 20px', background: 'white', borderRadius: '16px', border: '2px dashed #cbd5e1' }}>
                  <div style={{ fontSize: '56px', marginBottom: '20px' }}>📂</div>
                  <h3 style={{ margin: '0 0 10px 0', color: '#1e293b', fontSize: '22px' }}>No documents found</h3>
                  <p style={{ margin: '0 0 25px 0', color: '#64748b', fontSize: '15px' }}>Upload your first medical document, lab report, or prescription to securely store it here.</p>
                  <button className="primary-button" onClick={handleUploadClick}>+ Upload New Document</button>
                </div>
              )}
            </div>
            
            {/* Hidden Input for generic file upload on this page */}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileUpload} 
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
          </div>
        )}

        {/* Appointments Page */}
        {activePage === 'appointments' && (
          <div className="appointments-page" style={{ padding: '30px', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ marginBottom: '30px' }}>
              <h1 style={{ margin: '0 0 6px 0', color: '#1e293b', fontSize: '28px', fontWeight: '700' }}>Medical Appointments</h1>
              <p style={{ margin: 0, color: '#64748b' }}>Scheduled follow-ups and checkups based on your treatment history.</p>
            </div>

            {isAppointmentsLoading ? (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div className="loader active" style={{ margin: '0 auto 20px auto' }} />
                <p style={{ color: '#64748b' }}>Loading appointments...</p>
              </div>
            ) : appointments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', background: 'white', borderRadius: '16px', border: '2px dashed #cbd5e1' }}>
                <div style={{ fontSize: '56px', marginBottom: '20px' }}>📅</div>
                <h3 style={{ margin: '0 0 10px 0', color: '#1e293b', fontSize: '22px' }}>No appointments yet</h3>
                <p style={{ margin: '0 0 25px 0', color: '#64748b', fontSize: '15px' }}>Follow-up appointments are automatically created after your medication courses end.</p>
              </div>
            ) : (
              <div className="appointments-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[...appointments].sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate)).map((appt, index) => {
                  const date = new Date(appt.appointmentDate);
                  const now = new Date();
                  const isDue = appt.status === 'Due';
                  const isCompleted = appt.status === 'Completed';
                  // Set due-date to start-of-day for fair comparison
                  const dueDateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const canMarkComplete = !isCompleted && todayStart >= dueDateStart;

                  // Calculate days passed if due
                  let daysPassed = 0;
                  if (isDue) {
                    const diffTime = Math.abs(now - date);
                    daysPassed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  }

                  // Days remaining if still upcoming
                  let daysRemaining = 0;
                  if (!isDue && !isCompleted) {
                    const diffTime = dueDateStart - todayStart;
                    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  }

                  return (
                    <div key={appt._id || index} style={{ 
                      background: 'white', 
                      borderRadius: '16px', 
                      padding: '24px', 
                      boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                      border: isDue ? '2px solid #ef4444' : isCompleted ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'transform 0.2s'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ 
                          width: '60px', 
                          height: '60px', 
                          borderRadius: '12px', 
                          background: isDue ? '#fef2f2' : isCompleted ? '#f0fdf4' : '#eff6ff',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: isDue ? '#ef4444' : isCompleted ? '#16a34a' : '#3b82f6' }}>
                            {date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                          </span>
                          <span style={{ fontSize: '20px', fontWeight: '800', color: isDue ? '#b91c1c' : isCompleted ? '#15803d' : '#1d4ed8' }}>
                            {date.getDate()}
                          </span>
                        </div>
                        
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Follow-up: {appt.diseaseName}</h3>
                            <span style={{ 
                              padding: '4px 10px', 
                              borderRadius: '20px', 
                              fontSize: '12px', 
                              fontWeight: '600',
                              background: isDue ? '#fee2e2' : isCompleted ? '#dcfce7' : '#dbeafe',
                              color: isDue ? '#b91c1c' : isCompleted ? '#15803d' : '#1e40af'
                            }}>
                              {isDue ? `DUE (${daysPassed}d overdue)` : isCompleted ? 'Completed' : `In ${daysRemaining}d`}
                            </span>
                          </div>
                          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                            👨‍⚕️ Dr. {appt.doctorName} · 🏥 {appt.hospitalName}
                          </p>
                          {!isCompleted && !canMarkComplete && (
                            <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '12px' }}>
                              📅 Available to mark complete from {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                      </div>

                      {canMarkComplete && (
                        <button 
                          onClick={() => openCompleteApptModal(appt)}
                          className="primary-button"
                          style={{ 
                            background: isDue ? '#ef4444' : '#4361ee',
                            padding: '10px 20px',
                            fontSize: '14px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          ✓ Mark Completed
                        </button>
                      )}
                      {isCompleted && (
                        <div style={{ color: '#16a34a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>✅</span> Completed
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Prescriptions Page */}
        {activePage === 'prescriptions' && (
          <div className="prescriptions-page" style={{ padding: '30px', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ marginBottom: '30px' }}>
              <h1 style={{ margin: '0 0 6px 0', color: '#1e293b', fontSize: '28px', fontWeight: '700' }}>My Medications</h1>
              <p style={{ margin: 0, color: '#64748b' }}>All saved medications with dosage schedules and treatment timelines.</p>
            </div>

            {isRecordsLoading ? (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div className="loader active" style={{ margin: '0 auto 20px auto' }} />
                <p style={{ color: '#64748b' }}>Loading medications...</p>
              </div>
            ) : savedRecords.filter(r => {
                const isMedication = r.sourceType === 'prescription' || (Array.isArray(r.medications) && r.medications.length > 0);
                if (!isMedication) return false;
                const issueDate = new Date(r.prescriptionDate || r.createdAt);
                const diffDays = (new Date() - issueDate) / (1000 * 60 * 60 * 24);
                return diffDays <= 33;
              }).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', background: 'white', borderRadius: '16px', border: '2px dashed #cbd5e1' }}>
                <div style={{ fontSize: '56px', marginBottom: '20px' }}>💊</div>
                <h3 style={{ margin: '0 0 10px 0', color: '#1e293b', fontSize: '22px' }}>No medications saved yet</h3>
                <p style={{ margin: '0 0 25px 0', color: '#64748b', fontSize: '15px' }}>Use the AI Prescription Reader to analyze a prescription, then save it to see it here with a medication timeline.</p>
                <button className="primary-button" onClick={openAIModal}>Open AI Prescription Reader</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {savedRecords
                  .filter(r => {
                    const isMedication = r.sourceType === 'prescription' || (Array.isArray(r.medications) && r.medications.length > 0);
                    if (!isMedication) return false;
                    const issueDate = new Date(r.prescriptionDate || r.createdAt);
                    const diffDays = (new Date() - issueDate) / (1000 * 60 * 60 * 24);
                    return diffDays <= 33;
                  })
                  .map((record, index) => {
                    const startDate = new Date(record.prescriptionDate || record.createdAt);
                    const isValidDate = !isNaN(startDate.getTime());
                    const formattedStart = isValidDate
                      ? startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                      : 'Unknown date';

                    return (
                      <div
                        key={record.id || index}
                        style={{
                          background: 'white',
                          borderRadius: '16px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                          border: '1px solid #e2e8f0',
                          overflow: 'hidden',
                          transition: 'transform 0.2s, box-shadow 0.2s'
                        }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.10)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.06)'; }}
                      >
                        {/* ── Card Header ── */}
                        <div style={{
                          background: 'linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)',
                          padding: '20px 24px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <span style={{ fontSize: '18px' }}>📋</span>
                              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>Medication</span>
                            </div>
                            <h2 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '20px', fontWeight: '700' }}>
                              {record.diseaseName || 'Medical Prescription'}
                            </h2>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span>👨‍⚕️</span> Dr. {record.doctorName}
                              </span>
                              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span>🏥</span> {record.hospitalName}
                              </span>
                            </div>
                          </div>
                          <div style={{
                            background: 'rgba(255,255,255,0.15)',
                            backdropFilter: 'blur(8px)',
                            borderRadius: '12px',
                            padding: '10px 16px',
                            textAlign: 'center',
                            minWidth: '120px'
                          }}>
                            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px', marginBottom: '4px' }}>DATE ISSUED</div>
                            <div style={{ color: 'white', fontWeight: '700', fontSize: '15px' }}>{formattedStart}</div>
                          </div>
                        </div>

                        {/* ── Medications Body ── */}
                        <div style={{ padding: '20px 24px' }}>
                          {Array.isArray(record.medications) && record.medications.length > 0 ? (
                            <>
                              <h4 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '15px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                💊 Medications
                                <span style={{ background: '#eef2ff', color: '#4361ee', fontSize: '12px', fontWeight: '700', padding: '2px 10px', borderRadius: '20px' }}>
                                  {record.medications.length}
                                </span>
                              </h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {record.medications.map((med, mIdx) => {
                                  const durationDays = Number.isFinite(Number(med.duration_days)) && Number(med.duration_days) > 0
                                    ? Number(med.duration_days)
                                    : null;

                                  const medStart = isValidDate ? new Date(startDate) : new Date();
                                  const medEnd = durationDays
                                    ? new Date(medStart.getTime() + (durationDays - 1) * 86400000)
                                    : null;

                                  const fmtShort = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                                  const periodLabel = medEnd
                                    ? `${fmtShort(medStart)} → ${fmtShort(medEnd)} (${durationDays} day${durationDays > 1 ? 's' : ''})`
                                    : (med.duration || 'As prescribed');

                                  const now = new Date();
                                  const isFinished = medEnd && now > medEnd;
                                  const isNotStarted = medEnd && now < medStart;
                                  const pct = medEnd
                                    ? Math.min(100, Math.max(0, ((now - medStart) / (medEnd - medStart)) * 100))
                                    : 0;

                                  const pillColors = [
                                    { bg: '#ede9fe', icon: '#7c3aed' },
                                    { bg: '#dcfce7', icon: '#16a34a' },
                                    { bg: '#fef3c7', icon: '#d97706' },
                                    { bg: '#fee2e2', icon: '#dc2626' },
                                    { bg: '#dbeafe', icon: '#2563eb' },
                                    { bg: '#fce7f3', icon: '#db2777' },
                                  ];
                                  const color = pillColors[mIdx % pillColors.length];

                                  return (
                                    <div key={mIdx} style={{
                                      display: 'flex',
                                      gap: '14px',
                                      padding: '16px',
                                      background: '#f8fafc',
                                      borderRadius: '12px',
                                      border: '1px solid #e2e8f0',
                                      alignItems: 'flex-start'
                                    }}>
                                      {/* Coloured pill icon */}
                                      <div style={{
                                        width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                                        background: color.bg,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '22px'
                                      }}>💊</div>

                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        {/* Name + badge row */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                          <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '15px' }}>
                                            {med.name}{med.dosage ? ` — ${med.dosage}` : ''}
                                          </span>
                                          <span style={{
                                            background: isFinished ? '#dcfce7' : (medEnd ? '#dbeafe' : '#f1f5f9'),
                                            color: isFinished ? '#166534' : (medEnd ? '#1d4ed8' : '#475569'),
                                            fontSize: '12px', fontWeight: '600',
                                            padding: '3px 10px', borderRadius: '20px',
                                            whiteSpace: 'nowrap',
                                            display: 'flex', alignItems: 'center', gap: '4px'
                                          }}>
                                            📅 {periodLabel}
                                          </span>
                                        </div>

                                        {/* Meta info */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', fontSize: '13px', color: '#475569', marginBottom: medEnd ? '10px' : '0' }}>
                                          {med.frequency && (
                                            <span><strong style={{ color: '#334155' }}>Frequency:</strong> {med.frequency}</span>
                                          )}
                                          {med.timing_summary && (
                                            <span><strong style={{ color: '#334155' }}>Timing:</strong> {med.timing_summary}</span>
                                          )}
                                          {med.instructions && (
                                            <span><strong style={{ color: '#334155' }}>Instructions:</strong> {med.instructions}</span>
                                          )}
                                        </div>

                                        {/* Progress bar */}
                                        {medEnd && (
                                          <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '5px' }}>
                                              <span>
                                                {isFinished
                                                  ? '✅ Course completed'
                                                  : isNotStarted
                                                    ? '🕐 Not started yet'
                                                    : `🟢 In progress — ${Math.round(100 - pct)}% remaining`}
                                              </span>
                                              <span>{fmtShort(medStart)} – {fmtShort(medEnd)}</span>
                                            </div>
                                            <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                                              <div style={{
                                                height: '100%',
                                                width: `${pct}%`,
                                                background: isFinished
                                                  ? '#22c55e'
                                                  : 'linear-gradient(90deg, #4361ee, #7c3aed)',
                                                borderRadius: '99px',
                                                transition: 'width 0.6s ease'
                                              }} />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          ) : (
                            <p style={{ color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                              No medication details saved for this prescription.
                            </p>
                          )}

                          {/* Card footer */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                            <button
                              className="secondary-button"
                              style={{ fontSize: '13px', padding: '8px 18px' }}
                              onClick={() => setViewRecord(record)}
                            >
                              View Full Record
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Settings Page */}
        {activePage === 'settings' && (
          <div className="settings-page" style={{ padding: '30px', animation: 'fadeIn 0.3s ease', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ margin: '0 0 10px 0', color: '#1e293b', fontSize: '28px' }}>Account Settings</h1>
            <p style={{ margin: '0 0 30px 0', color: '#64748b' }}>Manage your personal information and preferences.</p>
            
            <div style={{ background: 'white', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', border: '1px solid #e2e8f0' }}>
              <form onSubmit={handleSettingsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#475569' }}>First Name</label>
                    <input 
                      type="text" 
                      name="firstName"
                      value={settingsForm.firstName} 
                      onChange={handleSettingsChange}
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} 
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#475569' }}>Last Name</label>
                    <input 
                      type="text" 
                      name="lastName"
                      value={settingsForm.lastName} 
                      onChange={handleSettingsChange}
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} 
                      required
                    />
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#475569' }}>Date of Birth</label>
                    <input 
                      type="date" 
                      name="dateOfBirth"
                      value={settingsForm.dateOfBirth} 
                      onChange={handleSettingsChange}
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} 
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#475569' }}>Gender</label>
                    <select 
                      name="gender"
                      value={settingsForm.gender} 
                      onChange={handleSettingsChange}
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: 'white' }}
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#475569' }}>Email Address (Read-only)</label>
                  <input 
                    type="email" 
                    value={safeUser?.email || ''} 
                    disabled
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#94a3b8', outline: 'none', cursor: 'not-allowed' }} 
                  />
                </div>

                {settingsMessage && (
                  <div style={{ padding: '12px', borderRadius: '8px', background: settingsMessage.includes('successfully') ? '#dcfce7' : '#fee2e2', color: settingsMessage.includes('successfully') ? '#166534' : '#991b1b', textAlign: 'center', fontWeight: '500' }}>
                    {settingsMessage}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button type="submit" className="primary-button" disabled={isUpdatingSettings}>
                    {isUpdatingSettings ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* AI Prescription Reader Modal */}
      {showAIModal && (
        <div className="modal-overlay">
          <div className="modal-container ai-modal">
            <div className="modal-header">
              <h2>TabCura AI Prescription Reader</h2>
              <button className="close-button" onClick={closeAIModal}>×</button>
            </div>
            <div className="modal-content">
              {!uploadedPrescription ? (
                <div className="upload-section">
                  <div className="upload-icon">📄</div>
                  <h3>Upload Your Prescription</h3>
                  <p>Our AI will analyze and extract the important information</p>
                  <button 
                    className="upload-prescription-btn"
                    onClick={() => prescriptionInputRef.current.click()}
                  >
                    Choose File
                  </button>
                  <input 
                    type="file" 
                    ref={prescriptionInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handlePrescriptionUpload} 
                    accept=".jpg,.jpeg,.png,.pdf"
                    multiple
                  />
                </div>
              ) : aiAnalysisResult ? (
                <div className="analysis-result">
                  <div className="result-header">
                    <div className="result-icon">{aiAnalysisResult.type === 'lab_report' ? '🔬' : '💊'}</div>
                    <div>
                      <h3>{aiAnalysisResult.type === 'lab_report' ? 'Lab Report Analysis' : 'Prescription Analysis'} Complete</h3>
                      <p>Analyzed by Dr. {aiAnalysisResult.doctor} • Date: {aiAnalysisResult.date}</p>
                    </div>
                  </div>

                  {aiAnalysisResult.type === 'lab_report' ? (
                    // Lab Report Display
                    <>
                      <div className="lab-summary">
                        <h4>Summary</h4>
                        <p>{aiAnalysisResult.summary}</p>
                      </div>

                      <div className="lab-results">
                        <h4>Test Results ({aiAnalysisResult.lab_results.length})</h4>
                        <div className="lab-results-table">
                          <table>
                            <thead>
                              <tr>
                                <th>Test Name</th>
                                <th>Value</th>
                                <th>Normal Range</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {aiAnalysisResult.lab_results.map((result, index) => (
                                <tr key={index} className={result.status ? `status-${result.status.toLowerCase()}` : ''}>
                                  <td>{result.test}</td>
                                  <td>{result.value}</td>
                                  <td>{result.range}</td>
                                  <td className={`status ${result.status ? `status-${result.status.toLowerCase()}` : ''}`}>
                                    {result.status || 'Normal'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        <div className="abnormal-summary">
                          <p><strong>Abnormal Values:</strong> {aiAnalysisResult.abnormal_flags} parameters outside normal range</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="prescription-analysis-details">
                      {aiAnalysisResult.diseaseName && aiAnalysisResult.diseaseName !== 'Not specified' && (
                        <div className="diagnosis-summary" style={{marginBottom: '15px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0'}}>
                          <h4 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>Diagnosis / Condition</h4>
                          <p style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#4361ee' }}><strong>{aiAnalysisResult.diseaseName}</strong></p>
                          <div style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6' }}>
                            {aiAnalysisResult.summary.split('\n').map((line, i) => (
                              <React.Fragment key={i}>
                                {line}
                                {i !== aiAnalysisResult.summary.split('\n').length - 1 && <br />}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {aiAnalysisResult.hospitalName && aiAnalysisResult.hospitalName !== 'Not specified' && (
                        <div className="hospital-info" style={{marginBottom: '15px'}}>
                          <p><span className="med-label">Hospital/Clinic:</span> {aiAnalysisResult.hospitalName}</p>
                        </div>
                      )}

                      {aiAnalysisResult.precautions && aiAnalysisResult.precautions.length > 0 && (
                        <div className="precautions-list" style={{marginBottom: '15px'}}>
                          <h4>Precautions & Lifestyle</h4>
                          <ul style={{paddingLeft: '20px', margin: '8px 0'}}>
                            {aiAnalysisResult.precautions.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {aiAnalysisResult.care_instructions && aiAnalysisResult.care_instructions.length > 0 && (
                        <div className="care-instructions-list" style={{marginBottom: '15px'}}>
                          <h4>Care Instructions (Pre-ops / Post-ops)</h4>
                          <ul style={{paddingLeft: '20px', margin: '8px 0'}}>
                            {aiAnalysisResult.care_instructions.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="medications-list">
                        <h4>Medications ({aiAnalysisResult.medications.length})</h4>
                        {aiAnalysisResult.medications.map((med, index) => (
                          <div className="medication-item" key={index}>
                            <div className="medication-icon">💊</div>
                            <div className="medication-details">
                              <h5>{med.name} - {med.dosage}</h5>
                              <p><span className="med-label">Frequency:</span> {med.frequency}</p>
                              <p><span className="med-label">Duration:</span> {med.duration}</p>
                              {Array.isArray(med.reminder_times) && med.reminder_times.length > 0 && (
                                <p><span className="med-label">Reminder Times:</span> {med.reminder_times.join(', ')}</p>
                              )}
                              {med.timing_summary && (
                                <p><span className="med-label">Timing:</span> {med.timing_summary}</p>
                              )}
                              <p><span className="med-label">Instructions:</span> {med.instructions}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {aiAnalysisResult.type !== 'lab_report' && (
                    <div className="calendar-actions" style={{ marginTop: '18px' }}>
                      <button className="secondary-button" onClick={handleSyncPrescriptionToGoogleCalendar} disabled={isSyncingCalendar}>
                        {isSyncingCalendar ? 'Syncing...' : (googleCalendarConnected ? 'Sync to Google Calendar' : 'Connect Google Calendar')}
                      </button>
                      {googleCalendarConnected && googleCalendarEmail && (
                        <p style={{ marginTop: '8px' }}>Connected as {googleCalendarEmail}</p>
                      )}
                      {calendarSyncMessage && (
                        <p style={{ marginTop: '8px' }}>{calendarSyncMessage}</p>
                      )}
                    </div>
                  )}

                  <div className="action-buttons">
                    <button className="secondary-button" onClick={() => {
                      setUploadedPrescription(null);
                      setAiAnalysisResult(null);
                    }}>Analyze Another</button>
                    <button className="primary-button" onClick={() => openSaveRecordModal('prescription')}>Save to My Records</button>
                  </div>
                </div>
              ) : (
                <div className="analyzing-section">
                  <div className={`loader ${isAnalyzing ? 'active' : ''}`}></div>
                  <h3>Analyzing Your Prescription</h3>
                  <p>This will take just a moment...</p>
                  
                  <div className="prescription-preview">
                    <div className="preview-header">
                      <p>{uploadedPrescription.length} file(s) selected</p>
                      <button className="change-file" onClick={() => setUploadedPrescription(null)}>Change</button>
                    </div>
                    <div className="preview-content">
                      {uploadedPrescription.map((file, index) => (
                        <div key={index} className="file-preview">
                          {file.type.includes('image') ? (
                            <img 
                              src={URL.createObjectURL(file)} 
                              alt={`Preview ${index + 1}`} 
                              className="prescription-image"
                            />
                          ) : (
                            <div className="file-icon">📄 {file.name}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <button 
                    className="analyze-button"
                    onClick={handleAnalyzePrescription}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fake OCR Modal */}
      {isFakeOcrLoading && (
        <div className="modal-overlay">
          <div className="modal-container ai-modal" style={{ textAlign: 'center', padding: '40px' }}>
             <div className="loader active" style={{ margin: '0 auto 20px auto' }}></div>
             <h3>AI doing OCR for saving using references...</h3>
          </div>
        </div>
      )}

      {/* Save Record Modal */}
      {showSaveRecordModal && (
        <div className="modal-overlay" style={{ zIndex: 1050 }}>
          <div className="modal-container save-record-modal">
            <div className="modal-header">
              <h2>Save to My Records</h2>
              <button className="close-button" onClick={closeSaveRecordModal}>×</button>
            </div>
            <form className="modal-content record-form" onSubmit={handleSaveRecord}>
              <p className="record-help-text">
                {saveRecordSource === 'direct_record' 
                  ? 'Please fill these three final details to complete saving your record.' 
                  : 'If OCR missed any details, fill them in below before saving.'}
              </p>

              <label className="record-field">
                <span>Doctor Name</span>
                <input
                  type="text"
                  name="doctorName"
                  value={recordForm.doctorName}
                  onChange={handleRecordFormChange}
                  placeholder="Enter doctor name"
                />
              </label>

              <label className="record-field">
                <span>Hospital Name</span>
                <input
                  type="text"
                  name="hospitalName"
                  value={recordForm.hospitalName}
                  onChange={handleRecordFormChange}
                  placeholder="Enter hospital name"
                />
              </label>

              <label className="record-field">
                <span>Disease / Condition</span>
                <input
                  type="text"
                  name="diseaseName"
                  value={recordForm.diseaseName}
                  onChange={handleRecordFormChange}
                  placeholder="Enter disease or condition"
                />
              </label>

              {saveRecordError && <div className="error-message record-error">{saveRecordError}</div>}

              <div className="record-actions">
                <button type="button" className="secondary-button" onClick={closeSaveRecordModal} disabled={isSavingRecord}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={isSavingRecord}>
                  {isSavingRecord ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Symptom Checker Modal */}
      {showSymptomModal && (
        <div className="modal-overlay">
          <div className="modal-container symptom-modal">
            <div className="modal-header">
              <h2>AI Symptom Checker</h2>
              <button className="close-button" onClick={closeSymptomCheckerModal}>×</button>
            </div>
            <div className="modal-content symptom-modal-content">
              {symptomStep === 'input' && (
                <div className="symptom-step">
                  <div className="upload-section symptom-intro">
                    <div className="upload-icon symptom-icon">🧠</div>
                    <h3>Describe Your Symptoms</h3>
                    <p>We’ll ask a few follow-up questions before giving cautious possible-condition guidance.</p>
                    <textarea
                      className="symptom-textarea"
                      value={symptomInput}
                      onChange={(e) => setSymptomInput(e.target.value)}
                      placeholder="Example: fever, headache, body pain, nausea for 2 days"
                      rows={5}
                    />
                    {symptomError && <div className="error-message symptom-error">{symptomError}</div>}
                    <div className="symptom-actions">
                      <button className="secondary-button" onClick={closeSymptomCheckerModal} disabled={isAnalyzingSymptoms}>
                        Cancel
                      </button>
                      <button className="primary-button" onClick={handleStartSymptomCheck} disabled={isAnalyzingSymptoms}>
                        {isAnalyzingSymptoms ? 'Thinking...' : 'Generate Questions'}
                      </button>
                    </div>
                    <p className="symptom-disclaimer-inline">
                      This is assistive only and not a diagnosis.
                    </p>
                  </div>
                </div>
              )}

              {symptomStep === 'questions' && (
                <div className="symptom-step">
                  <div className="symptom-followup-header">
                    <div className="symptom-followup-title-row">
                      <h3>Follow-up Questions</h3>
                      {questionSource === 'instant' && (
                        <span className="question-source-badge instant">⚡ Instant</span>
                      )}
                      {questionSource === 'cached' && (
                        <span className="question-source-badge cached">🗂 Cached</span>
                      )}
                      {questionSource === 'ai' && (
                        <span className="question-source-badge ai">✨ AI-Powered</span>
                      )}
                    </div>
                    <p>Answer these so the AI can refine the guidance.</p>
                  </div>
                  <div className="symptom-question-list">
                    {symptomQuestions.map((question, index) => (
                      <label
                        className={`symptom-question-card symptom-question-enter`}
                        key={`${index}-${question}`}
                        style={{ animationDelay: `${index * 80}ms` }}
                      >
                        <span>{index + 1}. {question}</span>
                        <input
                          type="text"
                          value={symptomAnswers[index] || ''}
                          onChange={(e) => handleSymptomAnswerChange(index, e.target.value)}
                          placeholder="Type your answer"
                        />
                      </label>
                    ))}
                    {isLoadingAiQuestions && (
                      <div className="symptom-ai-loading">
                        <div className="symptom-ai-loading-bar" />
                        <span>✨ Loading AI-personalised questions…</span>
                      </div>
                    )}
                  </div>
                  {symptomError && <div className="error-message symptom-error">{symptomError}</div>}
                  <div className="symptom-actions">
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setSymptomStep('input');
                        setSymptomError('');
                        setIsLoadingAiQuestions(false);
                      }}
                      disabled={isAnalyzingSymptoms}
                    >
                      Edit Symptoms
                    </button>
                    <button
                      className="primary-button"
                      onClick={handleFinalizeSymptomCheck}
                      disabled={isAnalyzingSymptoms || isLoadingAiQuestions || symptomAnswers.some((ans) => !ans || ans.trim() === '')}
                      title={symptomAnswers.some((ans) => !ans || ans.trim() === '') ? 'Please answer all questions before continuing' : ''}
                    >
                      {isAnalyzingSymptoms ? 'Analyzing...' : 'Get Possible Conditions'}
                    </button>
                  </div>
                </div>
              )}

              {symptomStep === 'analysis' && symptomAnalysisResult && (
                <div className="symptom-results">
                  <div className="result-header symptom-result-header">
                    <div className="result-icon symptom-result-icon">🩺</div>
                    <div>
                      <h3>Preliminary Symptom Guidance</h3>
                      <p>{symptomAnalysisResult.summary}</p>
                    </div>
                  </div>

                  <div className="symptom-section">
                    <h4>Possible Conditions</h4>
                    <div className="symptom-condition-list">
                      {(symptomAnalysisResult.possible_conditions || []).map((condition, index) => (
                        <div className="symptom-condition-card" key={`${condition?.name || 'condition'}-${index}`}>
                          <div className="symptom-condition-title">
                            <strong>{condition?.name || 'Possible condition'}</strong>
                            <span>{condition?.likelihood || 'Medium'} likelihood</span>
                          </div>
                          <p>{condition?.reasoning || 'AI reasoning not provided.'}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="symptom-section">
                    <h4>Precautionary Steps</h4>
                    <ul className="symptom-bullet-list">
                      {(symptomAnalysisResult.precautions || []).map((step, index) => (
                        <li key={`${step}-${index}`}>{step}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="symptom-section symptom-warning">
                    <h4>Seek Prompt Care If</h4>
                    <ul className="symptom-bullet-list">
                      {(symptomAnalysisResult.urgent_warning_signs || []).map((warning, index) => (
                        <li key={`${warning}-${index}`}>{warning}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="symptom-disclaimer-box">
                    <strong>Disclaimer:</strong> {symptomAnalysisResult.disclaimer || 'This is an AI-generated analysis and not a medical diagnosis. Please consult a qualified doctor for proper evaluation.'}
                  </div>

                  <div className="action-buttons">
                    <button className="secondary-button" onClick={openSymptomCheckerModal}>Start New Check</button>
                    <button className="primary-button" onClick={closeSymptomCheckerModal}>Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Health Report Analyzer Modal */}
      {showHealthReportModal && (
        <div className="modal-overlay">
          <div className="modal-container report-modal">
            <div className="modal-header">
              <h2>TabCura Health Report Analyzer</h2>
              <button className="close-button" onClick={closeHealthReportModal}>×</button>
            </div>
            <div className="modal-content">
              {!uploadedReport ? (
                <div className="upload-section">
                  <div className="upload-icon">📊</div>
                  <h3>Upload Your Medical Report</h3>
                  <p>Our AI will analyze your lab results and provide personalized insights</p>
                  <div className="report-type-examples">
                    <p>Supported report types: CBC, Liver Profile, Lipid Panel, etc.</p>
                  </div>
                  <button 
                    className="upload-report-btn"
                    onClick={() => reportInputRef.current.click()}
                  >
                    Choose Report
                  </button>
                  <input 
                    type="file" 
                    ref={reportInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleReportUpload} 
                      accept=".jpg,.jpeg,.png,.pdf"
                  />
                </div>
              ) : reportAnalysisResult ? (
                <div className="report-analysis-result">
                  <div className="result-header">
                    <div className="result-icon">📋</div>
                    <div>
                      <h3>{reportAnalysisResult.reportType} Analysis</h3>
                      <p>Report Date: {reportAnalysisResult.date}</p>
                    </div>
                  </div>
                  
                  <div className="report-summary">
                    <h4>Summary</h4>
                    <p>{reportAnalysisResult.summary}</p>
                  </div>
                  
                  <div className="parameters-table-container">
                    <h4>Parameters Analysis</h4>
                    <table className="parameters-table">
                      <thead>
                        <tr>
                          <th>Parameter</th>
                          <th>Value</th>
                          <th>Normal Range</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportAnalysisResult.parameters.map((param, index) => (
                          <tr key={index} className={`param-row ${param.status.toLowerCase().includes('normal') ? 'normal' : 'abnormal'}`}>
                            <td>{param.name}</td>
                            <td>{param.value}</td>
                            <td>{param.range}</td>
                            <td className={`status ${param.status.toLowerCase().includes('normal') ? 'normal-status' : 'abnormal-status'}`}>
                              {param.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="parameter-interpretations">
                    <h4>Interpretations</h4>
                    <div className="interpretation-list">
                      {reportAnalysisResult.parameters.map((param, index) => (
                        <div key={index} className="interpretation-item">
                          <div className="interpretation-header">
                            <strong>{param.name}:</strong>
                            <span className={`status-badge ${param.status.toLowerCase().includes('normal') ? 'normal-badge' : 'abnormal-badge'}`}>
                              {param.status}
                            </span>
                          </div>
                          <p>{param.interpretation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="recommendations-section">
                    <h4>Recommendations</h4>
                    <ul className="recommendations-list">
                      {reportAnalysisResult.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                    <div className="disclaimer">
                      <p><strong>Disclaimer:</strong> {reportAnalysisResult.disclaimer || 'This analysis is generated by AI and should not replace professional medical advice. Always consult with your healthcare provider before making any health decisions.'}</p>
                    </div>
                  </div>
                  
                  <div className="action-buttons">
                    <button className="secondary-button" onClick={() => {
                      setUploadedReport(null);
                      setReportAnalysisResult(null);
                    }}>Analyze Another Report</button>
                    <button className="primary-button" onClick={() => openSaveRecordModal('report')}>Save to My Records</button>
                  </div>
                </div>
              ) : (
                <div className="analyzing-section">
                  <div className={`loader ${isAnalyzingReport ? 'active' : ''}`}></div>
                  <h3>Analyzing Your Medical Report</h3>
                  <p>Our AI is examining your report. This may take a few moments...</p>
                  {reportAnalysisError && <div className="error-message record-error">{reportAnalysisError}</div>}
                  
                  <div className="report-preview">
                    <div className="preview-header">
                      <p>{uploadedReport.name}</p>
                      <button className="change-file" onClick={() => setUploadedReport(null)}>Change</button>
                    </div>
                    <div className="preview-content">
                      {uploadedReport.type.includes('image') ? (
                        <img 
                          src={URL.createObjectURL(uploadedReport)} 
                          alt="Report preview" 
                          className="report-image"
                        />
                      ) : (
                        <div className="file-icon">📄</div>
                      )}
                    </div>
                  </div>
                  
                  <button 
                    className="analyze-button"
                    onClick={handleAnalyzeReport}
                    disabled={isAnalyzingReport}
                  >
                    {isAnalyzingReport ? 'Analyzing...' : 'Start Analysis'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Entity Modal */}
      {entityModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-container entity-modal">
            <div className="modal-header">
              <h2 style={{ textTransform: 'capitalize' }}>
                {entityModal.type === 'documents' ? 'Medical Documents' : `Connected ${entityModal.type}`}
              </h2>
              <button className="close-button" onClick={() => setEntityModal({ isOpen: false, type: '', data: [] })}>×</button>
            </div>
            <div className="modal-content" style={{ maxHeight: '500px', overflowY: 'auto', padding: '20px' }}>
              {entityModal.data.length > 0 ? (
                entityModal.type === 'documents' ? (
                  <div className="records-grid" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {entityModal.data.map((doc, index) => (
                      <div key={index} className="recent-insight-card" style={{ background: 'white', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => handleViewDocument(doc)}>
                        <div style={{ fontSize: '24px' }}>📄</div>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: '0 0 5px 0', fontSize: '15px', color: '#1e293b' }}>{doc.name}</h3>
                          <div style={{ fontSize: '13px', color: '#64748b' }}>
                            <span>{doc.type}</span> • <span style={{ fontWeight: '500' }}>{new Date(doc.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {entityModal.data.map((item, index) => (
                      <li key={index} style={{ borderBottom: '1px solid #eee', display: 'flex', flexDirection: 'column' }}>
                        <div 
                          style={{ padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: expandedEntity === item.name ? '#f8fafc' : 'transparent', transition: 'background 0.2s' }}
                          onClick={() => setExpandedEntity(expandedEntity === item.name ? null : item.name)}
                        >
                          <span style={{ fontWeight: '600', fontSize: '16px', color: '#1e293b' }}>{item.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ background: '#eef2ff', color: '#4361ee', padding: '6px 14px', borderRadius: '20px', fontSize: '14px', fontWeight: '600' }}>
                              {item.count} {item.count === 1 ? 'Report' : 'Reports'}
                            </span>
                            <span style={{ transform: expandedEntity === item.name ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontSize: '12px', color: '#64748b' }}>▼</span>
                          </div>
                        </div>
                        {expandedEntity === item.name && (
                          <div style={{ padding: '0 15px 15px 15px', background: '#f8fafc' }}>
                            <div style={{ display: 'grid', gap: '10px', marginTop: '10px' }}>
                              {item.records.map((record, rIndex) => (
                                <div key={rIndex} style={{ padding: '12px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>{record.diseaseName || 'Medical Record'}</strong>
                                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>{new Date(record.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                  </div>
                                  <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.4' }}>
                                    {record.summary || 'No detailed summary available.'}
                                  </div>
                                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#64748b', display: 'flex', gap: '15px' }}>
                                    {entityModal.type !== 'doctors' && <span><strong style={{color: '#475569'}}>Doctor:</strong> {record.doctorName}</span>}
                                    {entityModal.type !== 'hospitals' && <span><strong style={{color: '#475569'}}>Hospital:</strong> {record.hospitalName}</span>}
                                  </div>
                                  <div style={{ marginTop: '12px', textAlign: 'right' }}>
                                    <button 
                                      style={{ background: '#4361ee', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
                                      onClick={(e) => { e.stopPropagation(); setViewRecord(record); }}
                                    >
                                      View Full Report
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>No data available yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record Details Modal */}
      {viewRecord && (
        <div className="modal-overlay">
          <div className="modal-container record-details-modal">
            <div className="modal-header">
              <h2>Medical Report: {viewRecord.diseaseName}</h2>
              <button className="close-button" onClick={() => setViewRecord(null)}>×</button>
            </div>
            <div className="modal-content" style={{ padding: '20px', maxHeight: '600px', overflowY: 'auto' }}>
              <div id="record-print-area">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#1e293b' }}>Dr. {viewRecord.doctorName}</h3>
                    <p style={{ margin: '5px 0 0 0', color: '#64748b' }}>{viewRecord.hospitalName}</p>
                  </div>
                  <div style={{ textAlign: 'right', color: '#64748b' }}>
                    <p style={{ margin: 0 }}>Date: {new Date(viewRecord.createdAt).toLocaleDateString()}</p>
                    <p style={{ margin: '5px 0 0 0', textTransform: 'capitalize' }}>Source: {viewRecord.sourceType || 'Medical Record'}</p>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#0f172a', marginBottom: '10px' }}>Summary</h4>
                  <p style={{ color: '#475569', lineHeight: '1.6' }}>{viewRecord.summary || 'No summary available.'}</p>
                </div>

                {viewRecord.medications && viewRecord.medications.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ color: '#0f172a', marginBottom: '10px' }}>Medications</h4>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {viewRecord.medications.map((med, idx) => (
                        <li key={idx} style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', marginBottom: '8px' }}>
                          <strong style={{ color: '#1e293b' }}>{med.name}</strong> - {med.dosage} ({med.frequency}) for {med.duration}
                          {med.instructions && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Note: {med.instructions}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {viewRecord.analysisData && viewRecord.analysisData.lab_results && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ color: '#0f172a', marginBottom: '10px' }}>Lab Results</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                          <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>Test</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>Value</th>
                          <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>Range</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewRecord.analysisData.lab_results.map((lab, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '10px', color: '#475569' }}>{lab.test}</td>
                            <td style={{ padding: '10px', fontWeight: lab.status && lab.status.toLowerCase() !== 'normal' ? '600' : 'normal', color: lab.status && lab.status.toLowerCase() !== 'normal' ? '#ef4444' : '#475569' }}>{lab.value}</td>
                            <td style={{ padding: '10px', color: '#64748b' }}>{lab.range}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                {viewRecord.documentUrl ? (
                  <button 
                    className="primary-button" 
                    onClick={() => {
                      window.open(`${API_BASE_URL}${viewRecord.documentUrl}`, '_blank');
                    }}
                  >
                    View Original Document
                  </button>
                ) : (
                  <button 
                    className="primary-button" 
                    style={{ background: '#94a3b8', cursor: 'not-allowed', borderColor: '#94a3b8' }}
                    disabled
                    title="Original file was not saved with this record."
                  >
                    Original Document Unavailable
                  </button>
                )}
                <button className="secondary-button" onClick={() => setViewRecord(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Complete Appointment Modal ── */}
      {showCompleteApptModal && completeApptTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px'
        }} onClick={e => { if (e.target === e.currentTarget) setShowCompleteApptModal(false); }}>
          <div style={{
            background: 'white', borderRadius: '20px', padding: '36px',
            width: '100%', maxWidth: '540px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            animation: 'fadeIn 0.25s ease'
          }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '22px', color: '#1e293b', fontWeight: '700' }}>
                ✓ Complete Appointment
              </h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                Follow-up for <strong>{completeApptTarget.diseaseName}</strong> · Dr. {completeApptTarget.doctorName}
              </p>
            </div>

            {/* Upload area */}
            <div
              onClick={() => completeApptFileRef.current && completeApptFileRef.current.click()}
              style={{
                border: completeApptFile ? '2px solid #4361ee' : '2px dashed #cbd5e1',
                borderRadius: '14px',
                padding: '28px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: completeApptFile ? '#eff6ff' : '#f8fafc',
                marginBottom: '16px',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>{completeApptFile ? '📄' : '⬆️'}</div>
              {completeApptFile ? (
                <>
                  <p style={{ margin: '0 0 4px', fontWeight: '600', color: '#1e293b' }}>{completeApptFile.name}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Click to change file</p>
                </>
              ) : (
                <>
                  <p style={{ margin: '0 0 4px', fontWeight: '600', color: '#1e293b' }}>Upload New Document (Optional)</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Upload a new prescription / lab report from this visit for AI analysis</p>
                </>
              )}
              <input
                ref={completeApptFileRef}
                type="file"
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files[0];
                  if (f) {
                    setCompleteApptFile(f);
                    setCompleteApptAnalysis(null);
                    setCompleteApptError('');
                  }
                }}
              />
            </div>

            {/* Analyse button */}
            {completeApptFile && !completeApptAnalysis && (
              <button
                className="primary-button"
                onClick={handleAnalyzeCompleteDoc}
                disabled={isAnalyzingCompleteDoc}
                style={{ width: '100%', marginBottom: '14px', background: '#4361ee' }}
              >
                {isAnalyzingCompleteDoc ? '🔍 Analysing...' : '🤖 Analyse with AI'}
              </button>
            )}

            {/* Analysis result preview */}
            {completeApptAnalysis && (
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: '12px', padding: '16px', marginBottom: '16px'
              }}>
                <p style={{ margin: '0 0 6px', fontWeight: '700', color: '#15803d', fontSize: '14px' }}>✅ Analysis Complete</p>
                {completeApptAnalysis.doctor && <p style={{ margin: '2px 0', fontSize: '13px', color: '#166534' }}>👨‍⚕️ Doctor: {completeApptAnalysis.doctor}</p>}
                {completeApptAnalysis.diseaseName && <p style={{ margin: '2px 0', fontSize: '13px', color: '#166534' }}>🩺 Diagnosis: {completeApptAnalysis.diseaseName}</p>}
                {completeApptAnalysis.summary && <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#166534', lineHeight: 1.5 }}>{completeApptAnalysis.summary}</p>}
              </div>
            )}

            {/* Error */}
            {completeApptError && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '10px', padding: '12px 16px', marginBottom: '14px'
              }}>
                <p style={{ margin: '0 0 4px', color: '#b91c1c', fontSize: '13px', fontWeight: '600' }}>
                  {completeApptError}
                </p>
                <p style={{ margin: 0, color: '#b91c1c', fontSize: '12px' }}>
                  You can still confirm and mark the appointment as completed without the AI analysis.
                </p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="secondary-button"
                onClick={() => setShowCompleteApptModal(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={handleConfirmCompleteAppt}
                style={{ flex: 2, background: '#16a34a' }}
              >
                ✓ Confirm &amp; Mark Completed
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Profile;
