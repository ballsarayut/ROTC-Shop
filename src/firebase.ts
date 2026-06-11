import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, terminate, disableNetwork, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

// Mute Firestore internal debugger and stream warn/error logging
try {
  setLogLevel('silent');
} catch (e) {}

const app = initializeApp(firebaseConfig);
export const db = firebaseConfig.firestoreDatabaseId 
  ? initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId) 
  : initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
export const auth = getAuth(app);
export const storage = getStorage(app);

if (sessionStorage.getItem('firestore_quota_exceeded') === 'true') {
  console.warn('Firestore quota exceeded state loaded from session. Disabling network on load.');
  disableNetwork(db).catch(() => {});
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

let isTerminating = false;

export function isFirestoreQuotaExceeded(): boolean {
  return (window as any).firestoreTerminated === true || sessionStorage.getItem('firestore_quota_exceeded') === 'true';
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  
  if (
    errInfo.error.includes('Quota limit exceeded') || 
    errInfo.error.includes('Quota exceeded') || 
    errInfo.error.includes('RESOURCE_EXHAUSTED') ||
    errInfo.error.includes('Quota limit') ||
    errInfo.error.includes('quota metric')
  ) {
    const quotaMsg = "ฐานข้อมูลเกินขีดจำกัดการใช้งานฟรีรายวัน (Quota Exceeded) ระบบจะปรับการทำงานเข้าสู่โหมดออฟไลน์และสำรองข้อมูลด้วย Google Sheets โดยอัตโนมัติ";
    console.warn('Firestore Quota Exceeded. Switching to entire Google Sheets absolute fallback mode.', errInfo);
    
    // Set global flags to bypass all future Firestore calls
    (window as any).firestoreTerminated = true;
    sessionStorage.setItem('firestore_quota_exceeded', 'true');

    // Terminate connection and disable network to stop active backoff delay retries and prevent console pollution
    if (!isTerminating) {
      isTerminating = true;
      console.warn('Attempting to gracefully terminate Firestore database connection and disable network...');
      disableNetwork(db)
        .then(() => {
          console.log('Firestore network disabled successfully.');
          return terminate(db);
        })
        .then(() => {
          console.log('Firestore connection terminated successfully to prevent overloading backend.');
        })
        .catch(err => {
          console.warn('Error during Firestore network disable/termination:', err);
        });
    }
    
    // Instead of throwing, trigger a custom event that limits the impact but lets the app continue/handle it
    const event = new CustomEvent('firestore-quota-exceeded', { detail: quotaMsg });
    window.dispatchEvent(event);
    
    return; // Do NOT throw an error, so the app doesn't crash completely.
  }

  console.error('Firestore Error: ', errInfo);
  throw new Error(`Firestore Error during ${operationType} at ${path}: ${errInfo.error}`);
}
