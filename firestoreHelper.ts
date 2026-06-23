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

// Robust helper to check for permission denial or offline state
function isPermissionOrOfflineError(error: any): boolean {
  if (!error) return false;
  // Get message and code strings
  const msg = (error.message || String(error)).toLowerCase();
  const code = (error.code || '').toLowerCase();
  return (
    msg.includes('permission') || 
    msg.includes('insufficient') ||
    msg.includes('offline') ||
    msg.includes('unauthenticated') ||
    msg.includes('denied') ||
    code.includes('permission') || 
    code.includes('offline') ||
    code.includes('unauthenticated') ||
    code.includes('denied')
  );
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
  // Check if our query contains filters for email, uid, or is restricted to a certain user
  const hasSpecificId = records.some(r => r.data().uid || r.data().email);
  if (hasSpecificId) {
    // If we have records with fields like 'email' or 'uid', check if queryRef specifies them
    // For example, when searching for user.uid or user.email
    const filtered = records.filter(record => {
      const data = record.data();
      // If query object contains this record's email or uid, match it
      if (data.email && queryContainsValue(queryRef, data.email)) return true;
      if (data.uid && queryContainsValue(queryRef, data.uid)) return true;

      // Check if query is a simple collection query without filters
      // If we cannot find any query filter match, but the query itself does not contain any of the other emails in our list, keep it
      const queryHasOtherEmailInDb = records.some(r => r.data().email && r.data().email !== data.email && queryContainsValue(queryRef, r.data().email));
      const queryHasOtherUidInDb = records.some(r => r.data().uid && r.data().uid !== data.uid && queryContainsValue(queryRef, r.data().uid));
      
      if (!queryHasOtherEmailInDb && !queryHasOtherUidInDb) {
        return true;
      }
      return false;
    });

    if (filtered.length > 0 || (collectionName === 'users' || collectionName === 'absensi' || collectionName === 'logbook')) {
      records = filtered;
    }
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
