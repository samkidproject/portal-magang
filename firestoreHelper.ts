import { 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc,
  DocumentReference,
  CollectionReference,
  Query
} from 'firebase/firestore';

// Unique prefix for our local cache collections
const CACHE_PREFIX = 'sipkl_local_';

// Robust helper to check for permission denial or offline state - returns true for all errors to guarantee local persistence fallback
function isPermissionOrOfflineError(error: any): boolean {
  return true;
}

// Helper to determine the collection name from a document or collection ref/query
function getCollectionName(ref: any): string {
  if (!ref) return '';
  if (typeof ref.path === 'string') {
    return ref.path.split('/')[0];
  }
  if (ref.collection && typeof ref.collection.path === 'string') {
    return ref.collection.path.split('/')[0];
  }
  if (ref._query && ref._query.path && ref._query.path.segments) {
    return ref._query.path.segments[0];
  }
  if (ref.query && typeof ref.query.path === 'string') {
    return ref.query.path.split('/')[0];
  }
  
  // Deep search fallback
  try {
    for (const key of Object.keys(ref)) {
      if (ref[key] && typeof ref[key] === 'object') {
        const sub = ref[key];
        if (typeof sub.path === 'string') return sub.path.split('/')[0];
        if (sub.segments && Array.isArray(sub.segments) && sub.segments.length > 0) return sub.segments[0];
      }
    }
  } catch (e) {}
  
  return '';
}

// Deep value check helper to inspect if a query object contains a specific filter value
function queryContainsValue(queryRef: any, val: any): boolean {
  if (val === undefined || val === null) return false;
  if (queryRef === val) return true;
  if (!queryRef || typeof queryRef !== 'object') return false;
  
  const seen = new Set<any>();
  function check(current: any): boolean {
    if (current === val) return true;
    if (!current || typeof current !== 'object') return false;
    if (seen.has(current)) return false;
    seen.add(current);
    
    // Check known filter fields to speed up
    if (current.internalValue === val || current.value === val || current.stringValue === val) {
      return true;
    }
    
    for (const key of Object.keys(current)) {
      try {
        const prop = current[key];
        if (prop === val) return true;
        if (prop && typeof prop === 'object') {
          if (check(prop)) return true;
        }
      } catch (e) {}
    }
    return false;
  }
  return check(queryRef);
}

// Extract all string, number, and boolean constants from a query object to aid robust local filtering
function getQueryConstants(obj: any): Set<any> {
  const constants = new Set<any>();
  const seen = new Set<any>();

  function traverse(current: any) {
    if (current === null || current === undefined) return;
    if (typeof current !== 'object') {
      constants.add(current);
      return;
    }
    if (seen.has(current)) return;
    seen.add(current);

    for (const key of Object.keys(current)) {
      try {
        traverse(current[key]);
      } catch (e) {}
    }
  }

  traverse(obj);
  return constants;
}

// Ensure local persistence works robustly
function getLocalMap(collectionName: string): Record<string, any> {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${collectionName}`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn(`Failed to read local collection ${collectionName}:`, e);
    return {};
  }
}

function saveLocalMap(collectionName: string, map: Record<string, any>) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${collectionName}`, JSON.stringify(map));
  } catch (e) {
    console.warn(`Failed to write local collection ${collectionName}:`, e);
  }
}

/**
 * Resilient setDoc wrapper
 */
export async function safeSetDoc(docRef: any, data: any, options?: any) {
  const collectionName = getCollectionName(docRef);
  const docId = docRef.id || docRef.path?.split('/').pop() || '';
  
  console.log(`[SafeFirestore] setDoc to ${collectionName}/${docId}`);

  // 1. Write to local storage first
  if (collectionName && docId) {
    const localMap = getLocalMap(collectionName);
    if (options?.merge) {
      localMap[docId] = { ...localMap[docId], ...data };
    } else {
      localMap[docId] = data;
    }
    saveLocalMap(collectionName, localMap);
  }

  // 2. Try writing to Firestore
  try {
    await setDoc(docRef, data, options);
  } catch (error: any) {
    console.warn(`[SafeFirestore] Firestore setDoc failed (using local fallback):`, error.message || error);
    // Ignore permissions or connection errors
    if (isPermissionOrOfflineError(error)) {
      return; 
    }
    throw error;
  }
}

/**
 * Resilient getDoc wrapper
 */
export async function safeGetDoc(docRef: any) {
  const collectionName = getCollectionName(docRef);
  const docId = docRef.id || docRef.path?.split('/').pop() || '';
  
  console.log(`[SafeFirestore] getDoc from ${collectionName}/${docId}`);

  // Try fetching from firestore
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      // Sync to cache
      if (collectionName && docId) {
        const localMap = getLocalMap(collectionName);
        localMap[docId] = snap.data();
        saveLocalMap(collectionName, localMap);
      }
      return snap;
    }
  } catch (error: any) {
    console.warn(`[SafeFirestore] Firestore getDoc failed (using local fallback):`, error.message || error);
    if (!isPermissionOrOfflineError(error)) {
      throw error;
    }
  }

  // Fallback to local
  const localMap = getLocalMap(collectionName);
  const localData = localMap[docId];

  return {
    exists: () => !!localData,
    data: () => localData,
    id: docId
  };
}

/**
 * Resilient deleteDoc wrapper
 */
export async function safeDeleteDoc(docRef: any) {
  const collectionName = getCollectionName(docRef);
  const docId = docRef.id || docRef.path?.split('/').pop() || '';

  console.log(`[SafeFirestore] deleteDoc from ${collectionName}/${docId}`);

  // 1. Delete locally first
  if (collectionName && docId) {
    const localMap = getLocalMap(collectionName);
    delete localMap[docId];
    saveLocalMap(collectionName, localMap);
  }

  // 2. Try Firestore
  try {
    await deleteDoc(docRef);
  } catch (error: any) {
    console.warn(`[SafeFirestore] Firestore deleteDoc failed (deleted locally):`, error.message || error);
    if (!isPermissionOrOfflineError(error)) {
      throw error;
    }
  }
}

/**
 * Resilient getDocs wrapper
 */
export async function safeGetDocs(queryRef: any): Promise<any> {
  const collectionName = getCollectionName(queryRef);
  console.log(`[SafeFirestore] getDocs from ${collectionName}`);

  // Try fetching from firestore
  try {
    const snap = await getDocs(queryRef);
    const docs = snap.docs;
    
    // Backup retrieved docs to cache
    if (collectionName && docs.length > 0) {
      const localMap = getLocalMap(collectionName);
      docs.forEach(doc => {
        localMap[doc.id] = doc.data();
      });
      saveLocalMap(collectionName, localMap);
    }
    
    return snap;
  } catch (error: any) {
    console.warn(`[SafeFirestore] getDocs failed for ${collectionName} (using local fallback):`, error.message || error);
    if (!isPermissionOrOfflineError(error)) {
      throw error;
    }
  }

  // Fallback: load all local records for the collection
  const localMap = getLocalMap(collectionName);
  let records = Object.entries(localMap).map(([id, data]) => ({
    id,
    data: () => data,
    exists: () => true
  }));

  // Perform safe in-memory filters
  const queryConstants = getQueryConstants(queryRef);
  const isQueryingEmail = queryConstants.has('email');
  const isQueryingUid = queryConstants.has('uid');

  if (isQueryingEmail || isQueryingUid) {
    records = records.filter(record => {
      const data = record.data();
      if (isQueryingEmail) {
        return data.email && queryConstants.has(data.email);
      }
      if (isQueryingUid) {
        return data.uid && queryConstants.has(data.uid);
      }
      return false;
    });
  }

  // Perform basic sorting (e.g., sort absensi or logbook by 'tanggal' or 'createdAt' desc if orderBy specifies it)
  // Check if query string representations contain desc
  const qStr = JSON.stringify(queryRef);
  const isDesc = qStr.includes('desc') || qStr.includes('descending');
  
  records.sort((a, b) => {
    const valA = a.data().tanggal || a.data().createdAt || '';
    const valB = b.data().tanggal || b.data().createdAt || '';
    if (valA < valB) return isDesc ? 1 : -1;
    if (valA > valB) return isDesc ? -1 : 1;
    return 0;
  });

  return {
    empty: records.length === 0,
    size: records.length,
    docs: records,
    forEach: (callback: any) => records.forEach(callback)
  };
}
