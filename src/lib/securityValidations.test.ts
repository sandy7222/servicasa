/**
 * Security Validation Tests
 * 
 * Tests to verify that access control rules are enforced correctly
 * and that cross-user data access is prevented.
 */

import {
  requireAdmin,
  requireTechnician,
  validateOrderCreationAccess,
  validateOrderModificationAccess,
  validateCustomerOrderAccess,
  validateCustomerSignatureAccess,
  validateTechnicianOrderAccess,
  validateTechnicianAssignmentAccess,
  validateOrderId,
  SecurityError,
} from '../lib/securityValidations';
import type { CurrentUserData, ServiceOrder } from '../types';

// Mock users
const adminUser: CurrentUserData = {
  id: 'admin-1',
  name: 'Administrador',
  email: 'admin@tecniurbano.com.ar',
  role: 'admin',
  technicianId: null,
  customerId: null,
  avatarText: 'AD',
};

const technicianUser1: CurrentUserData = {
  id: 'tech-1',
  name: 'Carlos',
  email: 'carlos@tecniurbano.com.ar',
  role: 'technician',
  technicianId: 'tec-001',
  customerId: null,
  avatarText: 'CM',
};

const technicianUser2: CurrentUserData = {
  id: 'tech-2',
  name: 'María',
  email: 'maria@tecniurbano.com.ar',
  role: 'technician',
  technicianId: 'tec-002',
  customerId: null,
  avatarText: 'MR',
};

const customerUser1: CurrentUserData = {
  id: 'cust-1',
  name: 'Julián',
  email: 'julian@tecniurbano.com.ar',
  role: 'customer',
  technicianId: null,
  customerId: 'cust-001',
  avatarText: 'JA',
};

const customerUser2: CurrentUserData = {
  id: 'cust-2',
  name: 'Florencia',
  email: 'florencia@tecniurbano.com.ar',
  role: 'customer',
  technicianId: null,
  customerId: 'cust-002',
  avatarText: 'FS',
};

// Mock orders
const orderAssignedToTech1: ServiceOrder = {
  id: 'SC-800',
  title: 'Plomería urgencia',
  description: 'Fuga en lavadero',
  serviceType: 'Plomería',
  priority: 'alta',
  status: 'assigned',
  clientId: customerUser1.customerId!,
  clientName: customerUser1.name,
  clientPhone: '123456789',
  clientAddress: 'Calle 1, 100',
  clientNeighborhood: 'Palermo',
  assignedTechnicianId: technicianUser1.technicianId!,
  assignedTechnicianName: technicianUser1.name,
  scheduledDate: '2026-08-18',
  createdAt: '2026-08-17T10:00:00Z',
  completedAt: undefined,
  checklist: [],
  timeLogs: [],
  technicalNotes: [],
  usedMaterials: [],
  customerSignature: undefined,
  events: [],
};

const orderAssignedToTech2: ServiceOrder = {
  ...orderAssignedToTech1,
  id: 'SC-801',
  assignedTechnicianId: technicianUser2.technicianId!,
  assignedTechnicianName: technicianUser2.name,
  clientId: customerUser2.customerId!,
  clientName: customerUser2.name,
};

// Test Suite
export const securityTests = {
  // ========== Admin Access Tests ==========
  'admin_can_create_orders': () => {
    try {
      validateOrderCreationAccess(adminUser);
      console.log('✓ PASS: Admin can create orders');
      return true;
    } catch (err) {
      console.error('✗ FAIL: Admin creation denied:', err);
      return false;
    }
  },

  'admin_can_modify_any_order': () => {
    try {
      validateOrderModificationAccess(adminUser, orderAssignedToTech1);
      console.log('✓ PASS: Admin can modify any order');
      return true;
    } catch (err) {
      console.error('✗ FAIL: Admin modification denied:', err);
      return false;
    }
  },

  'admin_can_access_any_order': () => {
    try {
      validateTechnicianOrderAccess(adminUser, orderAssignedToTech1);
      console.log('✓ PASS: Admin can access any order');
      return true;
    } catch (err) {
      console.error('✗ FAIL: Admin access denied:', err);
      return false;
    }
  },

  // ========== Technician Access Tests ==========
  'tech_cannot_create_orders': () => {
    try {
      validateOrderCreationAccess(technicianUser1);
      console.error('✗ FAIL: Technician should not create orders');
      return false;
    } catch (err) {
      if (err instanceof SecurityError && err.code === 'ADMIN_ONLY') {
        console.log('✓ PASS: Technician creation denied');
        return true;
      }
      console.error('✗ FAIL: Wrong error:', err);
      return false;
    }
  },

  'tech_cannot_modify_others_orders': () => {
    try {
      validateOrderModificationAccess(technicianUser1, orderAssignedToTech2);
      console.error('✗ FAIL: Technician should not modify others orders');
      return false;
    } catch (err) {
      if (err instanceof SecurityError && err.code === 'ORDER_MODIFICATION_DENIED') {
        console.log('✓ PASS: Technician modification of others order denied');
        return true;
      }
      console.error('✗ FAIL: Wrong error:', err);
      return false;
    }
  },

  'tech_can_modify_assigned_order': () => {
    try {
      validateOrderModificationAccess(technicianUser1, orderAssignedToTech1);
      console.log('✓ PASS: Technician can modify assigned order');
      return true;
    } catch (err) {
      console.error('✗ FAIL: Technician modification of assigned order denied:', err);
      return false;
    }
  },

  'tech_cannot_access_others_orders': () => {
    try {
      validateTechnicianOrderAccess(technicianUser1, orderAssignedToTech2);
      console.error('✗ FAIL: Technician should not access others orders');
      return false;
    } catch (err) {
      if (err instanceof SecurityError && err.code === 'ORDER_ACCESS_DENIED') {
        console.log('✓ PASS: Technician access to others order denied');
        return true;
      }
      console.error('✗ FAIL: Wrong error:', err);
      return false;
    }
  },

  // ========== Customer Access Tests ==========
  'customer_cannot_create_orders': () => {
    try {
      validateOrderCreationAccess(customerUser1);
      console.error('✗ FAIL: Customer should not create orders');
      return false;
    } catch (err) {
      if (err instanceof SecurityError && err.code === 'ADMIN_ONLY') {
        console.log('✓ PASS: Customer creation denied');
        return true;
      }
      console.error('✗ FAIL: Wrong error:', err);
      return false;
    }
  },

  'customer_cannot_modify_orders': () => {
    try {
      validateOrderModificationAccess(customerUser1, orderAssignedToTech1);
      console.error('✗ FAIL: Customer should not modify orders');
      return false;
    } catch (err) {
      if (err instanceof SecurityError && err.code === 'CUSTOMER_CANNOT_MODIFY') {
        console.log('✓ PASS: Customer modification denied');
        return true;
      }
      console.error('✗ FAIL: Wrong error:', err);
      return false;
    }
  },

  'customer_can_access_own_order': () => {
    try {
      validateCustomerOrderAccess(customerUser1, orderAssignedToTech1);
      console.log('✓ PASS: Customer can access own order');
      return true;
    } catch (err) {
      console.error('✗ FAIL: Customer access to own order denied:', err);
      return false;
    }
  },

  'customer_cannot_access_others_orders': () => {
    try {
      validateCustomerOrderAccess(customerUser1, orderAssignedToTech2);
      console.error('✗ FAIL: Customer should not access others orders');
      return false;
    } catch (err) {
      if (err instanceof SecurityError && err.code === 'ORDER_ACCESS_DENIED') {
        console.log('✓ PASS: Customer access to others order denied');
        return true;
      }
      console.error('✗ FAIL: Wrong error:', err);
      return false;
    }
  },

  // ========== Assignment Tests ==========
  'admin_can_assign_technician': () => {
    try {
      validateTechnicianAssignmentAccess(adminUser);
      console.log('✓ PASS: Admin can assign technicians');
      return true;
    } catch (err) {
      console.error('✗ FAIL: Admin assignment denied:', err);
      return false;
    }
  },

  'tech_cannot_assign_technician': () => {
    try {
      validateTechnicianAssignmentAccess(technicianUser1);
      console.error('✗ FAIL: Technician should not assign');
      return false;
    } catch (err) {
      if (err instanceof SecurityError && err.code === 'ASSIGNMENT_DENIED') {
        console.log('✓ PASS: Technician assignment denied');
        return true;
      }
      console.error('✗ FAIL: Wrong error:', err);
      return false;
    }
  },

  'customer_cannot_assign_technician': () => {
    try {
      validateTechnicianAssignmentAccess(customerUser1);
      console.error('✗ FAIL: Customer should not assign');
      return false;
    } catch (err) {
      if (err instanceof SecurityError && err.code === 'ASSIGNMENT_DENIED') {
        console.log('✓ PASS: Customer assignment denied');
        return true;
      }
      console.error('✗ FAIL: Wrong error:', err);
      return false;
    }
  },

  // ========== ID Validation Tests ==========
  'valid_order_id_accepted': () => {
    try {
      validateOrderId('SC-800');
      console.log('✓ PASS: Valid order ID accepted');
      return true;
    } catch (err) {
      console.error('✗ FAIL: Valid ID rejected:', err);
      return false;
    }
  },

  // ========== Customer Signature Tests ==========
  'customer_can_sign_own_order': () => {
    try {
      validateCustomerSignatureAccess(customerUser1, orderAssignedToTech1);
      console.log('✓ PASS: Customer can sign own order');
      return true;
    } catch (err) {
      console.error('✗ FAIL: Customer signature denied:', err);
      return false;
    }
  },

  'technician_cannot_sign_customer_order': () => {
    try {
      validateCustomerSignatureAccess(technicianUser1, orderAssignedToTech1);
      console.error('✗ FAIL: Technician should not sign customer order');
      return false;
    } catch (err) {
      if (err instanceof SecurityError && err.code === 'SIGNATURE_CUSTOMER_ONLY') {
        console.log('✓ PASS: Technician signature denied');
        return true;
      }
      console.error('✗ FAIL: Wrong error:', err);
      return false;
    }
  },

  'admin_cannot_sign_customer_order': () => {
    try {
      validateCustomerSignatureAccess(adminUser, orderAssignedToTech1);
      console.error('✗ FAIL: Admin should not sign customer order');
      return false;
    } catch (err) {
      if (err instanceof SecurityError && err.code === 'SIGNATURE_CUSTOMER_ONLY') {
        console.log('✓ PASS: Admin signature denied');
        return true;
      }
      console.error('✗ FAIL: Wrong error:', err);
      return false;
    }
  },

  'customer_cannot_sign_another_customers_order': () => {
    try {
      validateCustomerSignatureAccess(customerUser1, orderAssignedToTech2);
      console.error('✗ FAIL: Customer should not sign another customer order');
      return false;
    } catch (err) {
      if (err instanceof SecurityError && err.code === 'SIGNATURE_ORDER_ACCESS_DENIED') {
        console.log('✓ PASS: Cross-customer signature denied');
        return true;
      }
      console.error('✗ FAIL: Wrong error:', err);
      return false;
    }
  },

  'supabase_uuid_order_id_accepted': () => {
    try {
      validateOrderId('9f4ba762-e4f5-4edb-a5e0-b5c0631a8dbc');
      console.log('✓ PASS: Supabase UUID order ID accepted');
      return true;
    } catch (err) {
      console.error('✗ FAIL: Supabase UUID rejected:', err);
      return false;
    }
  },

  'temp_order_id_accepted': () => {
    try {
      validateOrderId('tmp-1234567890');
      console.log('✓ PASS: Temporary order ID accepted');
      return true;
    } catch (err) {
      console.error('✗ FAIL: Temp ID rejected:', err);
      return false;
    }
  },

  'invalid_order_id_rejected': () => {
    try {
      validateOrderId('INVALID-ORDER-ID');
      console.error('✗ FAIL: Invalid ID should be rejected');
      return false;
    } catch (err) {
      if (err instanceof SecurityError && err.code === 'INVALID_ORDER_ID') {
        console.log('✓ PASS: Invalid ID rejected');
        return true;
      }
      console.error('✗ FAIL: Wrong error:', err);
      return false;
    }
  },

  'sql_injection_attempt_rejected': () => {
    try {
      validateOrderId("SC-800'; DROP TABLE orders; --");
      console.error('✗ FAIL: SQL injection should be rejected');
      return false;
    } catch (err) {
      if (err instanceof SecurityError && err.code === 'INVALID_ORDER_ID') {
        console.log('✓ PASS: SQL injection attempt rejected');
        return true;
      }
      console.error('✗ FAIL: Wrong error:', err);
      return false;
    }
  },

  // ========== Null/Unauthenticated Tests ==========
  'unauthenticated_cannot_create': () => {
    try {
      validateOrderCreationAccess(null);
      console.error('✗ FAIL: Unauthenticated should be rejected');
      return false;
    } catch (err) {
      if (err instanceof SecurityError && err.code === 'AUTH_REQUIRED') {
        console.log('✓ PASS: Unauthenticated creation denied');
        return true;
      }
      console.error('✗ FAIL: Wrong error:', err);
      return false;
    }
  },

  'unauthenticated_cannot_modify': () => {
    try {
      validateOrderModificationAccess(null, orderAssignedToTech1);
      console.error('✗ FAIL: Unauthenticated should be rejected');
      return false;
    } catch (err) {
      if (err instanceof SecurityError && err.code === 'AUTH_REQUIRED') {
        console.log('✓ PASS: Unauthenticated modification denied');
        return true;
      }
      console.error('✗ FAIL: Wrong error:', err);
      return false;
    }
  },
};

/**
 * Run all security tests and report results
 */
export function runSecurityTestSuite() {
  console.log('\n' + '='.repeat(60));
  console.log('SECURITY VALIDATION TEST SUITE');
  console.log('='.repeat(60) + '\n');

  let passed = 0;
  let failed = 0;

  for (const [testName, testFn] of Object.entries(securityTests)) {
    try {
      const result = testFn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`✗ EXCEPTION in ${testName}:`, err);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  if (failed === 0) {
    console.log('✓ ALL SECURITY TESTS PASSED');
  } else {
    console.log('✗ SOME TESTS FAILED - SECURITY ISSUES DETECTED');
  }
  console.log('='.repeat(60) + '\n');

  return failed === 0;
}

// Export for running in test environment
if (typeof window === 'undefined' && typeof module !== 'undefined') {
  module.exports = { runSecurityTestSuite, securityTests };
}
