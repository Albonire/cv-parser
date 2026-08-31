import { db } from './db';
import { isSupabaseConfigured, supabase } from '../api/supabase';

export async function processSyncQueue() {
  if (!navigator.onLine) {
    console.log('Dispositivo sin conexion, se conserva la cola local.');
    return;
  }

  if (!isSupabaseConfigured) {
    // Sin credenciales la aplicacion opera 100% local; la cola espera.
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
          .upsert(mapPayloadToSnakeCase(item.tableName, item.payload));
        
        if (error) throw error;
      } else if (item.action === 'delete') {
        const { error } = await supabase
          .from(item.tableName)
          .delete()
          .eq('id', item.recordId);
        
        if (error) throw error;
      }

      await db.syncQueue.update(item.id!, { synced: 1 });
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
    synced: 0,
  });

  if (navigator.onLine) {
    processSyncQueue();
  }
}

const CAMEL_TO_SNAKE = /([a-z0-9])([A-Z])/g;

function toSnake(key: string): string {
  return key.replace(CAMEL_TO_SNAKE, '$1_$2').toLowerCase();
}

// Convierte un payload camelCase (modelo local) a snake_case (esquema SQL de
// Supabase) antes del upsert. Envuelve los objetos anidados (JSONB) tal cual.
export function mapPayloadToSnakeCase(
  _tableName: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    const snakeKey = toSnake(key);

    if (value === null) {
      result[snakeKey] = null;
      continue;
    }

    if (Array.isArray(value) || typeof value === 'object') {
      // Campos JSONB (skills, education, renewals, rankings...) se serializan.
      result[snakeKey] = JSON.stringify(value);
      continue;
    }

    result[snakeKey] = value;
  }

  return result;
}
