-- MediAI Hospital Suite - Complete Database Schema

-- Users (base auth table for all roles)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(100) DEFAULT 'stethoscope',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patients (extends users)
CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth DATE,
  gender VARCHAR(20),
  blood_group VARCHAR(10),
  address TEXT,
  emergency_contact VARCHAR(255),
  allergies TEXT,
  health_score INTEGER DEFAULT 75,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doctors (extends users)
CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialization VARCHAR(255) NOT NULL DEFAULT 'General Medicine',
  license_number VARCHAR(100),
  department_id INTEGER REFERENCES departments(id),
  consultation_fee DECIMAL(10,2) DEFAULT 0,
  available BOOLEAN DEFAULT true,
  rating DECIMAL(3,2),
  experience_years INTEGER DEFAULT 0,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admins (extends users)
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  doctor_id INTEGER NOT NULL REFERENCES doctors(id),
  appointment_date DATE NOT NULL,
  appointment_time VARCHAR(10) NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'booked' CHECK (status IN ('booked', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(100),
  file_size INTEGER,
  report_type VARCHAR(100) DEFAULT 'general',
  notes TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Analyses (linked to reports)
CREATE TABLE IF NOT EXISTS ai_analyses (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  patient_summary TEXT,
  doctor_summary TEXT,
  key_findings JSONB DEFAULT '[]',
  abnormal_values JSONB DEFAULT '[]',
  is_critical BOOLEAN DEFAULT false,
  health_score_impact INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EMR Records
CREATE TABLE IF NOT EXISTS emr_records (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  doctor_id INTEGER NOT NULL REFERENCES doctors(id),
  appointment_id INTEGER REFERENCES appointments(id),
  diagnosis TEXT,
  treatment_plan TEXT,
  prescription TEXT,
  follow_up_date DATE,
  notes TEXT,
  vital_signs JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prescriptions / Medicine Reminders
CREATE TABLE IF NOT EXISTS prescriptions (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  doctor_id INTEGER REFERENCES doctors(id),
  emr_id INTEGER REFERENCES emr_records(id),
  medication_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),
  frequency VARCHAR(100),
  start_date DATE,
  end_date DATE,
  reminder_active BOOLEAN DEFAULT true,
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medical History
CREATE TABLE IF NOT EXISTS medical_history (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  condition VARCHAR(255),
  diagnosis TEXT,
  treatment TEXT,
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  appointment_id INTEGER REFERENCES appointments(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'cash',
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  description TEXT,
  transaction_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Revenue Analytics (pre-aggregated for performance)
CREATE TABLE IF NOT EXISTS revenue_analytics (
  id SERIAL PRIMARY KEY,
  period_type VARCHAR(20) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  total_revenue DECIMAL(12,2) DEFAULT 0,
  total_appointments INTEGER DEFAULT 0,
  total_patients INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_type, period_start, department_id)
);

-- AI Conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message TEXT NOT NULL,
  context JSONB,
  session_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice Transcripts
CREATE TABLE IF NOT EXISTS voice_transcripts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transcript TEXT NOT NULL,
  audio_duration INTEGER,
  processed BOOLEAN DEFAULT false,
  emr_id INTEGER REFERENCES emr_records(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id INTEGER,
  ip_address VARCHAR(45),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_reports_patient ON reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_emr_patient ON emr_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_emr_doctor ON emr_records(doctor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_ai_conv_user ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
