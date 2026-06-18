require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, pool } = require('../db');

async function runSchema() {
  const fs = require('fs');
  const schema = fs.readFileSync(require('path').join(__dirname, 'schema.sql'), 'utf8');
  try {
    await query(schema);
    console.log('✅ Schema applied');
  } catch (err) {
    console.error('Schema error (may already exist):', err.message.substring(0, 100));
  }
}

async function seed() {
  await runSchema();

  // Seed departments
  const departments = [
    { name: 'Cardiology', description: 'Heart and cardiovascular care', icon: 'heart' },
    { name: 'Neurology', description: 'Brain and nervous system', icon: 'brain' },
    { name: 'Orthopedics', description: 'Bones, joints, and muscles', icon: 'bone' },
    { name: 'Dermatology', description: 'Skin care and treatment', icon: 'sparkles' },
    { name: 'Pediatrics', description: 'Children healthcare', icon: 'baby' },
    { name: 'General Medicine', description: 'Primary care and general health', icon: 'stethoscope' },
    { name: 'Radiology', description: 'Imaging and diagnostics', icon: 'scan' },
    { name: 'Emergency', description: '24/7 emergency care', icon: 'alert-triangle' },
  ];
  for (const dept of departments) {
    await query(
      `INSERT INTO departments (name, description, icon) VALUES ($1,$2,$3) ON CONFLICT (name) DO NOTHING`,
      [dept.name, dept.description, dept.icon]
    );
  }
  console.log('✅ Departments seeded');

  // Seed admin user
  const adminHash = await bcrypt.hash('admin123', 12);
  const adminUser = await query(
    `INSERT INTO users (name, email, password_hash, role, phone)
     VALUES ('Admin User', 'admin@mediai.com', $1, 'admin', '+1-555-0001')
     ON CONFLICT (email) DO UPDATE SET password_hash=$1 RETURNING id`,
    [adminHash]
  );
  const adminId = adminUser.rows[0].id;
  await query(`INSERT INTO admins (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [adminId]);
  console.log('✅ Admin seeded: admin@mediai.com / admin123');

  // Seed demo doctor
  const deptResult = await query(`SELECT id FROM departments WHERE name='Cardiology'`);
  const cardDeptId = deptResult.rows[0]?.id;
  const doctorHash = await bcrypt.hash('doctor123', 12);
  const doctorUser = await query(
    `INSERT INTO users (name, email, password_hash, role, phone)
     VALUES ('Dr. Sarah Johnson', 'doctor@mediai.com', $1, 'doctor', '+1-555-0002')
     ON CONFLICT (email) DO UPDATE SET password_hash=$1 RETURNING id`,
    [doctorHash]
  );
  const doctorUserId = doctorUser.rows[0].id;
  const doctorProfile = await query(
    `INSERT INTO doctors (user_id, specialization, license_number, department_id, consultation_fee, rating, experience_years)
     VALUES ($1, 'Cardiology', 'LIC-2024-001', $2, 150.00, 4.8, 12)
     ON CONFLICT (user_id) DO UPDATE SET
       specialization=EXCLUDED.specialization,
       license_number=EXCLUDED.license_number
     RETURNING id`,
    [doctorUserId, cardDeptId]
  );
  console.log('✅ Doctor seeded: doctor@mediai.com / doctor123');

  // Seed demo doctor 2
  const neuroResult = await query(`SELECT id FROM departments WHERE name='Neurology'`);
  const neuroDeptId = neuroResult.rows[0]?.id;
  const doctor2Hash = await bcrypt.hash('doctor123', 12);
  const doctor2User = await query(
    `INSERT INTO users (name, email, password_hash, role, phone)
     VALUES ('Dr. Michael Chen', 'drchen@mediai.com', $1, 'doctor', '+1-555-0003')
     ON CONFLICT (email) DO UPDATE SET password_hash=$1 RETURNING id`,
    [doctor2Hash]
  );
  const doctor2UserId = doctor2User.rows[0].id;
  await query(
    `INSERT INTO doctors (user_id, specialization, license_number, department_id, consultation_fee, rating, experience_years)
     VALUES ($1, 'Neurology', 'LIC-2024-002', $2, 200.00, 4.9, 15)
     ON CONFLICT (user_id) DO UPDATE SET
       specialization=EXCLUDED.specialization,
       license_number=EXCLUDED.license_number`,
    [doctor2UserId, neuroDeptId]
  );
  console.log('✅ Doctor 2 seeded: drchen@mediai.com / doctor123');

  // Seed demo patient
  const patientHash = await bcrypt.hash('patient123', 12);
  const patientUser = await query(
    `INSERT INTO users (name, email, password_hash, role, phone)
     VALUES ('John Doe', 'patient@mediai.com', $1, 'patient', '+1-555-0100')
     ON CONFLICT (email) DO UPDATE SET password_hash=$1 RETURNING id`,
    [patientHash]
  );
  const patientUserId = patientUser.rows[0].id;
  const patientProfile = await query(
    `INSERT INTO patients (user_id, date_of_birth, gender, blood_group, address, health_score)
     VALUES ($1, '1985-06-15', 'Male', 'O+', '123 Main St, Springfield', 82)
     ON CONFLICT (user_id) DO UPDATE SET health_score=EXCLUDED.health_score
     RETURNING id`,
    [patientUserId]
  );
  console.log('✅ Patient seeded: patient@mediai.com / patient123');

  // Seed sample appointments if patient and doctor created
  const patId = patientProfile.rows[0]?.id;
  const docId = doctorProfile?.rows[0]?.id;
  if (patId && docId) {
    await query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status)
       VALUES ($1, $2, CURRENT_DATE + 2, '10:00', 'Routine cardiac checkup', 'booked'),
              ($1, $2, CURRENT_DATE + 7, '14:30', 'Follow-up consultation', 'booked'),
              ($1, $2, CURRENT_DATE - 14, '09:00', 'Initial consultation', 'completed'),
              ($1, $2, CURRENT_DATE - 30, '11:00', 'ECG reading', 'completed')
       ON CONFLICT DO NOTHING`,
      [patId, docId]
    );

    // Seed payment for completed appointments
    await query(
      `INSERT INTO payments (patient_id, amount, payment_method, status, description)
       VALUES ($1, 150.00, 'card', 'completed', 'Consultation fee - Dr. Johnson'),
              ($1, 150.00, 'cash', 'completed', 'ECG analysis fee')
       ON CONFLICT DO NOTHING`,
      [patId]
    );

    // Seed medical history
    await query(
      `INSERT INTO medical_history (patient_id, condition, diagnosis, treatment, date)
       VALUES ($1, 'Hypertension', 'Stage 1 Hypertension', 'Lisinopril 10mg daily', '2023-01-15'),
              ($1, 'Elevated Cholesterol', 'Hyperlipidemia', 'Atorvastatin 20mg nightly', '2023-06-20')
       ON CONFLICT DO NOTHING`,
      [patId]
    );

    // Seed notifications
    await query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Welcome to MediAI', 'Your account has been set up. Book your first appointment!', 'info'),
              ($1, 'Upcoming Appointment', 'You have an appointment in 2 days with Dr. Sarah Johnson', 'appointment')`,
      [patientUserId]
    );

    console.log('✅ Sample appointments, payments, history, and notifications seeded');
  }

  console.log('\n🎉 Database seeded successfully!');
  console.log('\nDemo accounts:');
  console.log('  Admin:   admin@mediai.com   / admin123');
  console.log('  Doctor:  doctor@mediai.com  / doctor123');
  console.log('  Doctor2: drchen@mediai.com  / doctor123');
  console.log('  Patient: patient@mediai.com / patient123');

  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
