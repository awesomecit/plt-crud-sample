import crypto from 'node:crypto'

async function seed() {
  console.log('🌱 Starting seed... (requires server running on http://127.0.0.1:3042)')
  
  const baseURL = 'http://127.0.0.1:3042/api'
  
  const post = async (path, data) => {
    const res = await fetch(`${baseURL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`POST ${path} failed: ${res.status} ${text}`)
    }
    return res.json()
  }
  
  try {
    // 0. Users (for authentication and audit)
    console.log('👤 Creating users...')
    const users = []
    
    users.push(await post('/users/', {
      username: 'admin',
      email: 'admin@hospital.example',
      passwordHash: crypto.createHash('sha256').update('admin123').digest('hex'),
      role: 'ADMIN',
      active: true
    }))
    
    users.push(await post('/users/', {
      username: 'dr.rossi',
      email: 'mario.rossi@hospital.example',
      passwordHash: crypto.createHash('sha256').update('password123').digest('hex'),
      role: 'USER',
      active: true,
      practitionerId: null  // Will update after creating practitioner
    }))
    
    users.push(await post('/users/', {
      username: 'dr.bianchi',
      email: 'laura.bianchi@hospital.example',
      passwordHash: crypto.createHash('sha256').update('password123').digest('hex'),
      role: 'USER',
      active: true,
      practitionerId: null  // Will update after creating practitioner
    }))
    
    console.log(`✅ Created ${users.length} users`)
    
    // 1. Report Types (with GDPR/HIPAA retention policies)
    console.log('📋 Creating report types...')
    const reportTypes = []
    
    reportTypes.push(await post('/reportTypes/', {
      code: 'LAB_ANALYSIS',
      name: 'Laboratory Analysis',
      description: 'Blood tests, urine analysis, biochemistry panels',
      retentionYears: 10
    }))
    
    reportTypes.push(await post('/reportTypes/', {
      code: 'RADIOLOGY',
      name: 'Radiology Report',
      description: 'X-rays, CT scans, MRI, ultrasound imaging',
      retentionYears: 15
    }))
    
    reportTypes.push(await post('/reportTypes/', {
      code: 'DIAGNOSIS',
      name: 'Clinical Diagnosis',
      description: 'Medical diagnosis and treatment plans',
      retentionYears: 20
    }))
    
    reportTypes.push(await post('/reportTypes/', {
      code: 'PRESCRIPTION',
      name: 'Prescription',
      description: 'Medication prescriptions and pharmaceutical records',
      retentionYears: 5
    }))
    
    console.log(`✅ Created ${reportTypes.length} report types`)
    
    // 2. Practitioners (licensed medical staff)
    console.log('👨‍⚕️ Creating practitioners...')
    const practitioners = []
    
    practitioners.push(await post('/practitioners/', {
      firstName: 'Mario',
      lastName: 'Rossi',
      licenseNumber: 'MD-IT-001234',
      specialty: 'Internal Medicine',
      email: 'mario.rossi@hospital.example'
    }))
    
    practitioners.push(await post('/practitioners/', {
      firstName: 'Laura',
      lastName: 'Bianchi',
      licenseNumber: 'MD-IT-005678',
      specialty: 'Radiology',
      email: 'laura.bianchi@hospital.example'
    }))
    
    practitioners.push(await post('/practitioners/', {
      firstName: 'Giuseppe',
      lastName: 'Verdi',
      licenseNumber: 'MD-IT-009012',
      specialty: 'Laboratory Medicine',
      email: 'giuseppe.verdi@hospital.example'
    }))
    
    console.log(`✅ Created ${practitioners.length} practitioners`)
    
    // 3. Patients (anonymized records with hashed SSN)
    console.log('🏥 Creating patients...')
    const hashSSN = (ssn) => crypto.createHash('sha256').update(ssn).digest('hex')
    const patients = []
    
    patients.push(await post('/patients/', {
      patientCode: 'PAT-2025-00001',
      firstName: 'Mario',
      lastName: 'Rossi',
      dateOfBirth: '1985-08-01',
      ssnHash: hashSSN('RSSMRA85M01H501Z')
    }))
    
    patients.push(await post('/patients/', {
      patientCode: 'PAT-2025-00002',
      firstName: 'Laura',
      lastName: 'Bianchi',
      dateOfBirth: '1990-04-05',
      ssnHash: hashSSN('BNCLRA90D45F205X')
    }))
    
    patients.push(await post('/patients/', {
      patientCode: 'PAT-2025-00003',
      firstName: 'Giuseppe',
      lastName: 'Verdi',
      dateOfBirth: '1978-12-15',
      ssnHash: hashSSN('VRDGPP78T15L219Y')
    }))
    
    console.log(`✅ Created ${patients.length} patients`)
    
    // 4. Reports (medical documents with digital signatures)
    console.log('📄 Creating reports...')
    const reports = []
    
    // Lab analysis for patient 1
    reports.push(await post('/reports/', {
      reportNumber: 'REP-LAB-2025-0001',
      patientId: patients[0].id,
      practitionerId: practitioners[2].id,
      reportTypeId: reportTypes[0].id,
      reportDate: '2025-11-10',
      title: 'Complete Blood Count - Patient Rossi',
      content: JSON.stringify({
        test: 'Complete Blood Count',
        results: {
          hemoglobin: '14.5 g/dL',
          whiteBloodCells: '7200/μL',
          platelets: '250000/μL'
        }
      }),
      findings: 'All values within normal range',
      diagnosis: 'Normal hematological profile',
      status: 'FINAL',
      signatureHash: 'sig_lab_' + crypto.randomBytes(16).toString('hex'),
      signedAt: '2025-11-10T14:30:00Z'
    }))
    
    // Radiology for patient 2
    reports.push(await post('/reports/', {
      reportNumber: 'REP-RAD-2025-0001',
      patientId: patients[1].id,
      practitionerId: practitioners[1].id,
      reportTypeId: reportTypes[1].id,
      reportDate: '2025-11-12',
      title: 'Chest X-Ray - Patient Bianchi',
      content: JSON.stringify({
        exam: 'Chest X-Ray',
        technique: 'PA and lateral views'
      }),
      findings: 'Clear lung fields. No acute cardiopulmonary abnormality.',
      diagnosis: 'Normal chest radiograph',
      status: 'FINAL',
      signatureHash: 'sig_rad_' + crypto.randomBytes(16).toString('hex'),
      signedAt: '2025-11-12T09:15:00Z'
    }))
    
    // Diagnosis for patient 3
    reports.push(await post('/reports/', {
      reportNumber: 'REP-DIAG-2025-0001',
      patientId: patients[2].id,
      practitionerId: practitioners[0].id,
      reportTypeId: reportTypes[2].id,
      reportDate: '2025-11-15',
      title: 'Clinical Diagnosis - Patient Verdi',
      content: JSON.stringify({
        chiefComplaint: 'Persistent cough',
        treatmentPlan: 'Rest, hydration, symptomatic treatment'
      }),
      findings: 'Dry cough, no fever, lungs clear on auscultation',
      diagnosis: 'Acute bronchitis',
      status: 'FINAL',
      signatureHash: 'sig_diag_' + crypto.randomBytes(16).toString('hex'),
      signedAt: '2025-11-15T16:45:00Z'
    }))
    
    console.log(`✅ Created ${reports.length} reports`)
    
    // 5. Tags (for N-M relationship demonstration)
    console.log('🏷️  Creating tags...')
    const tags = []
    
    tags.push(await post('/tags/', {
      code: 'DIABETES',
      name: 'Diabetes Mellitus',
      category: 'DIAGNOSIS',
      description: 'Chronic metabolic disorder',
      color: '#FF5733'
    }))
    
    tags.push(await post('/tags/', {
      code: 'HYPERTENSION',
      name: 'Hypertension',
      category: 'DIAGNOSIS',
      description: 'High blood pressure',
      color: '#C70039'
    }))
    
    tags.push(await post('/tags/', {
      code: 'URGENT',
      name: 'Urgent Case',
      category: 'PRIORITY',
      description: 'Requires immediate attention',
      color: '#FF0000'
    }))
    
    tags.push(await post('/tags/', {
      code: 'FOLLOWUP',
      name: 'Follow-up Required',
      category: 'STATUS',
      description: 'Patient needs follow-up visit',
      color: '#FFC300'
    }))
    
    console.log(`✅ Created ${tags.length} tags`)
    
    // 6. Report Tags (N-M junction - tag reports)
    console.log('🔗 Tagging reports...')
    const reportTags = []
    
    // Tag report 1 (Lab) with DIABETES
    reportTags.push(await post('/reportTags/', {
      reportId: reports[0].id,
      tagId: tags[0].id,
      taggedBy: users[1].id
    }))
    
    // Tag report 2 (Radiology) with URGENT and FOLLOWUP
    reportTags.push(await post('/reportTags/', {
      reportId: reports[1].id,
      tagId: tags[2].id,
      taggedBy: users[2].id
    }))
    
    reportTags.push(await post('/reportTags/', {
      reportId: reports[1].id,
      tagId: tags[3].id,
      taggedBy: users[2].id
    }))
    
    // Tag report 3 (Diagnosis) with HYPERTENSION and FOLLOWUP
    reportTags.push(await post('/reportTags/', {
      reportId: reports[2].id,
      tagId: tags[1].id,
      taggedBy: users[1].id
    }))
    
    reportTags.push(await post('/reportTags/', {
      reportId: reports[2].id,
      tagId: tags[3].id,
      taggedBy: users[1].id
    }))
    
    console.log(`✅ Created ${reportTags.length} report-tag associations`)
    
    // 7. Report Versions (1-1 relationship demonstration)
    console.log('📝 Creating report versions...')
    const versions = []
    
    // Version 1 for each report (initial version)
    for (let i = 0; i < reports.length; i++) {
      versions.push(await post('/reportVersions/', {
        reportId: reports[i].id,
        versionNumber: 1,
        title: reports[i].title,
        content: reports[i].content,
        findings: reports[i].findings,
        diagnosis: reports[i].diagnosis,
        changedBy: users[i % users.length].id,
        changeReason: 'Initial version',
        isCurrent: true
      }))
    }
    
    // Create version 2 for report 1 (amended)
    versions.push(await post('/reportVersions/', {
      reportId: reports[0].id,
      versionNumber: 2,
      title: reports[0].title + ' (Amended)',
      content: reports[0].content + ' - Updated with additional test results.',
      findings: 'Hemoglobin levels slightly elevated on recheck',
      diagnosis: 'Normal hematological profile with minor elevation',
      changedBy: users[1].id,
      changeReason: 'Additional lab results received',
      isCurrent: false
    }))
    
    console.log(`✅ Created ${versions.length} report versions`)
    
    // 8. Attachments (1-N relationship demonstration)
    console.log('📎 Creating attachments...')
    const attachments = []
    
    // Attachment for report 1 (Lab)
    attachments.push(await post('/attachments/', {
      reportId: reports[0].id,
      filename: 'lab_results_2025_11_10.pdf',
      originalFilename: 'Complete Blood Count Results.pdf',
      mimeType: 'application/pdf',
      fileSize: 245678,
      storagePath: 's3://reports/2025/11/lab_results_2025_11_10.pdf',
      checksum: crypto.randomBytes(32).toString('hex'),
      uploadedBy: users[1].id
    }))
    
    attachments.push(await post('/attachments/', {
      reportId: reports[0].id,
      filename: 'patient_consent_form.pdf',
      originalFilename: 'Patient Consent Form - Rossi.pdf',
      mimeType: 'application/pdf',
      fileSize: 89456,
      storagePath: 's3://reports/2025/11/patient_consent_form.pdf',
      checksum: crypto.randomBytes(32).toString('hex'),
      uploadedBy: users[1].id
    }))
    
    // Attachment for report 2 (Radiology)
    attachments.push(await post('/attachments/', {
      reportId: reports[1].id,
      filename: 'chest_xray_2025_11_12.dcm',
      originalFilename: 'Chest X-Ray - PA View.dcm',
      mimeType: 'application/dicom',
      fileSize: 5678901,
      storagePath: 's3://imaging/2025/11/chest_xray_2025_11_12.dcm',
      checksum: crypto.randomBytes(32).toString('hex'),
      uploadedBy: users[2].id
    }))
    
    attachments.push(await post('/attachments/', {
      reportId: reports[1].id,
      filename: 'chest_xray_lateral_2025_11_12.dcm',
      originalFilename: 'Chest X-Ray - Lateral View.dcm',
      mimeType: 'application/dicom',
      fileSize: 5432109,
      storagePath: 's3://imaging/2025/11/chest_xray_lateral_2025_11_12.dcm',
      checksum: crypto.randomBytes(32).toString('hex'),
      uploadedBy: users[2].id
    }))
    
    // Attachment for report 3 (Diagnosis)
    attachments.push(await post('/attachments/', {
      reportId: reports[2].id,
      filename: 'prescription_2025_11_15.pdf',
      originalFilename: 'Prescription - Verdi.pdf',
      mimeType: 'application/pdf',
      fileSize: 123456,
      storagePath: 's3://reports/2025/11/prescription_2025_11_15.pdf',
      checksum: crypto.randomBytes(32).toString('hex'),
      uploadedBy: users[1].id
    }))
    
    console.log(`✅ Created ${attachments.length} attachments`)
    
    console.log('\n✅ Seed completed successfully!')
    console.log('\nSummary:')
    console.log(`  - ${users.length} users`)
    console.log(`  - ${reportTypes.length} report types`)
    console.log(`  - ${practitioners.length} practitioners`)
    console.log(`  - ${patients.length} patients`)
    console.log(`  - ${reports.length} reports`)
    console.log(`  - ${tags.length} tags`)
    console.log(`  - ${reportTags.length} report-tag associations (N-M)`)
    console.log(`  - ${versions.length} report versions (1-1)`)
    console.log(`  - ${attachments.length} attachments (1-N)`)
    console.log('\nRelationships demonstrated:')
    console.log('  - 1-1: reports → current_version')
    console.log('  - 1-N: reports → attachments (multiple files per report)')
    console.log('  - M-1: reports → report_type (many reports, one type)')
    console.log('  - N-M: reports ↔ tags (via report_tags junction)')
    
  } catch (error) {
    console.error('❌ Seed failed:', error.message)
    process.exit(1)
  }
}

seed()
