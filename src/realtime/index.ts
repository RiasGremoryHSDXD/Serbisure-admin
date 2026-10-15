import { API_BASE_URL } from '../api/apiClient';
import { RealtimeClient } from './RealtimeClient';
export const realtime = new RealtimeClient(API_BASE_URL);
