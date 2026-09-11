
// Shared entity boundary types for the Sinsinnati Key Connection app.
//
// These mirror the JSON entity records returned by the application API. Because every
// stored record also carries built-in fields (id, created_date,
// updated_date, created_by_id), each interface extends EntityRecordBase so
// consumers (AiAssistant, IntakeForm, Portal, Admin) share one source of
// truth for the shapes passed between UI and the database.

export interface EntityRecordBase {
  id: string;
  created_date?: string;
  updated_date?: string;
  created_by_id?: string;
}

// Shape returned by the API's auth/me endpoint.
export interface AppUser {
  id: string;
  email: string;
  full_name?: string;
  role?: "admin" | "user" | (string & {});
}

export type ProblemCategory =
  | "Lost Keys / Security & Lockout"
  | "Electrical & Diagnostics"
  | "Mechanical Repair"
  | "Performance & Tuning";

export type BookingUrgency =
  | "Emergency / Mobile Service"
  | "Shop Drop-off / Standard Appointment"
  | "Mail-In Service";

export type BookingStatus = "received" | "reviewing" | "scheduled" | "completed";

export type BookingStage =
  | "booked"
  | "diagnosing"
  | "in_progress"
  | "quality_check"
  | "ready_for_pickup"
  | "complete";

export interface ServiceBooking extends EntityRecordBase {
  year: string;
  make: string;
  model: string;
  engine_size?: string;
  vin: string;
  problem_category: ProblemCategory;
  problem_detail?: string;
  problem_location?: string;
  photo_urls?: string[];
  urgency: BookingUrgency;
  scheduled_date?: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status: BookingStatus;
  progress_stage?: BookingStage;
  technician_name?: string;
  technician_notes?: string[];
  progress_photos?: string[];
  price_estimate_low?: number;
  price_estimate_high?: number;
  reference_code?: string;
}

export type MailInItemType =
  | "Instrument Cluster"
  | "ECU / Module"
  | "Keys / Fobs"
  | "Engine / Long Block"
  | "Transmission"
  | "Wheels / Tires"
  | "Full Vehicle / Pickup"
  | "Other";

export type MailInStatus =
  | "requested"
  | "label_ready"
  | "shipped"
  | "received"
  | "in_progress"
  | "shipped_back"
  | "completed";

export interface MailInRequest extends EntityRecordBase {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  item_type: MailInItemType;
  vehicle: string;
  problem: string;
  status: MailInStatus;
  tracking_number?: string;
  label_pdf_url?: string;
}

export type InvoiceStatus = "unpaid" | "paid";

export interface Invoice extends EntityRecordBase {
  invoice_code: string;
  owner_email: string;
  owner_email_lower?: string;
  description: string;
  amount: number;
  status: InvoiceStatus;
  due_date?: string;
  checkout_session_id?: string;
}

export type CertificateServiceType =
  | "ECU Clone"
  | "Cluster Calibration"
  | "Engine Swap"
  | "Key Programming"
  | "Module Programming"
  | "Other";

export interface Certificate extends EntityRecordBase {
  certificate_code: string;
  owner_email: string;
  vehicle: string;
  vin?: string;
  service_type: CertificateServiceType;
  mileage_at_service?: string;
  technician_name?: string;
  performed_date?: string;
  notes?: string;
}

export interface CaseStudy extends EntityRecordBase {
  image_url: string;
  side: "Digital" | "Physical";
  title: string;
  tag?: string;
  order?: number;
}