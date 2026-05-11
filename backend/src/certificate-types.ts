/**
 * Organization vertical ("category") drives which certificate *labels* are offered at issuance.
 * Values are stored on `organizations.organization_category` and validated server-side.
 */

export const ORGANIZATION_CATEGORIES = [
  "education",
  "healthcare",
  "corporate",
  "government",
  "nonprofit",
  "other"
] as const;

export type OrganizationCategory = (typeof ORGANIZATION_CATEGORIES)[number];

export const CERTIFICATE_TYPES_BY_CATEGORY: Record<OrganizationCategory, readonly string[]> = {
  education: [
    "Secondary School Certificate (Class 10)",
    "Class 10 Marks Sheet (DMC / Marksheet)",
    "Higher Secondary Certificate (Class 12)",
    "Class 12 Marks Sheet (DMC / Marksheet)",
    "Transfer Certificate (TC)",
    "Migration Certificate",
    "Bonafide / Study Certificate",
    "Character Certificate",
    "Provisional Degree Certificate",
    "Undergraduate Degree Certificate",
    "Postgraduate Degree Certificate",
    "Diploma Certificate",
    "Postgraduate Diploma Certificate",
    "Ph.D. Degree / Award Certificate",
    "Course / Program Completion Certificate",
    "Merit / Distinction Certificate",
    "Scholarship Award Certificate",
    "Sports / Cultural Achievement Certificate",
    "Internship / Training Completion Certificate",
    "Equivalence / Recognition Certificate"
  ],
  healthcare: [
    "Birth Certificate (Civil / Hospital issued)",
    "Death Certificate",
    "Medical Fitness Certificate",
    "Medical Leave / Sick Leave Certificate",
    "Disability Certificate",
    "Vaccination / Immunization Certificate",
    "COVID-19 Vaccination Certificate",
    "Blood Group Certificate",
    "Diagnostic / Laboratory Summary Certificate",
    "Discharge Summary (Certificate format)",
    "Organ Donor Registration Card",
    "Medical Registration / Good Standing Certificate",
    "Hospital Affiliation / Empanelment Certificate",
    "BLS / ACLS / Clinical Skills Training Certificate",
    "Infection Control / HIPAA Awareness Certificate",
    "Clinical Rotation / Residency Completion Certificate",
    "Medical Camp / Outreach Participation Certificate"
  ],
  corporate: [
    "Employment / Experience Certificate",
    "Service Certificate",
    "Relieving / Separation Letter",
    "Internship Certificate",
    "Probation Completion Certificate",
    "Promotion / Role Change Certificate",
    "Salary / Compensation Certificate",
    "Full & Final Settlement Acknowledgment",
    "NDA / Confidentiality Acknowledgment Certificate",
    "Code of Conduct / Ethics Training Certificate",
    "Information Security Awareness Certificate",
    "Leadership / Management Program Certificate",
    "Sales / Revenue Achievement Certificate",
    "Vendor / Partner Recognition Certificate",
    "ISO / Internal Audit Participation Certificate",
    "Professional Certification Sponsorship Letter",
    "Long Service / Tenure Award Certificate"
  ],
  government: [
    "Gazette / Official Notification Extract (Certified)",
    "Good Conduct / Police Clearance Certificate",
    "Domicile / Residence Certificate",
    "Income / EWS Certificate",
    "Caste / Community Certificate (Official)",
    "Nativity Certificate",
    "Solvency / Net Worth Certificate",
    "Tax / Compliance Clearance Certificate",
    "Tender / Bid Participation Certificate",
    "Vendor Empanelment / Registration Certificate",
    "RTI / Public Disclosure Acknowledgment",
    "Training / Capacity Building (Government Program) Certificate",
    "Contract / Work Order Completion Certificate"
  ],
  nonprofit: [
    "Volunteer Service Certificate",
    "Donation Acknowledgment Certificate",
    "Program / Workshop Participation Certificate",
    "Board / Committee Appointment Certificate",
    "Grant Utilization / Impact Certificate",
    "Fellowship / Scholarship Certificate",
    "Community Outreach Participation Certificate",
    "Fundraising Event Recognition Certificate"
  ],
  other: [
    "General Attestation / Verification Certificate",
    "Membership Certificate",
    "Attendance / Participation Certificate",
    "Custom Organizational Certificate"
  ]
};

export function getCertificateTypesForCategory(category: string): string[] {
  const key = (ORGANIZATION_CATEGORIES as readonly string[]).includes(category)
    ? (category as OrganizationCategory)
    : "other";
  return [...CERTIFICATE_TYPES_BY_CATEGORY[key]];
}

export function isCertificateTypeAllowedForOrg(category: string | undefined, certType: string): boolean {
  const normalized = (ORGANIZATION_CATEGORIES as readonly string[]).includes(category ?? "")
    ? (category as OrganizationCategory)
    : "other";
  const allowed = CERTIFICATE_TYPES_BY_CATEGORY[normalized];
  return allowed.includes(certType);
}
