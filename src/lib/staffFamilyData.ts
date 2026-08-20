import { getSession, supabase } from '@/lib/supabase'
import type { KidsAgeGroup } from '@/data/kidsChallenges'

export type StaffChild = {
  id: string
  user_id: string
  display_name: string
  age_group: KidsAgeGroup
  school_grade: string | null
  avatar_emoji: string
  created_at: string
  updated_at: string
}

export type StudyQuestion = {
  question: string
  options: string[]
  correct_index: number
  explanation: string
}

export type StudyFlashcard = {
  front: string
  back: string
}

export type StudyPack = {
  title: string
  subject: string
  summary: string
  study_text: string
  key_points: string[]
  questions: StudyQuestion[]
  flashcards: StudyFlashcard[]
  source_warnings: string[]
}

export type StudyMaterial = {
  id: string
  user_id: string
  child_id: string
  title: string
  subject: string
  file_path: string | null
  file_name: string
  mime_type: string
  source_only: boolean
  study_pack: StudyPack
  created_at: string
}

export type KidsGameSession = {
  id: string
  user_id: string
  child_id: string
  deck_id: string
  score: number
  total_questions: number
  duration_seconds: number
  started_at: string
  ended_at: string
}

export type StudyAttempt = {
  id: string
  user_id: string
  child_id: string
  material_id: string
  score: number
  total_questions: number
  created_at: string
}

export async function loadChildren(userId: string): Promise<StaffChild[]> {
  const { data, error } = await supabase
    .from('staff_children')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []) as StaffChild[]
}

export async function createChild(userId: string, input: Pick<StaffChild, 'display_name' | 'age_group' | 'school_grade' | 'avatar_emoji'>) {
  const { data, error } = await supabase
    .from('staff_children')
    .insert({ user_id: userId, ...input })
    .select('*')
    .single()
  if (error) throw error
  return data as StaffChild
}

export async function updateChild(userId: string, childId: string, updates: Partial<Pick<StaffChild, 'display_name' | 'age_group' | 'school_grade' | 'avatar_emoji'>>) {
  const { data, error } = await supabase
    .from('staff_children')
    .update(updates)
    .eq('id', childId)
    .eq('user_id', userId)
    .select('*')
    .single()
  if (error) throw error
  return data as StaffChild
}

export async function deleteChild(userId: string, childId: string) {
  const { error } = await supabase.from('staff_children').delete().eq('id', childId).eq('user_id', userId)
  if (error) throw error
}

export async function loadStudyMaterials(userId: string, childId?: string): Promise<StudyMaterial[]> {
  let query = supabase
    .from('staff_study_materials')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (childId) query = query.eq('child_id', childId)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as StudyMaterial[]
}

export async function saveStudyMaterial(input: {
  userId: string
  childId: string
  fileName: string
  mimeType: string
  filePath?: string | null
  sourceOnly?: boolean
  pack: StudyPack
}) {
  const { data, error } = await supabase
    .from('staff_study_materials')
    .insert({
      user_id: input.userId,
      child_id: input.childId,
      title: input.pack.title,
      subject: input.pack.subject,
      file_path: input.filePath || null,
      file_name: input.fileName,
      mime_type: input.mimeType,
      source_only: input.sourceOnly !== false,
      study_pack: input.pack,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as StudyMaterial
}

export async function deleteStudyMaterial(userId: string, material: StudyMaterial) {
  if (material.file_path) await supabase.storage.from('staff-study-materials').remove([material.file_path]).catch(() => undefined)
  const { error } = await supabase.from('staff_study_materials').delete().eq('id', material.id).eq('user_id', userId)
  if (error) throw error
}

export async function uploadStudyFile(userId: string, childId: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
  const path = `${userId}/${childId}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage
    .from('staff-study-materials')
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (error) throw error
  return path
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error || new Error('Não foi possível ler o arquivo.'))
    reader.onload = () => {
      const value = String(reader.result || '')
      resolve(value.includes(',') ? value.split(',')[1] : value)
    }
    reader.readAsDataURL(file)
  })
}

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size < 900_000) return file

  const bitmap = await createImageBitmap(file)
  const maxSide = 1800
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) return file
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
  if (!blob) return file
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'material'
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
}

export async function prepareStudyFile(file: File) {
  const supported = file.type.startsWith('image/') || file.type === 'application/pdf'
  if (!supported) throw new Error('Envie uma foto (JPG/PNG/WEBP) ou PDF.')
  if (file.type === 'application/pdf' && file.size > 5_000_000) throw new Error('O PDF deve ter no máximo 5 MB nesta versão.')
  const prepared = await compressImage(file)
  if (prepared.size > 5_000_000) throw new Error('O arquivo ficou grande demais. Envie uma foto menor ou divida o PDF.')
  return prepared
}

export async function analyzeStudyMaterial(input: {
  child: StaffChild
  file: File
  sourceOnly?: boolean
}): Promise<StudyPack> {
  const session = await getSession()
  if (!session?.access_token) throw new Error('Sua sessão expirou. Entre novamente no Staff.')

  const fileBase64 = await fileToBase64(input.file)
  const response = await fetch('/.netlify/functions/staff-study', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      child_name: input.child.display_name,
      age_group: input.child.age_group,
      school_grade: input.child.school_grade,
      file_name: input.file.name,
      mime_type: input.file.type,
      file_base64: fileBase64,
      source_only: input.sourceOnly !== false,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || payload.message || 'Não consegui preparar o estudo agora.')
  return payload.study_pack as StudyPack
}

export async function saveKidsGameSession(userId: string, input: Omit<KidsGameSession, 'id' | 'user_id'>) {
  const { data, error } = await supabase
    .from('staff_kids_game_sessions')
    .insert({ user_id: userId, ...input })
    .select('*')
    .single()
  if (error) throw error
  return data as KidsGameSession
}

export async function loadKidsGameSessions(userId: string, childId?: string): Promise<KidsGameSession[]> {
  let query = supabase
    .from('staff_kids_game_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(100)
  if (childId) query = query.eq('child_id', childId)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as KidsGameSession[]
}

export async function saveStudyAttempt(userId: string, input: Omit<StudyAttempt, 'id' | 'user_id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('staff_study_attempts')
    .insert({ user_id: userId, ...input })
    .select('*')
    .single()
  if (error) throw error
  return data as StudyAttempt
}

export async function loadStudyAttempts(userId: string, childId?: string): Promise<StudyAttempt[]> {
  let query = supabase
    .from('staff_study_attempts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (childId) query = query.eq('child_id', childId)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as StudyAttempt[]
}
