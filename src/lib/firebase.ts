import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

function safeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || `id_${Date.now()}`;
}

export async function syncFirebaseUserProfile(user: {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
}) {
  const uid = safeId(user.uid);
  const publicPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/profile`;
  try {
    const publicRef = doc(db, 'users', uid);
    const existing = await getDoc(publicRef);
    const displayName = (user.displayName || 'CaterEase Guest').slice(0, 80);
    if (!existing.exists()) {
      await setDoc(publicRef, {
        uid,
        displayName,
        ...(user.photoURL ? { photoUrl: user.photoURL.slice(0, 512) } : {}),
        role: 'CUSTOMER',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(publicRef, {
        displayName,
        ...(user.photoURL ? { photoUrl: user.photoURL.slice(0, 512) } : {}),
        updatedAt: serverTimestamp(),
      });
    }

    const privateRef = doc(db, 'users', uid, 'private', 'profile');
    const existingPrivate = await getDoc(privateRef);
    const email = (user.email || 'user@caterease.local').slice(0, 160);
    if (!existingPrivate.exists()) {
      await setDoc(privateRef, {
        uid,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privateRef, {
        email,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${publicPath} | ${privatePath}`);
  }
}

export interface StudioPresetRecord {
  presetId: string;
  name: string;
  layoutPreset: 'banquet' | 'buffet' | 'showroom';
  metalFinish: 'gold' | 'copper' | 'silver';
  lightingPreset: 'gala' | 'daylight' | 'sunset';
  explodeAmount: number;
}

export async function saveStudioPreset(
  uid: string,
  preset: Omit<StudioPresetRecord, 'presetId'> & { presetId?: string }
): Promise<StudioPresetRecord> {
  const cleanUid = safeId(uid);
  const presetId = safeId(preset.presetId || `preset_${Date.now()}`);
  const path = `users/${cleanUid}/studioPresets/${presetId}`;
  try {
    await setDoc(doc(db, 'users', cleanUid, 'studioPresets', presetId), {
      presetId,
      ownerUid: cleanUid,
      name: preset.name.trim().slice(0, 80) || 'Banquet Preset',
      layoutPreset: preset.layoutPreset,
      metalFinish: preset.metalFinish,
      lightingPreset: preset.lightingPreset,
      explodeAmount: Math.max(0, Math.min(1, Number(preset.explodeAmount) || 0)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return {
      presetId,
      name: preset.name.trim().slice(0, 80) || 'Banquet Preset',
      layoutPreset: preset.layoutPreset,
      metalFinish: preset.metalFinish,
      lightingPreset: preset.lightingPreset,
      explodeAmount: Math.max(0, Math.min(1, Number(preset.explodeAmount) || 0)),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function listStudioPresets(uid: string): Promise<StudioPresetRecord[]> {
  const cleanUid = safeId(uid);
  const path = `users/${cleanUid}/studioPresets`;
  try {
    const q = query(
      collection(db, 'users', cleanUid, 'studioPresets'),
      where('ownerUid', '==', cleanUid),
      orderBy('updatedAt', 'desc'),
      limit(12)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        presetId: String(data.presetId || d.id),
        name: String(data.name || 'Saved Preset'),
        layoutPreset: (data.layoutPreset as StudioPresetRecord['layoutPreset']) || 'banquet',
        metalFinish: (data.metalFinish as StudioPresetRecord['metalFinish']) || 'gold',
        lightingPreset: (data.lightingPreset as StudioPresetRecord['lightingPreset']) || 'gala',
        explodeAmount: typeof data.explodeAmount === 'number' ? data.explodeAmount : 0,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function removeStudioPreset(uid: string, presetId: string): Promise<void> {
  const cleanUid = safeId(uid);
  const cleanPreset = safeId(presetId);
  const path = `users/${cleanUid}/studioPresets/${cleanPreset}`;
  try {
    await deleteDoc(doc(db, 'users', cleanUid, 'studioPresets', cleanPreset));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface ChatSessionRecord {
  sessionId: string;
  title: string;
  modelTier: 'fast' | 'general' | 'deep';
  searchEnabled: boolean;
  systemInstruction?: string;
}

export interface ChatMessageRecord {
  messageId: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  groundingUrls?: string[];
}

export async function upsertChatSession(uid: string, session: ChatSessionRecord): Promise<void> {
  const cleanUid = safeId(uid);
  const cleanSession = safeId(session.sessionId);
  const path = `users/${cleanUid}/chatSessions/${cleanSession}`;
  try {
    const ref = doc(db, 'users', cleanUid, 'chatSessions', cleanSession);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        sessionId: cleanSession,
        ownerUid: cleanUid,
        title: session.title.trim().slice(0, 120) || 'CaterEase Chat',
        modelTier: session.modelTier,
        searchEnabled: Boolean(session.searchEnabled),
        ...(session.systemInstruction ? { systemInstruction: session.systemInstruction.slice(0, 600) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        title: session.title.trim().slice(0, 120) || 'CaterEase Chat',
        modelTier: session.modelTier,
        searchEnabled: Boolean(session.searchEnabled),
        ...(session.systemInstruction ? { systemInstruction: session.systemInstruction.slice(0, 600) } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function appendChatMessageToFirestore(
  uid: string,
  sessionId: string,
  msg: ChatMessageRecord
): Promise<void> {
  const cleanUid = safeId(uid);
  const cleanSession = safeId(sessionId);
  const cleanMsg = safeId(msg.messageId);
  const path = `users/${cleanUid}/chatSessions/${cleanSession}/messages/${cleanMsg}`;
  try {
    const urls = (msg.groundingUrls || []).filter((u) => typeof u === 'string' && u.length > 0).slice(0, 10);
    await setDoc(doc(db, 'users', cleanUid, 'chatSessions', cleanSession, 'messages', cleanMsg), {
      messageId: cleanMsg,
      sessionId: cleanSession,
      ownerUid: cleanUid,
      role: msg.role,
      text: msg.text.slice(0, 8000) || ' ',
      ...(msg.modelUsed ? { modelUsed: msg.modelUsed.slice(0, 64) } : {}),
      ...(urls.length > 0 ? { groundingUrls: urls } : {}),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function listChatSessions(uid: string): Promise<ChatSessionRecord[]> {
  const cleanUid = safeId(uid);
  const path = `users/${cleanUid}/chatSessions`;
  try {
    const q = query(
      collection(db, 'users', cleanUid, 'chatSessions'),
      where('ownerUid', '==', cleanUid),
      orderBy('updatedAt', 'desc'),
      limit(10)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        sessionId: String(data.sessionId || d.id),
        title: String(data.title || 'CaterEase Session'),
        modelTier: (data.modelTier as ChatSessionRecord['modelTier']) || 'general',
        searchEnabled: Boolean(data.searchEnabled),
        systemInstruction: data.systemInstruction ? String(data.systemInstruction) : undefined,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function loadChatSessionMessages(uid: string, sessionId: string): Promise<ChatMessageRecord[]> {
  const cleanUid = safeId(uid);
  const cleanSession = safeId(sessionId);
  const path = `users/${cleanUid}/chatSessions/${cleanSession}/messages`;
  try {
    const q = query(
      collection(db, 'users', cleanUid, 'chatSessions', cleanSession, 'messages'),
      where('ownerUid', '==', cleanUid),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        messageId: String(data.messageId || d.id),
        role: data.role === 'user' ? 'user' : 'model',
        text: String(data.text || ''),
        modelUsed: data.modelUsed ? String(data.modelUsed) : undefined,
        groundingUrls: Array.isArray(data.groundingUrls) ? data.groundingUrls.map(String) : undefined,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export interface GameScoreRecord {
  scoreId: string;
  playerName: string;
  score: number;
  waveReached: number;
  ordersDelivered: number;
  maxCombo: number;
}

export async function submitGameScoreToFirestore(
  uid: string,
  payload: Omit<GameScoreRecord, 'scoreId'>
): Promise<GameScoreRecord> {
  const cleanUid = safeId(uid);
  const scoreId = safeId(`score_${cleanUid.slice(0, 12)}_${Date.now()}`);
  const path = `gameScores/${scoreId}`;
  const clampedScore = Math.max(0, Math.min(1000000, Math.round(payload.score)));
  const clampedWave = Math.max(1, Math.min(100, Math.round(payload.waveReached)));
  const clampedOrders = Math.max(0, Math.min(10000, Math.round(payload.ordersDelivered)));
  const clampedCombo = Math.max(0, Math.min(10000, Math.round(payload.maxCombo)));
  const playerName = (payload.playerName || 'Chef').trim().slice(0, 60) || 'Chef';

  try {
    await setDoc(doc(db, 'gameScores', scoreId), {
      scoreId,
      ownerUid: cleanUid,
      playerName,
      score: clampedScore,
      waveReached: clampedWave,
      ordersDelivered: clampedOrders,
      maxCombo: clampedCombo,
      visibility: 'leaderboard',
      createdAt: serverTimestamp(),
    });
    return {
      scoreId,
      playerName,
      score: clampedScore,
      waveReached: clampedWave,
      ordersDelivered: clampedOrders,
      maxCombo: clampedCombo,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchLeaderboardScores(): Promise<GameScoreRecord[]> {
  const path = 'gameScores';
  try {
    const q = query(
      collection(db, 'gameScores'),
      where('visibility', '==', 'leaderboard'),
      orderBy('score', 'desc'),
      limit(10)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        scoreId: String(data.scoreId || d.id),
        playerName: String(data.playerName || 'Chef'),
        score: Number(data.score || 0),
        waveReached: Number(data.waveReached || 1),
        ordersDelivered: Number(data.ordersDelivered || 0),
        maxCombo: Number(data.maxCombo || 0),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
