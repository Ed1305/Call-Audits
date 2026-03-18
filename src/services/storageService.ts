import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import { SavedAnalysis, CallAnalysis } from '../types';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Initialize localforage store (fallback)
const store = localforage.createInstance({
  name: 'CallAuditAI',
  storeName: 'analyses'
});

export async function saveAnalysis(
  analysis: CallAnalysis,
  audioBase64: string,
  mimeType: string,
  fileName: string = 'Live Recording'
): Promise<SavedAnalysis> {
  const newRecord: SavedAnalysis = {
    id: uuidv4(),
    timestamp: Date.now(),
    fileName,
    audioBase64,
    mimeType,
    analysis
  };
  
  if (supabase) {
    const { error } = await supabase
      .from('analyses')
      .insert([
        {
          id: newRecord.id,
          timestamp: newRecord.timestamp,
          file_name: newRecord.fileName,
          audio_base64: newRecord.audioBase64,
          mime_type: newRecord.mimeType,
          analysis: newRecord.analysis
        }
      ]);
      
    if (error) {
      console.error("Supabase insert error:", error);
      throw new Error(`Database error: ${error.message}`);
    }
  } else {
    await store.setItem(newRecord.id, newRecord);
  }
  
  return newRecord;
}

export async function getAllAnalyses(): Promise<SavedAnalysis[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .order('timestamp', { ascending: false });
      
    if (error) {
      console.error("Supabase select error:", error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    return (data || []).map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      fileName: row.file_name,
      audioBase64: row.audio_base64,
      mimeType: row.mime_type,
      analysis: row.analysis
    }));
  } else {
    const analyses: SavedAnalysis[] = [];
    await store.iterate((value: SavedAnalysis) => {
      analyses.push(value);
    });
    return analyses.sort((a, b) => b.timestamp - a.timestamp);
  }
}

export async function deleteAnalysis(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('analyses')
      .delete()
      .eq('id', id);
      
    if (error) throw new Error(`Database error: ${error.message}`);
  } else {
    await store.removeItem(id);
  }
}

export async function purgeAnalyses(): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('analyses')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
    if (error) throw new Error(`Database error: ${error.message}`);
  } else {
    await store.clear();
  }
}

export async function getAnalysis(id: string): Promise<SavedAnalysis | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error || !data) return null;
    
    return {
      id: data.id,
      timestamp: data.timestamp,
      fileName: data.file_name,
      audioBase64: data.audio_base64,
      mimeType: data.mime_type,
      analysis: data.analysis
    };
  } else {
    return await store.getItem<SavedAnalysis>(id);
  }
}
