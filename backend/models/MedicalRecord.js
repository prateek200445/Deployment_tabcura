const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sourceType: {
    type: String,
    default: 'prescription',
    trim: true
  },
  doctorName: {
    type: String,
    required: true,
    trim: true
  },
  hospitalName: {
    type: String,
    required: true,
    trim: true
  },
  diseaseName: {
    type: String,
    required: true,
    trim: true
  },
  summary: {
    type: String,
    default: '',
    trim: true
  },
  medications: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  analysisData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  documentUrl: {
    type: String,
    default: '',
    trim: true
  },
  prescriptionDate: {
    type: Date,
    default: null
  }
});

const MedicalRecord = mongoose.models.MedicalRecord || mongoose.model('MedicalRecord', medicalRecordSchema);

module.exports = MedicalRecord;