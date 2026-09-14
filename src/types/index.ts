export type FieldworkType = 'SUPERVISED' | 'CONCENTRATED';

export type ActivityType =
  | 'RESTRICTED_DIRECT'
  | 'RESTRICTED_INDIRECT'
  | 'UNRESTRICTED_ASSESSMENT'
  | 'UNRESTRICTED_BEHAVIOR_PLAN'
  | 'UNRESTRICTED_SUPERVISION'
  | 'UNRESTRICTED_TRAINING'
  | 'UNRESTRICTED_OTHER';

export type ActivityCategory = 'RESTRICTED' | 'UNRESTRICTED' | 'UNKNOWN';
export type EntryStatus = 'DRAFT' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export type UserRole = 'SUPERVISEE' | 'SUPERVISOR' | 'ADMIN' | 'ORGANIZATION';

export type SubscriptionTier = 'INDIVIDUAL' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface HourEntry {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  fieldworkType: FieldworkType;
  activityType: ActivityType;
  activityCategory: ActivityCategory;
  supervisorId: string;
  supervisorName: string;
  setting: string;
  notes?: string;
  status: EntryStatus;
  createdAt: string;
  updatedAt: string;
  supervisionMinutes?: number;
  observationMinutes?: number;
  individualSupervisionMinutes?: number;
  clientInitials?: string;
  supervisorNote?: string;
  supervisorMessage?: string;
  aiGenerated?: boolean;
  aiConfidence?: number;
  aiRationale?: string;
  aiSourceText?: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: UserRole;
  avatarUrl?: string;
  organizationId?: string;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED';
  trialEndsAt?: string;
  targetHours: number;
  hoursLogged: number;
  unrestrictedHours: number;
  restrictedHours: number;
  supervisors: string[];
  createdAt: string;
  settings: UserSettings;
}

export interface UserSettings {
  darkMode: boolean;
  emailNotifications: boolean;
  weeklyDigest: boolean;
  complianceAlerts: boolean;
  timezone: string;
}

export interface Supervisor {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  certificationNumber?: string;
  avatarUrl?: string;
  supervisees: string[];
  organizationId?: string;
  isActive: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  adminIds: string[];
  memberCount: number;
  supervisorCount: number;
  candidateCount: number;
  subscriptionTier: SubscriptionTier;
  settings: OrganizationSettings;
  createdAt: string;
}

export interface OrganizationSettings {
  customBranding: boolean;
  primaryColor?: string;
  logoUrl?: string;
  ssoEnabled: boolean;
  ssoProvider?: string;
  allowPublicSignup: boolean;
  requireApproval: boolean;
}

export interface ProgressSummary {
  totalHours: number;
  targetHours: number;
  percentageComplete: number;
  unrestrictedHours: number;
  unrestrictedTarget: number;
  unrestrictedPercentage: number;
  restrictedHours: number;
  monthlyHours: MonthlyHours[];
  categoryBreakdown: CategoryBreakdown[];
}

export interface MonthlyHours {
  month: string;
  hours: number;
  unrestricted: number;
  restricted: number;
}

export interface CategoryBreakdown {
  category: string;
  hours: number;
  percentage: number;
  color: string;
}

export interface ComplianceAlert {
  id: string;
  userId: string;
  type: 'HOURLY_RATE' | 'SUPERVISION_RATIO' | 'CATEGORY_BALANCE' | 'DEADLINE';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  details?: string;
  isRead: boolean;
  createdAt: string;
}

export interface PricingTier {
  id: SubscriptionTier;
  name: string;
  description: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  yearlyDiscount: string;
  badge?: string;
  badgeColor?: string;
  borderColor?: string;
  features: string[];
  ctaText: string;
  ctaStyle: 'primary' | 'secondary' | 'enterprise';
  popular?: boolean;
}

export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  avatarUrl?: string;
  rating: number;
  location: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface FeatureShowcaseItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  image: string;
}
