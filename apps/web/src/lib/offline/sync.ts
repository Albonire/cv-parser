import { db } from './db';
import { supabase } from '../supabase';

export async function processSyncQueue() {
  if (!navigator.onLine) {
    console.log('Dispositivo sin conexión, saltando sincronización.');
    return;
  }

  const pendingItems = await db.syncQueue.where('synced').equals(0).toArray();
  
  if (pendingItems.length === 0) {
    return;
  }

  console.log(`Iniciando sincronización de ${pendingItems.length} items pendientes.`);

  for (const item of pendingItems) {
    try {
      if (item.action === 'create' || item.action === 'update') {
        const { error } = await supabase
          .from(item.tableName)
          .upsert(item.payload);
        
        if (error) throw error;
      } else if (item.action === 'delete') {
        const { error } = await supabase
          .from(item.tableName)
          .delete()
          .eq('id', item.recordId);
        
        if (error) throw error;
      }

      await db.syncQueue.update(item.id!, { synced: true });
    } catch (err) {
      console.error(`Error sincronizando item ${item.id}:`, err);
      // Se mantiene en la cola para la próxima vez
    }
  }
}

export function initOfflineSync() {
  window.addEventListener('online', () => {
    console.log('Conexión restaurada, intentando sincronizar...');
    processSyncQueue();
  });

  // Intentar sincronizar al cargar la app si hay conexión
  if (navigator.onLine) {
    processSyncQueue();
  }
}

export async function queueMutation(
  action: 'create' | 'update' | 'delete',
  tableName: string,
  recordId: string,
  payload: Record<string, unknown>
) {
  await db.syncQueue.add({
    action,
    tableName,
    recordId,
    payload,
    timestamp: new Date().toISOString(),
    synced: false,
  });

  if (navigator.onLine) {
    processSyncQueue();
  }
}
