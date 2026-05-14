const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3001;
let io = null;
const { Server: SocketIOServer } = require('socket.io');

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

app.use(express.json());

// Import models
const User = require('./models/User');
const Document = require('./models/Document');
const MedicalRecord = require('./models/MedicalRecord');
const AnalysisEvent = require('./models/AnalysisEvent');
const Appointment = require('./models/Appointment');

// Helper functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateContentWithRetry(prompt, options = { retries: 2, baseDelayMs: 1500 }) {
  let attempt = 0;
  
  // Try primary model first
  while (attempt <= options.retries) {
    try {
      console.log(`[AI Logic] Attempting with primary model (gemini-2.5-flash) - attempt ${attempt + 1}`);
      return await primaryModel.generateContent(prompt);
    } catch (error) {
      console.error(`[AI Logic] Primary model error (attempt ${attempt + 1}):`, error.message);
      
      // If we've exhausted primary retries OR it's a specific "limit exhausted" error (like 429 or 503)
      if (attempt === options.retries || error.message?.includes('503') || error.message?.includes('429') || error.message?.includes('quota')) {
        console.warn('[AI Logic] Switching to fallback model (gemma-4-26b-a4b-it)...');
        try {
          return await fallbackModel.generateContent(prompt);
        } catch (fallbackError) {
          console.error('[AI Logic] Fallback model also failed:', fallbackError.message);
          throw fallbackError;
        }
      }
      
      attempt++;
      await new Promise(resolve => setTimeout(resolve, options.baseDelayMs * attempt));
    }
  }
}

function buildSymptomFallback(payload) {
  return {
    stage: 'error',
    summary: 'We encountered an error analyzing your symptoms. Please try again.',
    concern_level: 'medium',
    questions: [],
    disclaimer: 'This is an AI-generated analysis and not a medical diagnosis.'
  };
}

function getGoogleOAuthClient() {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://deployment-tabcura.onrender.com/api/google/calendar/callback';
  console.log('OAuth Debug - Final Redirect URI being used:', redirectUri);
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

async function getGoogleCalendarAuthUrlForUser(user) {
  const oauth2Client = getGoogleOAuthClient();
  const state = jwt.sign({ userId: String(user._id) }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    state,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'https://deployment-tabcura.onrender.com/api/google/calendar/callback'
  });
}

function buildMedicationCalendarEvents(medication, date) {
  const events = [];
  
  // Validate base date
  let baseDate = new Date(date);
  if (isNaN(baseDate.getTime())) {
    baseDate = new Date();
  }

  const times = (Array.isArray(medication.reminder_times) && medication.reminder_times.length > 0) 
    ? medication.reminder_times 
    : ['09:00'];
  
  const duration = parseInt(medication.duration_days) || 7;
  
  for (const time of times) {
    if (!time || typeof time !== 'string' || !time.includes(':')) continue;

    const parts = time.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    
    if (isNaN(hours) || isNaN(minutes)) {
      console.warn(`Invalid time format detected: ${time}`);
      continue;
    }

    const startDateTime = new Date(baseDate);
    startDateTime.setHours(hours, minutes, 0, 0);
    
    // Safety check for invalid date after setting hours
    if (isNaN(startDateTime.getTime())) {
      console.warn('Resulting startDateTime is invalid');
      continue;
    }

    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + 15);
    
    events.push({
      summary: `Take Medication: ${medication.name}`,
      description: `Dosage: ${medication.dosage}\nInstructions: ${medication.instructions}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE || 'UTC',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE || 'UTC',
      },
      recurrence: [
        `RRULE:FREQ=DAILY;COUNT=${duration}`
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 }
        ]
      }
    });
  }
  
  return events;
}

app.use((req, res, next) => {
  next();
});

function getUserIdFromReq(req) {
  try {
    const auth = req.headers && (req.headers['authorization'] || req.headers['Authorization']);
    if (!auth) return null;
    const parts = auth.split(' ');
    if (parts.length !== 2) return null;
    const token = parts[1];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    return decoded && decoded.id ? String(decoded.id) : null;
  } catch (err) {
    return null;
  }
}

const mongooseOptions = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
};

const primaryMongoUri = process.env.MONGO_URI;
const fallbackMongoUri = process.env.MONGO_URI_FALLBACK || 'mongodb://localhost:27017/reckon';

async function connectToMongo() {
  const uriToUse = primaryMongoUri || fallbackMongoUri;

  try {
    await mongoose.connect(uriToUse, mongooseOptions);
    console.log(`MongoDB connected successfully (${primaryMongoUri ? 'primary URI' : 'fallback URI'})`);
    return;
  } catch (err) {
    const isSrvLookupError = err && err.code === 'ENOTFOUND' && err.syscall === 'querySrv';
    if (isSrvLookupError) {
      console.error('MongoDB Atlas SRV lookup failed. Verify your MONGO_URI host from Atlas "Connect > Drivers".');
    }

    if (!primaryMongoUri || primaryMongoUri === fallbackMongoUri) {
      throw err;
    }

    console.warn('Primary MongoDB connection failed. Trying local fallback URI...');
    await mongoose.connect(fallbackMongoUri, mongooseOptions);
    console.log('MongoDB connected successfully (fallback URI)');
  }
}

connectToMongo()
  .then(() => {
    // Start the server with better error handling for port conflicts
    startServer();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit with failure code
  });

// Function to start the server with port conflict handling
function startServer(retryPort = PORT) {
  // Convert port to number and validate - this fixes the string concatenation issue
  const portNum = Number(retryPort);
  
  // Check if port is valid (must be between 0 and 65535)
  if (isNaN(portNum) || portNum < 0 || portNum > 65535) {
    console.error(`Invalid port number: ${retryPort}. Must be between 0 and 65535.`);
    // Fall back to alternate port (3002 or 8080)
    retryPort = 3002;
    console.log(`Falling back to port ${retryPort}...`);
  } else {
    // Ensure retryPort is a number, not a string
    retryPort = portNum;
  }
  
  const server = app.listen(retryPort)
    .on('listening', () => {
      const actualPort = server.address().port;
      console.log(`Server running on port ${actualPort}`);
      console.log(`Test the API: http://localhost:${actualPort}/api/health`);
    })
    .on('listening', () => {
      try {
        // Initialize Socket.IO on the running server
        io = new SocketIOServer(server, { cors: { origin: '*' } });
        io.on('connection', (socket) => {
          console.log('Socket.IO client connected:', socket.id);

          // Authenticate socket using JWT sent in handshake auth
          try {
            const token = (socket.handshake && socket.handshake.auth && socket.handshake.auth.token) ||
                          (socket.handshake && socket.handshake.headers && (socket.handshake.headers['authorization'] || socket.handshake.headers['Authorization']));

            let rawToken = null;
            if (token && typeof token === 'string') {
              // header value may be 'Bearer <token>'
              if (token.startsWith('Bearer ')) rawToken = token.split(' ')[1];
              else rawToken = token;
            }

            if (rawToken) {
              try {
                const decoded = jwt.verify(rawToken, process.env.JWT_SECRET || 'secret');
                const uid = decoded && decoded.id ? String(decoded.id) : null;
                if (uid) {
                  const room = `user_${uid}`;
                  socket.join(room);
                  socket.userRoom = room;
                  socket.userId = uid;
                  console.log(`Socket ${socket.id} authenticated and joined room ${room}`);
                }
              } catch (jwtErr) {
                console.warn('Socket JWT verification failed:', jwtErr && jwtErr.message);
              }
            }
          } catch (authErr) {
            console.warn('Error during socket auth:', authErr && authErr.message);
          }

          // Backwards compatibility: allow explicit join/leave if token not provided
          socket.on('join', (data) => {
            try {
              const userId = data && data.userId ? String(data.userId) : null;
              if (!userId) return;
              const room = `user_${userId}`;
              socket.join(room);
              socket.userRoom = room;
              console.log(`Socket ${socket.id} joined room ${room} (fallback)`);
            } catch (err) {
              console.warn('Error in join handler:', err && err.message);
            }
          });

          socket.on('leave', (data) => {
            try {
              const userId = data && data.userId ? String(data.userId) : null;
              if (!userId) return;
              const room = `user_${userId}`;
              socket.leave(room);
              delete socket.userRoom;
              console.log(`Socket ${socket.id} left room ${room} (fallback)`);
            } catch (err) {
              console.warn('Error in leave handler:', err && err.message);
            }
          });

          socket.on('disconnect', (reason) => {
            console.log('Socket.IO client disconnected:', socket.id, reason);
            try {
              if (socket.userRoom) {
                socket.leave(socket.userRoom);
              }
            } catch (e) {
              // ignore
            }
          });
        });
        console.log('Socket.IO initialized');
      } catch (e) {
        console.warn('Failed to initialize Socket.IO:', e && e.message);
      }
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Add explicit Number conversion and +1 to ensure numerical addition
        const nextPort = Number(retryPort) + 1;
        
        // Safety check to prevent infinite recursion
        if (nextPort >= 65535) {
          console.error('No available ports found. Please free up ports or specify a different port range.');
          process.exit(1);
          return;
        }
        
        console.warn(`Port ${retryPort} is already in use, trying port ${nextPort}...`);
        
        // Kill the server instance that failed to start
        server.close();
        
        // Try the next port
        startServer(nextPort);
      } else {
        console.error('Error starting server:', err);
        process.exit(1);
      }
    });
  
  // Handle server shutdown gracefully
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    });
  });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, 'uploads');
    // Create the uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const extension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only certain file types
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPEG, PNG, DOC, and DOCX are allowed.'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 8 // Maximum 8 files
  }
});

// Create uploads directory for storing documents
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`Created uploads directory at: ${uploadsDir}`);
  } catch (error) {
    console.error('Error creating uploads directory:', error);
  }
}

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log(`Serving static files from: ${uploadsDir}`);

// API Health Check endpoint
app.get('/api/health', (req, res) => {
  return res.status(200).json({ 
    status: 'OK',
    message: 'TabCura API is running',
    timestamp: new Date()
  });
});

// Debug endpoint
app.get('/api/debug', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Debug endpoint working',
    timestamp: new Date()
  });
});

// IMPORTANT: Place more specific routes before generic ones
// Get user by username route (must be before the :id route)
app.get('/api/users/username/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return user without sensitive information
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        username: user.username,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth
      }
    });
    
  } catch (error) {
    console.error('Error fetching user by username:', error);
    return res.status(500).json({ 
      message: 'Error fetching user data',
      error: error.message 
    });
  }
});

// Get user by ID route
app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return user without sensitive information
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        username: user.username,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth
      }
    });
    
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ 
      message: 'Error fetching user data',
      error: error.message 
    });
  }
});

// Get all users route
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password'); // Exclude password field
    
    res.status(200).json({
      success: true,
      count: users.length,
      users: users.map(user => ({
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        username: user.username
      }))
    });
    
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ 
      message: 'Error fetching users',
      error: error.message 
    });
  }
});

// User registration endpoint
app.post('/api/users/register', async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    
    // Check if Content-Type is application/json
    const contentType = req.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        message: 'Invalid Content-Type. Expected application/json'
      });
    }
    
    const { firstName, lastName, email, username, password, dateOfBirth, gender } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !email || !username || !password) {
      console.log('Validation failed: missing required fields');
      return res.status(400).json({
        message: 'Please provide all required fields'
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email },
        { username }
      ] 
    });
    
    if (existingUser) {
      console.log('User already exists:', existingUser.email);
      return res.status(400).json({ 
        message: 'User with this email or username already exists' 
      });
    }
    
    // Hash password before saving
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = new User({
      firstName,
      lastName,
      email,
      username,
      password: hashedPassword,
      dateOfBirth,
      gender
    });

    // Save user to database
    const savedUser = await newUser.save();
    console.log('User registered successfully:', savedUser.email);
    
    // Sign a JWT token for the new user
    const token = jwt.sign({ id: String(savedUser._id), email: savedUser.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

    // Return success response
    return res.status(201).json({
      success: true,
      token,
      user: {
        id: savedUser._id,
        name: `${savedUser.firstName} ${savedUser.lastName}`,
        email: savedUser.email,
        username: savedUser.username
      }
    });
    
  } catch (error) {
    console.error('Error registering user:', error);
    return res.status(500).json({ 
      message: 'Error registering user',
      error: error.message 
    });
  }
});

// User login endpoint
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password, isDoctor } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    
    // Check if user exists and password matches using bcrypt
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check if trying to access doctor portal but not a doctor
    if (isDoctor && !user.isDoctor) {
      return res.status(403).json({ message: 'Not authorized as a healthcare provider' });
    }
    
    // Sign a JWT token for the user
    const token = jwt.sign({ id: String(user._id), email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

    // Return user data with token
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        username: user.username,
        isDoctor: user.isDoctor,
        specialty: user.specialty
      }
    });
    
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ 
      message: 'Error logging in',
      error: error.message 
    });
  }
});

// Document upload endpoint with improved error handling
app.post('/api/documents/upload', (req, res) => {
  console.log('Document upload endpoint hit');
  console.log('Headers:', req.headers);
  
  // Use middleware directly here to better handle errors
  const uploadMiddleware = upload.single('document');
  
  uploadMiddleware(req, res, function(err) {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ 
        success: false,
        message: 'File upload error', 
        error: err.message 
      });
    }
    
    // Continue with processing if no error
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    console.log('File received:', req.file);
    console.log('Body:', req.body);
    
    try {
      const userIdFromBody = req.body.userId;
      const documentType = req.body.documentType;
      const userId = userIdFromBody || getUserIdFromReq(req);

      // Validate userId
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required (provide in body or Authorization header)' });
      }
      
      // Process document
      User.findById(userId)
        .then(user => {
          if (!user) {
            // Clean up file if user not found
            try {
              fs.unlinkSync(req.file.path);
            } catch (err) {
              console.error('Error removing file:', err);
            }
            return res.status(404).json({ message: 'User not found' });
          }
          
          // Create document record
          const newDocument = new Document({
            userId,
            name: req.file.filename,
            originalName: req.file.originalname,
            type: documentType || 'Medical Document',
            size: req.file.size,
            path: req.file.path,
            contentType: req.file.mimetype,
            summary: req.body.summary || ''
          });
          
          return newDocument.save();
        })
        .then(savedDocument => {
          console.log('Document saved:', savedDocument);
          return res.status(201).json({
            success: true,
            document: {
              id: savedDocument._id,
              name: savedDocument.originalName,
              type: savedDocument.type,
              summary: savedDocument.summary,
              date: savedDocument.uploadDate,
              url: `/uploads/${savedDocument.name}`
            }
          });
        })
        .catch(err => {
          // Clean up file on error
          if (req.file && req.file.path) {
            try {
              fs.unlinkSync(req.file.path);
            } catch (unlinkErr) {
              console.error('Error removing file:', unlinkErr);
            }
          }
          
          console.error('Document processing error:', err);
          return res.status(500).json({
            success: false,
            message: 'Error processing document',
            error: err.message
          });
        });
    } catch (error) {
      console.error('Error in document upload handler:', error);
      // Clean up file on error
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error('Error removing file:', err);
        }
      }
      
      return res.status(500).json({
        success: false,
        message: 'Server error processing document',
        error: error.message
      });
    }
  });
});

// Get user documents endpoint
app.get('/api/documents/:userId?', async (req, res) => {
  try {
    let { userId } = req.params;

    if (!userId || userId === 'me') {
      const uid = getUserIdFromReq(req);
      if (!uid) return res.status(400).json({ message: 'User ID is required (or provide Authorization token)' });
      userId = uid;
    }

    // Find all documents for the specified user
    const documents = await Document.find({ userId }).sort({ uploadDate: -1 });

    // Transform document data for the frontend
    const documentList = documents.map(doc => ({
      id: doc._id,
      name: doc.originalName,
      type: doc.type,
      summary: doc.summary,
      date: doc.uploadDate.toISOString().split('T')[0],
      url: `/uploads/${doc.name}`
    }));

    return res.status(200).json({
      success: true,
      documents: documentList
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.status(500).json({ 
      message: 'Error fetching documents',
      error: error.message 
    });
  }
});

// Delete document endpoint
app.delete('/api/documents/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    // Find the document
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Remove the file
    if (fs.existsSync(document.path)) {
      fs.unlinkSync(document.path);
    }

    // Remove the document from the database
    await Document.findByIdAndDelete(documentId);

    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return res.status(500).json({ 
      message: 'Error deleting document',
      error: error.message 
    });
  }
});

// Save structured medical records from AI analysis or manual entry
app.post('/api/records', async (req, res) => {
  try {
    const {
      userId,
      sourceType = 'prescription',
      doctorName = '',
      hospitalName = '',
      diseaseName = '',
      analysisData = {},
      summary = '',
      medications = [],
      documentUrl = '',
      prescriptionDate = null
    } = req.body;

    const userIdFromBody = userId;
    const resolvedUserId = userIdFromBody || getUserIdFromReq(req);

    console.log('--- SAVING RECORD ---');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Received documentUrl:', documentUrl);

    if (!resolvedUserId) {
      return res.status(400).json({ message: 'User ID is required (provide in body or Authorization header)' });
    }

    const user = await User.findById(resolvedUserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const normalizedDoctorName = String(doctorName).trim();
    const normalizedHospitalName = String(hospitalName).trim();
    const normalizedDiseaseName = String(diseaseName).trim();

    if (!normalizedDoctorName || !normalizedHospitalName || !normalizedDiseaseName) {
      return res.status(400).json({
        message: 'Doctor name, hospital name, and disease name are required'
      });
    }

    const record = new MedicalRecord({
      userId: resolvedUserId,
      sourceType,
      doctorName: normalizedDoctorName,
      hospitalName: normalizedHospitalName,
      diseaseName: normalizedDiseaseName,
      summary: String(summary || '').trim(),
      medications: Array.isArray(medications) ? medications : [],
      analysisData,
      documentUrl: String(documentUrl || '').trim(),
      prescriptionDate: prescriptionDate ? new Date(prescriptionDate) : null
    });

    const savedRecord = await record.save();

    // Emit realtime event for saved records
    try {
      if (io) {
        const room = `user_${String(savedRecord.userId)}`;
        io.to(room).emit('record_saved', { userId: String(savedRecord.userId), recordId: String(savedRecord._id), doctorName: savedRecord.doctorName, hospitalName: savedRecord.hospitalName, diseaseName: savedRecord.diseaseName, createdAt: savedRecord.createdAt });
      }
    } catch (emitErr) {
      console.warn('Failed to emit record_saved:', emitErr && emitErr.message);
    }

    return res.status(201).json({
      success: true,
      record: {
        id: savedRecord._id,
        sourceType: savedRecord.sourceType,
        doctorName: savedRecord.doctorName,
        hospitalName: savedRecord.hospitalName,
        diseaseName: savedRecord.diseaseName,
        summary: savedRecord.summary,
        documentUrl: savedRecord.documentUrl,
        createdAt: savedRecord.createdAt
      }
    });
  } catch (error) {
    console.error('Error saving medical record:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save medical record',
      error: error.message
    });
  }
});

// Get user activity analytics
app.get('/api/analytics/activity/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const days = parseInt(req.query.days) || 7;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    // Generate list of date strings (YYYY-MM-DD) for the past N days
    const daysList = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      daysList.push(`${year}-${month}-${day}`);
    }

    const MedicalRecord = require('./models/MedicalRecord');

    // Aggregate analyses
    const analysesAgg = await AnalysisEvent.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: startDate } } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
      }}
    ]);

    // Aggregate records
    const recordsAgg = await MedicalRecord.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: startDate } } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
      }}
    ]);

    // Format data to align with daysList
    const analysesByDay = daysList.map(d => {
      const match = analysesAgg.find(a => a._id === d);
      return match ? match.count : 0;
    });

    const recordsByDay = daysList.map(d => {
      const match = recordsAgg.find(a => a._id === d);
      return match ? match.count : 0;
    });

    return res.status(200).json({
      success: true,
      days: daysList,
      analyses: analysesByDay,
      records: recordsByDay
    });
  } catch (error) {
    console.error('Analytics fetch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch analytics', error: error.message });
  }
});

// Get saved records for a user
app.get('/api/records/:userId?', async (req, res) => {
  try {
    let { userId } = req.params;

    if (!userId || userId === 'me') {
      const uid = getUserIdFromReq(req);
      if (!uid) return res.status(400).json({ message: 'User ID is required (or provide Authorization token)' });
      userId = uid;
    }

    const records = await MedicalRecord.find({ userId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      records: records.map(record => ({
        id: record._id,
        sourceType: record.sourceType,
        doctorName: record.doctorName,
        hospitalName: record.hospitalName,
        diseaseName: record.diseaseName,
        summary: record.summary,
        documentUrl: record.documentUrl,
        medications: record.medications,
        analysisData: record.analysisData,
        createdAt: record.createdAt,
        prescriptionDate: record.prescriptionDate || record.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching medical records:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch medical records',
      error: error.message
    });
  }
});

// Update User Profile
app.put('/api/users/profile', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req) || req.body.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { firstName, lastName, dateOfBirth, gender } = req.body;
    
    // Find user and update
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
    if (gender) user.gender = gender;
    
    user.updatedAt = Date.now();

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
  }
});

// Doctor API endpoints
// Get patients with documents mentioning the doctor
app.get('/api/doctor/patients/:doctorId', async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    // Verify this is a doctor account
    const doctor = await User.findById(doctorId);
    if (!doctor || !doctor.isDoctor) {
      return res.status(403).json({ message: 'Not authorized as a healthcare provider' });
    }
    
    // In a real app, we would:
    // 1. Find documents that mention this doctor (using text analysis)
    // 2. Get the patients who own these documents
    // 3. Return patient data with their documents and conditions
    
    // Mock data for demonstration
    const mockPatients = [
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
      // ...other mock patient data...
    ];
    
    res.status(200).json({
      success: true,
      patients: mockPatients
    });
    
  } catch (error) {
    console.error('Error fetching doctor patients:', error);
    res.status(500).json({
      message: 'Failed to fetch patients',
      error: error.message
    });
  }
});

// Add endpoint to categorize patients (add disease classification)
app.post('/api/doctor/patients/:patientId/categorize', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { doctorId, disease, notes } = req.body;
    
    // Verify this is a doctor account
    const doctor = await User.findById(doctorId);
    if (!doctor || !doctor.isDoctor) {
      return res.status(403).json({ message: 'Not authorized as a healthcare provider' });
    }
    
    // In a real app, we would:
    // 1. Validate the patient exists
    // 2. Add the disease categorization to the patient record
    // 3. Return the updated patient data
    
    res.status(200).json({
      success: true,
      message: 'Patient categorized successfully',
      categorization: {
        disease,
        diagnosedOn: new Date().toISOString(),
        notes
      }
    });
    
  } catch (error) {
    console.error('Error categorizing patient:', error);
    res.status(500).json({
      message: 'Failed to categorize patient',
      error: error.message
    });
  }
});

// Import additional packages for PDF parsing and Gemini API
const pdfParse = require('pdf-parse');
const axios = require('axios');
const { createReadStream } = require('fs');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');

// Gemini API integration - Add this before starting the server
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Import Gemini SDK
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini API models
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const modelConfig = {
  generationConfig: {
    temperature: 0.1,
    topP: 0.1,
    topK: 16
  },
  systemInstruction: "You are a medical document analyzer. Produce accurate, patient-safe, structured JSON for lab reports, prescriptions, and medical reports."
};

const primaryModel = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  ...modelConfig
});

const fallbackModel = genAI.getGenerativeModel({ 
  model: "gemma-4-26b-a4b-it",
  ...modelConfig
});

// Update the extractTextFromPDF function
async function extractTextFromPDF(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    const text = data.text.trim();
    
    if (!text || text.length < 50) {
      throw new Error('No readable text found in PDF');
    }

    console.log('Successfully extracted text from PDF');
    return text;
  } catch (error) {
    console.error('PDF processing error:', error);
    try {
      const fallbackImagePath = `${pdfPath}_page1.png`;
      await sharp(pdfPath, { density: 300, page: 0 })
        .png()
        .toFile(fallbackImagePath);

      const ocrResult = await Tesseract.recognize(
        fallbackImagePath,
        'eng',
        {
          logger: m => console.log(m),
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,-%/: ',
          tessedit_pageseg_mode: '6'
        }
      );

      try {
        fs.unlinkSync(fallbackImagePath);
      } catch (cleanupError) {
        console.error('Error removing PDF fallback image:', cleanupError);
      }

      const fallbackText = ocrResult?.data?.text?.trim() || '';
      if (fallbackText.length >= 20) {
        console.log('Successfully extracted text from PDF via OCR fallback');
        return fallbackText;
      }
    } catch (fallbackError) {
      console.error('PDF OCR fallback error:', fallbackError);
    }

    throw new Error('Failed to extract text from PDF. Please upload a clearer PDF or an image version of the prescription.');
  }
}

// Update image extraction function for better quality
async function extractTextFromImage(imagePath) {
  try {
    // Preprocess image
    const processedImagePath = `${imagePath}_processed.png`;
    await sharp(imagePath)
      .resize(2480, 3508, { // A4 size at 300 DPI
        fit: 'contain',
        background: { r: 255, g: 255, b: 255 }
      })
      .modulate({
        brightness: 1.1,
        contrast: 1.2,
      })
      .sharpen()
      .normalize() // Normalize the image
      .toFile(processedImagePath);

    // Use Tesseract.js v4 properly
    const result = await Tesseract.recognize(
      processedImagePath,
      'eng',
      {
        logger: m => console.log(m), // Add logging for debugging
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,-%/: ',
        tessedit_pageseg_mode: '6'
      }
    );

    // Clean up processed image
    try {
      fs.unlinkSync(processedImagePath);
    } catch (err) {
      console.error('Error removing processed image:', err);
    }

    if (!result.data.text.trim()) {
      throw new Error('No text could be extracted from the image');
    }

    return result.data.text;
  } catch (error) {
    console.error('OCR error:', error);
    throw new Error('Failed to extract text from image');
  }
}

// Function to analyze prescription text with Gemini API
async function analyzePrescriptionWithGemini(documentText, fileCount) {
  try {
    const prompt = {
      contents: [{
        parts: [{
          text: `Analyze this medical document and extract key information into structured JSON format.

Document Text:
${documentText}

Rules:
1. If it's a lab report, include test name, value, range, and status (H for high, L for low, or null for normal)
2. If it's a prescription, include medication details, hospital name, disease name, precautions, and any pre-op/post-op care instructions.
3. Always identify the document type, date, and doctor's name
4. Format results based on document type

Return a JSON object with this exact structure:
{
  "type": "lab_report" or "prescription",
  "date": "document date in DD/MM/YYYY format",
  "doctor": "doctor name",
  "hospitalName": "hospital name if available, otherwise 'Not specified', it can be finded by the key words such as hospital,clinic,care home etc",
  "diseaseName": "diagnosis or condition if available, otherwise 'Not specified'",
  "precautions": ["list of precautions or lifestyle changes recommended"],
  "care_instructions": ["list of pre-ops, post-ops, or other specific care instructions"],
  "lab_results": [
    { "test": "test name", "value": "result value", "range": "normal range", "status": "H/L/null" } also mention the precautions for each test result , like suggest the ways  i can make it normal and healthy and if its critical then suggest it like doctor said to take it as critical
  ],
  "medications": [
    {
      "name": "",
      "dosage": "",
      "frequency": "",
      "duration": "",
      "duration_days": 0,
      "instructions": "",
      "reminder_times": ["08:00"],
      "timing_summary": "morning/afternoon/evening/night or meal-based timing summary"
    }
  ],
  "documents_analyzed": ${fileCount},
  "summary": "A brief, empathetic introductory message addressed to the patient explaining the condition and treatment plan in a reassuring tone (e.g. 'Hello Arjun, please don't be concerned...'). Do NOT include bullet points, precautions, or lists here. Keep it to 8-10 sentences."
},
"IMPORTANT: All dates MUST be interpreted and returned in Indian format (DD/MM/YYYY). For example, 04/05/2026 is May 4th, NOT April 5th."`
        }]
      }]
    };

    const result = await generateContentWithRetry(prompt, { retries: 2, baseDelayMs: 1500 });
    const responseText = result.response.text();
    
    try {
      let jsonStr = responseText;
      const mdMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (mdMatch) {
        jsonStr = mdMatch[1];
      } else {
        const start = responseText.indexOf('{');
        const end = responseText.lastIndexOf('}');
        if (start !== -1 && end !== -1) jsonStr = responseText.substring(start, end + 1);
      }
      const parsedResult = JSON.parse(jsonStr.trim());

      // Add default values for missing fields
      return {
        type: parsedResult.type || 'unknown',
        date: parsedResult.date || 'Not specified',
        doctor: parsedResult.doctor || 'Not specified',
        hospitalName: parsedResult.hospitalName || 'Not specified',
        diseaseName: parsedResult.diseaseName || 'Not specified',
        precautions: Array.isArray(parsedResult.precautions) ? parsedResult.precautions : [],
        care_instructions: Array.isArray(parsedResult.care_instructions) ? parsedResult.care_instructions : [],
        lab_results: parsedResult.lab_results || [],
        medications: (parsedResult.medications || []).map((medication) => ({
          name: medication.name || '',
          dosage: medication.dosage || '',
          frequency: medication.frequency || '',
          duration: medication.duration || '',
          duration_days: medication.duration_days ? (parseInt(String(medication.duration_days).match(/\d+/)?.[0]) || null) : null,
          instructions: medication.instructions || '',
          reminder_times: Array.isArray(medication.reminder_times) ? medication.reminder_times : [],
          timing_summary: medication.timing_summary || ''
        })),
        documents_analyzed: fileCount,
        summary: parsedResult.summary || 'No summary provided',
        abnormal_flags: parsedResult.lab_results?.filter(test => test.status === 'H' || test.status === 'L').length || 0,
      };
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      return {
        type: documentText.toLowerCase().includes('blood') ? 'lab_report' : 'prescription',
        date: 'Parse error',
        doctor: 'Parse error',
        lab_results: [],
        medications: [],
        documents_analyzed: fileCount,
        summary: 'Error parsing results',
        raw_text: documentText.substring(0, 500),
        error: true
      };
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error('Failed to analyze documents with AI');
  }
}

async function analyzeHealthReportWithGemini(documentText, fileName) {
  try {
    const prompt = {
      contents: [{
        parts: [{
          text: `You are a senior clinical report analyst. Analyze the uploaded medical report and return a detailed, patient-friendly summary with the exact JSON shape below.

Requirements:
1. Use only the information found in the report. Do not invent values.
2. Explain abnormal, borderline, or noteworthy findings in plain language.
3. Preserve the original test names, values, and reference ranges when present.
4. If a date is visible, use it. If not, set the date to "Not specified".
5. If the report does not include a reference range, set "range" to "Not specified".
6. If the report does not include enough information to determine a status, use "Unknown".
7. Recommendations should be specific, practical, and medically cautious.
8. Add a short disclaimer that this is not a diagnosis and that a clinician should interpret the results.

Report file name:
${fileName}

Report text:
${documentText}

Return JSON only in this exact structure:
{
  "reportType": "CBC" or "Liver Function Test" or "General Medical Report",
  "date": "YYYY-MM-DD or Not specified",
  "summary": "2-4 sentence plain-language overview of the report",
  "parameters": [
    {
      "name": "test name",
      "value": "result value",
      "range": "reference range or Not specified",
      "status": "Normal" or "Abnormal" or "Borderline" or "High" or "Low" or "Unknown",
      "interpretation": "concise explanation of what this result means"
    }
  ],
  "recommendations": ["actionable recommendation 1", "actionable recommendation 2"],
  "disclaimer": "brief medical disclaimer"
}`
        }]
      }]
    };

    const result = await generateContentWithRetry(prompt, { retries: 2, baseDelayMs: 1500 });
    const responseText = result.response.text();

    try {
      let jsonStr = responseText;
      const mdMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (mdMatch) {
        jsonStr = mdMatch[1];
      } else {
        const start = responseText.indexOf('{');
        const end = responseText.lastIndexOf('}');
        if (start !== -1 && end !== -1) jsonStr = responseText.substring(start, end + 1);
      }
      const parsedResult = JSON.parse(jsonStr.trim());

      const reportType = parsedResult.reportType || 'General Medical Report';
      const parameters = Array.isArray(parsedResult.parameters) ? parsedResult.parameters : [];
      const recommendations = Array.isArray(parsedResult.recommendations) ? parsedResult.recommendations : [];

      return {
        reportType,
        date: parsedResult.date || 'Not specified',
        summary: parsedResult.summary || 'No summary provided',
        parameters: parameters.map((parameter) => ({
          name: parameter.name || 'Unknown Parameter',
          value: parameter.value || 'Not specified',
          range: parameter.range || 'Not specified',
          status: parameter.status || 'Unknown',
          interpretation: parameter.interpretation || 'No interpretation provided'
        })),
        recommendations: recommendations.length > 0 ? recommendations : [
          'Discuss these results with your healthcare provider for personalized guidance.'
        ],
        disclaimer: parsedResult.disclaimer || 'This analysis is informational only and does not replace professional medical advice.'
      };
    } catch (parseError) {
      console.error('Error parsing health report Gemini response:', parseError);
      return {
        reportType: 'General Medical Report',
        date: 'Parse error',
        summary: 'The analysis was generated, but the response could not be parsed into structured data.',
        parameters: [],
        recommendations: [
          'Review the original report with a healthcare provider.',
          'Try uploading a clearer PDF or image if the report contains faint or unreadable text.'
        ],
        disclaimer: 'This analysis is informational only and should be reviewed by a clinician.'
      };
    }
  } catch (error) {
    console.error('Gemini API error while analyzing health report:', error);
    throw new Error('Failed to analyze health report with AI');
  }
}

// ---------------------------------------------------------------------------
// Symptom question cache  (in-memory, TTL = 1 hour, max 100 entries)
// ---------------------------------------------------------------------------
const SYMPTOM_CACHE = new Map(); // key → { questions, summary, concern_level, ts }
const SYMPTOM_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const SYMPTOM_CACHE_MAX = 100;

function symptomCacheKey(symptoms) {
  return symptoms.toLowerCase().replace(/\s+/g, ' ').trim();
}

function getCachedSymptomQuestions(key) {
  const entry = SYMPTOM_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > SYMPTOM_CACHE_TTL_MS) {
    SYMPTOM_CACHE.delete(key);
    return null;
  }
  return entry;
}

function setCachedSymptomQuestions(key, value) {
  if (SYMPTOM_CACHE.size >= SYMPTOM_CACHE_MAX) {
    // Evict the oldest entry
    const oldest = SYMPTOM_CACHE.keys().next().value;
    SYMPTOM_CACHE.delete(oldest);
  }
  SYMPTOM_CACHE.set(key, { ...value, ts: Date.now() });
}

// ---------------------------------------------------------------------------
// Keyword → instant questions map  (covers the most common presentations)
// ---------------------------------------------------------------------------
const KEYWORD_QUESTION_MAP = [
  {
    keywords: ['fever', 'temperature', 'chills', 'sweating', 'hot'],
    concern_level: 'medium',
    summary: 'You are experiencing fever-related symptoms.',
    questions: [
      'What is your current temperature, if measured?',
      'How long have you had the fever?',
      'Do you have chills, sweating, or body aches along with the fever?',
      'Have you taken any fever-reducing medication? If so, did it help?',
      'Do you have any other symptoms such as cough, sore throat, or rash?'
    ]
  },
  {
    keywords: ['headache', 'migraine', 'head pain', 'head ache', 'throbbing head'],
    concern_level: 'medium',
    summary: 'You are experiencing head pain or headache.',
    questions: [
      'Where exactly is the pain located — front, back, one side, or all over?',
      'How would you rate the pain from 1 to 10?',
      'How long have you had this headache?',
      'Does light, sound, or movement make it worse?',
      'Have you had any nausea, vomiting, or visual disturbances along with it?'
    ]
  },
  {
    keywords: ['cough', 'cold', 'sore throat', 'runny nose', 'congestion', 'flu', 'sneezing'],
    concern_level: 'low',
    summary: 'You are experiencing cold, cough, or upper respiratory symptoms.',
    questions: [
      'Is the cough dry or are you producing mucus? If mucus, what color is it?',
      'How long have you had these symptoms?',
      'Do you have a sore throat, runny nose, or nasal congestion?',
      'Do you have any difficulty breathing or shortness of breath?',
      'Have you been in contact with anyone who was recently sick?'
    ]
  },
  {
    keywords: ['chest pain', 'chest tightness', 'heart', 'palpitation', 'shortness of breath', 'breathing difficulty'],
    concern_level: 'high',
    summary: 'You are experiencing chest or breathing-related symptoms — please seek urgent care if severe.',
    questions: [
      'Is the chest pain sharp, pressure-like, or squeezing?',
      'Does the pain spread to your arm, jaw, or back?',
      'Are you experiencing shortness of breath even at rest?',
      'Do you feel your heart racing or skipping beats?',
      'Have these symptoms come on suddenly or gradually?'
    ]
  },
  {
    keywords: ['stomach', 'abdomen', 'nausea', 'vomiting', 'diarrhea', 'stomach ache', 'abdominal pain', 'stomach pain'],
    concern_level: 'medium',
    summary: 'You are experiencing gastrointestinal or stomach-related symptoms.',
    questions: [
      'Where exactly is the pain — upper, lower, left, or right side?',
      'Have you had nausea, vomiting, or diarrhea along with the pain?',
      'When did the pain start, and is it constant or comes and goes?',
      'Have you eaten anything unusual recently, or been in contact with someone with food poisoning?',
      'Do you notice the pain gets worse after eating?'
    ]
  },
  {
    keywords: ['dizziness', 'dizzy', 'vertigo', 'lightheaded', 'faint', 'fainting', 'balance'],
    concern_level: 'medium',
    summary: 'You are experiencing dizziness or balance-related symptoms.',
    questions: [
      'Does the dizziness feel like the room is spinning (vertigo) or like you might faint?',
      'How long do the dizzy episodes last?',
      'Does it happen when you stand up quickly or constantly throughout the day?',
      'Do you have any nausea, ringing in the ears, or hearing changes?',
      'Have you had any recent head injury or changes in medication?'
    ]
  },
  {
    keywords: ['back pain', 'spine', 'lower back', 'backache', 'back ache'],
    concern_level: 'low',
    summary: 'You are experiencing back pain.',
    questions: [
      'Is the pain in the upper, middle, or lower back?',
      'Does the pain radiate down your leg or to another area?',
      'Did the pain start after an injury, heavy lifting, or came on its own?',
      'Is the pain constant or does it come and go with movement?',
      'Do you have any numbness, tingling, or weakness in your legs?'
    ]
  },
  {
    keywords: ['joint pain', 'knee pain', 'hip pain', 'arthritis', 'swollen joint', 'joint swelling', 'muscle pain'],
    concern_level: 'low',
    summary: 'You are experiencing joint or muscle pain.',
    questions: [
      'Which joint or muscle is affected?',
      'Is there any visible swelling, redness, or warmth around the area?',
      'Did the pain start after an injury or activity, or come on gradually?',
      'How long have you had this pain?',
      'Does the pain limit your ability to move the joint normally?'
    ]
  },
  {
    keywords: ['rash', 'itching', 'hives', 'skin', 'allergy', 'allergic', 'swelling face', 'swollen face'],
    concern_level: 'medium',
    summary: 'You are experiencing skin or allergic symptoms.',
    questions: [
      'Where on the body is the rash or itching located?',
      'When did it start, and has it spread since then?',
      'Did you recently try a new food, medication, detergent, or cosmetic?',
      'Do you have any swelling of the lips, tongue, or throat along with it?',
      'Is the skin red, raised, blistered, or just itchy?'
    ]
  },
  {
    keywords: ['eye', 'vision', 'blurry', 'red eye', 'eye pain', 'eye discharge', 'itchy eye'],
    concern_level: 'medium',
    summary: 'You are experiencing eye or vision-related symptoms.',
    questions: [
      'Is one eye or both eyes affected?',
      'Do you have pain, redness, discharge, or blurred vision?',
      'Did the symptoms start suddenly or gradually?',
      'Have you had any recent eye injury or contact with someone with pink eye?',
      'Are you wearing contact lenses?'
    ]
  },
  {
    keywords: ['urination', 'urine', 'uti', 'burning urination', 'frequent urination', 'painful urination'],
    concern_level: 'medium',
    summary: 'You are experiencing urinary-related symptoms.',
    questions: [
      'Do you feel a burning or pain when urinating?',
      'Are you urinating more frequently than usual?',
      'Have you noticed any blood in your urine or unusual color/odor?',
      'Do you have any lower abdominal or back pain?',
      'Do you have any fever or chills along with these symptoms?'
    ]
  }
];

// General fallback questions shown when no keyword category matches
const GENERIC_QUESTIONS = [
  'How long have you been experiencing these symptoms?',
  'On a scale of 1–10, how severe are your symptoms right now?',
  'Have you taken any medication for this? If yes, did it help?'
];

function matchKeywordQuestions(symptoms) {
  const lower = symptoms.toLowerCase();
  for (const entry of KEYWORD_QUESTION_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return {
        stage: 'follow_up',
        summary: entry.summary,
        concern_level: entry.concern_level,
        // Return first 3 questions from pre-saved list as the instant batch
        questions: entry.questions.slice(0, 3),
        disclaimer: 'This is an AI-generated analysis and not a medical diagnosis. Please consult a qualified doctor for proper evaluation.',
        source: 'instant'
      };
    }
  }
  return null;
}

async function analyzeSymptomsWithGemini(payload) {
  try {
    const phase = payload?.phase === 'final' ? 'final' : 'initial';
    const symptoms = String(payload?.symptoms || '').trim();
    const questions = Array.isArray(payload?.questions) ? payload.questions : [];
    const answers = Array.isArray(payload?.answers) ? payload.answers : [];

    const promptText = phase === 'initial'
      ? `You are a cautious medical triage assistant. Ask concise follow-up questions based on the symptoms, without diagnosing.

User symptoms:
${symptoms}

Return JSON only in this exact structure:
{
  "stage": "follow_up",
  "summary": "1 short sentence summarizing the concern",
  "concern_level": "low" or "medium" or "high",
  "questions": ["question 1", "question 2", "question 3", "question 4"]
}

Rules:
- Ask 3 to 5 relevant questions.
- Keep questions short and practical.
- Do not mention diagnosis or certainty.
- Include a brief urgent-care caution if symptoms sound severe.`
      : `You are a cautious medical triage assistant. Use the full symptom description and answers to suggest possible conditions, precautions, and red flags. Do not provide a diagnosis.

User symptoms:
${symptoms}

Follow-up questions:
${questions.map((question, index) => `${index + 1}. ${question}`).join('\n')}

User answers:
${answers.map((answer, index) => `${index + 1}. ${answer || 'Not answered'}`).join('\n')}

Return JSON only in this exact structure:
{
  "stage": "analysis",
  "possible_conditions": [
    {
      "name": "possible condition",
      "likelihood": "Low" or "Medium" or "High",
      "reasoning": "brief reasoning"
    }
  ],
  "precautions": ["step 1", "step 2", "step 3"],
  "urgent_warning_signs": ["warning sign 1", "warning sign 2"],
  "summary": "brief cautious summary",
  "disclaimer": "This is an AI-generated analysis and not a medical diagnosis. Please consult a qualified doctor for proper evaluation."
}

Rules:
- List 1 to 3 possible conditions, ordered from most to least likely.
- Keep the tone cautious and non-diagnostic.
- Include practical home care precautions.
- Include urgent warning signs that warrant prompt medical attention.`;

    const aiPromise = generateContentWithRetry({
      contents: [{
        parts: [{ text: promptText }]
      }]
    }, { retries: 2, baseDelayMs: 1500 });

    const timeoutPromise = sleep(60000).then(() => {
      throw new Error('AI request timed out');
    });

    const result = await Promise.race([aiPromise, timeoutPromise]);

    const responseText = result.response.text();
    let jsonStr = responseText;
    const mdMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (mdMatch) {
      jsonStr = mdMatch[1];
    } else {
      const start = responseText.indexOf('{');
      const end = responseText.lastIndexOf('}');
      if (start !== -1 && end !== -1) jsonStr = responseText.substring(start, end + 1);
    }
    const parsed = JSON.parse(jsonStr.trim());

    if (phase === 'initial') {
      return {
        stage: 'follow_up',
        summary: parsed.summary || 'Follow-up questions are needed to narrow down the symptoms.',
        concern_level: parsed.concern_level || 'medium',
        questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 5) : [],
        disclaimer: 'This is an AI-generated analysis and not a medical diagnosis. Please consult a qualified doctor for proper evaluation.'
      };
    }

    return {
      stage: 'analysis',
      possible_conditions: Array.isArray(parsed.possible_conditions) ? parsed.possible_conditions.slice(0, 3) : [],
      precautions: Array.isArray(parsed.precautions) ? parsed.precautions : [],
      urgent_warning_signs: Array.isArray(parsed.urgent_warning_signs) ? parsed.urgent_warning_signs : [],
      summary: parsed.summary || 'This is a preliminary AI assessment based on the provided symptoms.',
      disclaimer: parsed.disclaimer || 'This is an AI-generated analysis and not a medical diagnosis. Please consult a qualified doctor for proper evaluation.'
    };
  } catch (error) {
    console.error('Symptom checker Gemini error:', error);
    return buildSymptomFallback(payload);
  }
}

// Update prescription analysis endpoint
app.post('/api/analyze/prescription', upload.array('prescription', 8), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No files uploaded' 
      });
    }

    if (req.files.length > 8) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 8 files allowed'
      });
    }

    console.log(`Processing ${req.files.length} files...`);
    let extractedTexts = [];
    const filePaths = [];

    try {
      // Process each file
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        filePaths.push(file.path);
        console.log(`Processing file ${i + 1}/${req.files.length}: ${file.originalname}`);
        
        try {
          let text;
          if (file.mimetype === 'application/pdf') {
            text = await extractTextFromPDF(file.path);
          } else if (file.mimetype.startsWith('image/')) {
            text = await extractTextFromImage(file.path);
          }
          
          if (text && text.trim()) {
            extractedTexts.push(`Document ${i + 1} (${file.mimetype.includes('pdf') ? 'PDF' : 'Image'}): ${text}`);
          } else {
            console.warn(`No text extracted from file ${i + 1}: ${file.originalname}`);
          }
        } catch (processingError) {
          console.error(`Error processing file ${i + 1}:`, processingError);
          // Continue with other files even if one fails
          continue;
        }
      }

      if (extractedTexts.length === 0) {
        throw new Error('Could not extract text from any of the uploaded files');
      }

      // Combine all extracted text with clear document separation
      const combinedText = extractedTexts.join('\n\n=== Next Document ===\n\n');

      if (!combinedText.trim()) {
        throw new Error('No text could be extracted from the uploaded files');
      }

      // Analyze combined text with Gemini
      const analysisResult = await analyzePrescriptionWithGemini(combinedText, req.files.length);

      // If a userId was provided with the upload, record an analysis event
      try {
        const userIdFromBody = req.body?.userId;
        const userIdForEvent = userIdFromBody || getUserIdFromReq(req);
        if (userIdForEvent) {
          const created = await AnalysisEvent.create({
            userId: userIdForEvent,
            type: 'prescription',
            metadata: {
              fileCount: req.files.length,
              fileNames: req.files.map(f => f.originalname)
            }
          });
          try {
            if (io) {
              const room = `user_${String(userIdForEvent)}`;
              io.to(room).emit('analysis_event', { userId: String(userIdForEvent), type: 'prescription', metadata: created.metadata, createdAt: created.createdAt });
            }
          } catch (emitErr) {
            console.warn('Failed to emit analysis_event from prescription endpoint:', emitErr && emitErr.message);
          }
        }
      } catch (aeErr) {
        console.error('Failed to record analysis event:', aeErr);
      }

      return res.status(200).json({
        success: true,
        analysis: {
          ...analysisResult,
          number_of_files_processed: req.files.length,
          // Only include original text in development environment
          ...(process.env.NODE_ENV === 'development' && { original_text: combinedText.substring(0, 1000) })
        }
      });

    } catch (error) {
      throw error;
    } finally {
      // Clean up all uploaded files
      for (const path of filePaths) {
        if (fs.existsSync(path)) {
          try {
            fs.unlinkSync(path);
          } catch (err) {
            console.error('Error cleaning up file:', err);
          }
        }
      }
    }
  } catch (error) {
    console.error('Document analysis error:', error);
    return res.status(500).json({
    success: false,
    message: error.message || 'Error analyzing documents',
    error: error.toString()
  });
}
});

console.log('Registering symptom checker route');
app.post('/api/analyze/symptoms', async (req, res) => {
  try {
    const phase = req.body?.phase === 'final' ? 'final' : 'initial';
    const symptoms = String(req.body?.symptoms || '').trim();

    if (!symptoms) {
      return res.status(400).json({ success: false, message: 'Please enter the symptoms first.' });
    }

    if (phase === 'final') {
      const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
      const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
      if (questions.length === 0) {
        return res.status(400).json({ success: false, message: 'Follow-up questions are required before the final analysis.' });
      }

      const analysis = await analyzeSymptomsWithGemini({ phase, symptoms, questions, answers });

      try {
        const userIdFromBody = req.body?.userId;
        const userIdForEvent = userIdFromBody || getUserIdFromReq(req);
        if (userIdForEvent) {
          const created = await AnalysisEvent.create({
            userId: userIdForEvent,
            type: 'symptom_checker',
            metadata: {
              phase: 'final',
              symptomCount: symptoms.split(',').map((item) => item.trim()).filter(Boolean).length,
              questionCount: questions.length
            }
          });

          try {
            if (io) {
              const room = `user_${String(userIdForEvent)}`;
              io.to(room).emit('analysis_event', {
                userId: String(userIdForEvent),
                type: 'symptom_checker',
                metadata: created.metadata,
                createdAt: created.createdAt
              });
            }
          } catch (emitErr) {
            console.warn('Failed to emit analysis_event from symptom checker endpoint:', emitErr && emitErr.message);
          }
        }
      } catch (eventError) {
        console.warn('Failed to record symptom checker event:', eventError && eventError.message);
      }

      return res.status(200).json({ success: true, analysis });
    }

    // ── INITIAL PHASE — pre-saved questions only (zero Gemini calls) ─────────
    const instantMatch = matchKeywordQuestions(symptoms);
    if (instantMatch) {
      console.log(`[symptoms] Pre-saved match for: "${symptoms.substring(0, 60)}"`);
      return res.status(200).json({ success: true, analysis: instantMatch });
    }

    // No keyword match — return generic fallback questions
    console.log(`[symptoms] Generic fallback for: "${symptoms.substring(0, 60)}"`);
    return res.status(200).json({
      success: true,
      analysis: {
        stage: 'follow_up',
        summary: 'Please answer a few questions so we can better understand your symptoms.',
        concern_level: 'medium',
        questions: GENERIC_QUESTIONS,
        disclaimer: 'This is an AI-generated analysis and not a medical diagnosis. Please consult a qualified doctor for proper evaluation.',
        source: 'generic'
      }
    });
  } catch (error) {
    console.error('Symptom checker error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to analyze symptoms' });
  }
});

// ---------------------------------------------------------------------------
// AI Boost endpoint — generates exactly 2 personalized questions for the
// given symptoms. Checks cache first; only calls Gemini on a cache miss.
// The 2 questions are cached so future requests for the same keyword are free.
// ---------------------------------------------------------------------------
app.post('/api/analyze/symptoms/ai-boost', async (req, res) => {
  const symptoms = String(req.body?.symptoms || '').trim();
  if (!symptoms) {
    return res.status(400).json({ success: false, message: 'Symptoms are required.' });
  }

  const cacheKey = symptomCacheKey(symptoms);

  // Return cached AI questions instantly (no Gemini)
  const cached = getCachedSymptomQuestions(cacheKey);
  if (cached && Array.isArray(cached.aiQuestions) && cached.aiQuestions.length > 0) {
    console.log(`[ai-boost] Cache hit for: "${cacheKey.substring(0, 50)}"`);
    return res.status(200).json({ success: true, questions: cached.aiQuestions, source: 'cached' });
  }

  // Cache miss — call Gemini for exactly 2 personalised questions
  try {
    console.log(`[ai-boost] Gemini call for: "${symptoms.substring(0, 60)}"`);
    const promptText = `You are a medical triage assistant. Generate exactly 2 specific, concise follow-up questions for a patient who says: "${symptoms}".
Return JSON only: { "questions": ["question 1", "question 2"] }
Rules:
- Make questions highly specific to the exact symptom described.
- Do NOT ask generic questions like "how long" or "how severe" — those are already shown.
- Keep each question under 15 words.
- Do not diagnose or mention disease names.`;

    const result = await generateContentWithRetry({
      contents: [{ parts: [{ text: promptText }] }]
    }, { retries: 1, baseDelayMs: 1000 });

    const raw = result.response.text();
    let jsonStr = raw;
    const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (mdMatch) jsonStr = mdMatch[1];
    else {
      const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
      if (s !== -1 && e !== -1) jsonStr = raw.substring(s, e + 1);
    }
    const parsed = JSON.parse(jsonStr.trim());
    const aiQuestions = Array.isArray(parsed.questions) ? parsed.questions.slice(0, 2) : [];

    if (aiQuestions.length > 0) {
      // Cache only the 2 AI questions — pre-saved questions are hardcoded, don't need caching
      setCachedSymptomQuestions(cacheKey, { aiQuestions });
      console.log(`[ai-boost] Cached 2 AI questions for: "${cacheKey.substring(0, 50)}"`);
    }

    return res.status(200).json({ success: true, questions: aiQuestions, source: 'ai' });
  } catch (err) {
    console.warn(`[ai-boost] Gemini error for "${symptoms.substring(0, 40)}":`, err && err.message);
    // Return empty gracefully — frontend will just show pre-saved questions only
    return res.status(200).json({ success: true, questions: [], source: 'error' });
  }
});

app.post('/api/analyze/report', upload.single('report'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No report file uploaded'
      });
    }

    const file = req.file;
    const lowerName = String(file.originalname || '').toLowerCase();

    if (![ 'application/pdf', 'image/jpeg', 'image/png', 'image/jpg' ].includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a PDF or image-based medical report.'
      });
    }

    let extractedText = '';

    if (file.mimetype === 'application/pdf') {
      extractedText = await extractTextFromPDF(file.path);
    } else if (file.mimetype.startsWith('image/')) {
      extractedText = await extractTextFromImage(file.path);
    }

    if (!extractedText || !extractedText.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract readable text from the uploaded report.'
      });
    }

    const analysis = await analyzeHealthReportWithGemini(extractedText, file.originalname || lowerName || 'uploaded-report');

    try {
      const userIdFromBody = req.body?.userId;
      const userIdForEvent = userIdFromBody || getUserIdFromReq(req);
      if (userIdForEvent) {
        const created = await AnalysisEvent.create({
          userId: userIdForEvent,
          type: 'report',
          metadata: {
            fileName: file.originalname,
            fileType: file.mimetype
          }
        });

        try {
          if (io) {
            const room = `user_${String(userIdForEvent)}`;
            io.to(room).emit('analysis_event', {
              userId: String(userIdForEvent),
              type: 'report',
              metadata: created.metadata,
              createdAt: created.createdAt
            });
          }
        } catch (emitErr) {
          console.warn('Failed to emit analysis_event from report endpoint:', emitErr && emitErr.message);
        }
      }
    } catch (eventError) {
      console.warn('Failed to record report analysis event:', eventError && eventError.message);
    }

    return res.status(200).json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('Error analyzing health report:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to analyze report'
    });
  }
});

app.get('/api/google/calendar/status', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authorization required' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      connected: Boolean(user.googleCalendarRefreshToken),
      email: user.googleCalendarEmail || null,
      connectedAt: user.googleCalendarConnectedAt || null
    });
  } catch (error) {
    console.error('Google Calendar status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to check Google Calendar status' });
  }
});

app.get('/api/google/calendar/auth-url', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authorization required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const authUrl = await getGoogleCalendarAuthUrlForUser(user);
    return res.status(200).json({ success: true, authUrl });
  } catch (error) {
    console.error('Google Calendar auth URL error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create Google Calendar auth URL' });
  }
});

app.get('/api/google/calendar/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).send('Missing Google authorization code or state.');
    }

    let decodedState;
    try {
      decodedState = jwt.verify(state, process.env.JWT_SECRET || 'secret');
    } catch (stateError) {
      return res.status(400).send('Invalid or expired Google connection state.');
    }

    const user = await User.findById(decodedState.userId);
    if (!user) {
      return res.status(404).send('User not found.');
    }

    const oauth2Client = getGoogleOAuthClient();
    const { tokens } = await oauth2Client.getToken({
      code: code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'https://deployment-tabcura.onrender.com/api/google/calendar/callback'
    });
    oauth2Client.setCredentials(tokens);

    let googleEmail = null;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const profileResponse = await oauth2.userinfo.get();
      googleEmail = profileResponse?.data?.email || null;
    } catch (profileError) {
      console.warn('Unable to fetch Google profile after consent:', profileError && profileError.message);
    }

    await User.findByIdAndUpdate(user._id, {
      googleCalendarRefreshToken: tokens.refresh_token || user.googleCalendarRefreshToken || null,
      googleCalendarAccessToken: tokens.access_token || null,
      googleCalendarExpiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      googleCalendarEmail: googleEmail || user.googleCalendarEmail || null,
      googleCalendarConnectedAt: new Date(),
      updatedAt: new Date()
    });

    const frontendUrl = process.env.FRONTEND_URL;
    return res.redirect(`${frontendUrl}/?googleCalendar=connected`);
  } catch (error) {
    console.error('Google Calendar callback error:', error);
    return res.status(500).send('Failed to connect Google Calendar.');
  }
});

app.post('/api/google/calendar/sync-prescription', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req) || req.body?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authorization required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.googleCalendarRefreshToken) {
      const authUrl = await getGoogleCalendarAuthUrlForUser(user);
      return res.status(200).json({
        success: false,
        requiresGoogleAuth: true,
        authUrl,
        message: 'Connect Google Calendar first.'
      });
    }

    const analysis = req.body?.analysis || {};
    const medications = Array.isArray(analysis.medications) ? analysis.medications : [];

    if (medications.length === 0) {
      return res.status(400).json({ success: false, message: 'No medications were found in the analysis.' });
    }

    const oauth2Client = getGoogleOAuthClient();
    oauth2Client.setCredentials({
      refresh_token: user.googleCalendarRefreshToken,
      access_token: user.googleCalendarAccessToken || undefined,
      expiry_date: user.googleCalendarExpiryDate ? new Date(user.googleCalendarExpiryDate).getTime() : undefined
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const createdEvents = [];
    const analysisDate = analysis.date ? new Date(analysis.date) : new Date();

    for (const medication of medications) {
      const events = buildMedicationCalendarEvents(medication, analysisDate);

      for (const event of events) {
        const created = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: event.summary,
            description: event.description,
            start: event.start,
            end: event.end,
            recurrence: event.recurrence,
            reminders: event.reminders
          }
        });

        createdEvents.push({
          id: created.data.id,
          summary: created.data.summary,
          htmlLink: created.data.htmlLink
        });
      }
    }

    return res.status(200).json({
      success: true,
      createdCount: createdEvents.length,
      events: createdEvents,
      message: 'Prescription reminders were added to Google Calendar.'
    });
  } catch (error) {
    console.error('Google Calendar sync error:', error);
    
    // Handle expired tokens or insufficient permissions
    const isInvalidGrant = error.response?.data?.error === 'invalid_grant' || (error.message && error.message.includes('invalid_grant'));
    const isInsufficientPermissions = error.code === 403 || (error.errors && error.errors.some(e => e.reason === 'insufficientPermissions'));

    if (isInvalidGrant || isInsufficientPermissions) {
      try {
        const userIdForToken = getUserIdFromReq(req) || req.body?.userId;
        const user = await User.findById(userIdForToken);
        if (user) {
          // Clear invalid/insufficient tokens
          user.googleCalendarRefreshToken = null;
          user.googleCalendarAccessToken = null;
          user.googleCalendarExpiryDate = null;
          user.googleCalendarEmail = null;
          await user.save();
          
          const authUrl = await getGoogleCalendarAuthUrlForUser(user);
          const msg = isInsufficientPermissions
            ? 'Missing Google Calendar permissions. Please reconnect and ensure you check the box to grant Calendar access.'
            : 'Your Google Calendar connection expired. Please connect again.';

          return res.status(200).json({
            success: false,
            requiresGoogleAuth: true,
            authUrl,
            message: msg
          });
        }
      } catch (clearErr) {
        console.error('Failed to clear invalid Google Calendar token:', clearErr);
      }
    }

    return res.status(500).json({ success: false, message: error.message || 'Failed to sync prescription to Google Calendar' });
  }
});


// Appointments Endpoints
app.get('/api/appointments/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || userId === 'undefined') {
      return res.status(400).json({ success: false, message: 'Valid User ID is required' });
    }
    
    const appointments = await Appointment.find({ userId }).sort({ appointmentDate: 1 });
    
    // Update status to 'Due' if date has passed and it's still 'Scheduled'
    const now = new Date();
    let updated = false;
    for (let appt of appointments) {
      if (appt.status === 'Scheduled' && new Date(appt.appointmentDate) < now) {
        appt.status = 'Due';
        await appt.save();
        updated = true;
      }
    }
    
    const finalAppointments = updated ? await Appointment.find({ userId }).sort({ appointmentDate: 1 }) : appointments;

    res.status(200).json({ success: true, appointments: finalAppointments });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const appointment = new Appointment(req.body);
    await appointment.save();
    res.status(201).json({ success: true, appointment });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/appointments/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;
    const appointment = await Appointment.findByIdAndUpdate(appointmentId, { status }, { new: true });
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    res.status(200).json({ success: true, appointment });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add error handler middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  // Ensure we send a proper JSON response for errors
  return res.status(500).json({
    message: 'An unexpected error occurred',
    error: err.message
  });
});

// Handle 404 routes with JSON response
app.use((req, res) => {
  return res.status(404).json({ 
    message: 'API endpoint not found',
    path: req.path
  });
});
