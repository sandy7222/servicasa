import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultDestination,
  destinationForGroupTap,
  destinationFromPath,
  groupFromPath,
  hubPathForTab,
  isAdminWorkspacePath,
  rememberDestination,
  tabFromPath,
} from './adminNav';

describe('adminNav', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('hub sin query es Órdenes; tab en query selecciona pestaña interna', () => {
    expect(tabFromPath('/hub')).toBe('orders');
    expect(tabFromPath('/hub?tab=pageEditor')).toBe('pageEditor');
    expect(tabFromPath('/hub?order=abc')).toBe('orders');
    expect(tabFromPath('/admin/clientes')).toBeNull();
  });

  it('ruta hash de clientes/reclamos/conversaciones cae en Personas', () => {
    expect(destinationFromPath('/admin/clientes')?.id).toBe('clientes');
    expect(destinationFromPath('/admin/clientes/cust-1')?.id).toBe('clientes');
    expect(destinationFromPath('/admin/reclamos/c1')?.id).toBe('reclamos');
    expect(destinationFromPath('/admin/conversaciones')?.id).toBe('conversaciones');
    expect(groupFromPath('/admin/clientes')).toBe('personas');
  });

  it('destino por defecto de cada grupo', () => {
    expect(defaultDestination('operacion').id).toBe('orders');
    expect(defaultDestination('personas').id).toBe('clientes');
    expect(defaultDestination('catalogo').id).toBe('services');
    expect(defaultDestination('plataforma').id).toBe('pageEditor');
  });

  it('hubPathForTab: Órdenes es /hub, el resto lleva ?tab=', () => {
    expect(hubPathForTab('orders')).toBe('/hub');
    expect(hubPathForTab('pageEditor')).toBe('/hub?tab=pageEditor');
  });

  it('isAdminWorkspacePath cubre hub, home y /admin/*', () => {
    expect(isAdminWorkspacePath('/hub')).toBe(true);
    expect(isAdminWorkspacePath('/hub?tab=services')).toBe(true);
    expect(isAdminWorkspacePath('/home')).toBe(true);
    expect(isAdminWorkspacePath('/admin/clientes/x')).toBe(true);
    expect(isAdminWorkspacePath('/customer')).toBe(false);
  });

  it('al tocar un grupo vuelve al último destino recordado de ese grupo', () => {
    expect(destinationForGroupTap('plataforma').id).toBe('pageEditor');
    rememberDestination('settlements');
    expect(destinationForGroupTap('plataforma').id).toBe('settlements');
    expect(destinationForGroupTap('operacion').id).toBe('orders');
  });

  it('groupFromPath de pestaña interna de catálogo', () => {
    expect(groupFromPath('/hub?tab=inventory')).toBe('catalogo');
    expect(destinationFromPath('/hub?tab=inventory')?.id).toBe('inventory');
  });
});
