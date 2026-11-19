import { useMemo } from 'react'
import type { UserFolder, Volume } from '@/domain/types'
import { useServiceData } from '@/hooks/use-service-data'
import { useSystemService } from '@/store/system-service-context'

export interface VolumesState {
  volumes: Volume[]
  folders: UserFolder[]
  loading: boolean
  error: unknown
  reload: () => void
}

/**
 * Volumes et dossiers d'accès rapide, lus une fois par écran.
 *
 * En mode démonstration, la réponse est immédiate (mêmes types, mêmes règles) ;
 * en mode réel, elle provient de `volumes_list` / `user_folders`.
 */
export function useVolumes(): VolumesState {
  const service = useSystemService()

  const volumes = useServiceData<Volume[]>(() => service.listVolumes(), [service])
  const folders = useServiceData<UserFolder[]>(() => service.listUserFolders(), [service])

  const volumeList = useMemo(() => volumes.data ?? [], [volumes.data])
  const folderList = useMemo(() => folders.data ?? [], [folders.data])

  return {
    volumes: volumeList,
    folders: folderList,
    loading: volumes.loading || folders.loading,
    error: volumes.error ?? folders.error,
    reload: () => {
      volumes.reload()
      folders.reload()
    },
  }
}
