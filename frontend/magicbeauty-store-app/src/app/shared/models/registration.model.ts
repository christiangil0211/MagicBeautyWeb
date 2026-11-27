export const PRIVACY_POLICY_VERSION = '1.0';

export interface RequestableRole {
  code: string;
  name: string;
}

export interface RegisterCustomer {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  password: string;
  documentNumber?: string;
  requestedRoleCode?: string;
  privacyAccepted: boolean;
  marketingOptIn: boolean;
  policyVersion: string;
}
