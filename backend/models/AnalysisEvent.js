const mongoose = require('mongoose');

const analysisEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['prescription', 'report', 'symptom_checker', 'other'],
    default: 'prescription'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const AnalysisEvent = mongoose.models.AnalysisEvent || mongoose.model('AnalysisEvent', analysisEventSchema);
module.exports = AnalysisEvent;
