export const JOB_FILE_MAX_BYTES = 25 * 1024 * 1024

export const JOB_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
  'video/mp4',
  'video/quicktime',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]

export const JOB_FILE_ACCEPT = JOB_FILE_TYPES.join(',')

export function jobFilePrefix(jobId: number) {
  return `jobs/${jobId}/`
}

/** Browsers can display these inline; HEIC and documents download instead. */
export function isPreviewableImage(contentType: string) {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType)
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
